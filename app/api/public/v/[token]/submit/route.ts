import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/prisma";
import { hashToken } from "@/lib/token";
import { publicSubmitSchema } from "@/validation/lead.schema";
import { runValuationEngine } from "@/valuation/engine";
import { settingsRepo } from "@/db/repositories/settings.repo";
import { enqueueReportGeneration } from "@/jobs/queue";
import { checkRateLimitSync } from "@/lib/ratelimit";
import type { ComparableEntry } from "@/valuation/types";

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
  // 1. Rate limiting
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const rateLimit = checkRateLimitSync(`submit:${ip}`, 5, 60_000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests. Please wait before trying again." } },
      { status: 429 }
    );
  }

  // 2. Validate token
  const tokenHash = hashToken(params.token);
  const link = await prisma.valuationLink.findUnique({
    where: { tokenHash },
    include: { project: true },
  });

  if (!link || !link.project) {
    return NextResponse.json(
      { error: { code: "TOKEN_INVALID", message: "Invalid or expired link." } },
      { status: 404 }
    );
  }

  if (link.status === "DISABLED") {
    return NextResponse.json(
      { error: { code: "TOKEN_INVALID", message: "This link has been disabled." } },
      { status: 410 }
    );
  }

  if (link.expiresAt && link.expiresAt < new Date()) {
    return NextResponse.json(
      { error: { code: "TOKEN_EXPIRED", message: "This link has expired." } },
      { status: 410 }
    );
  }

  if (link.maxUses && link.usedCount >= link.maxUses) {
    return NextResponse.json(
      { error: { code: "TOKEN_EXPIRED", message: "This link has reached its limit." } },
      { status: 410 }
    );
  }

  // 3. Validate input
  const body = await request.json();
  const parsed = publicSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const input = parsed.data;

  // 4. Load comparable entries
  // Listings: project-scoped (hand-curated comps for this specific project)
  // Transactions: area-scoped (all DLD transactions in the same location/area)
  const projectLocation = link.project.location;

  const [listingEntries, transactionEntries] = await Promise.all([
    // Listings within the same project
    prisma.entry.findMany({
      where: { projectId: link.projectId, sourceType: "LISTING", isActive: true },
    }),
    // Transactions across all projects in the same area (if location is set)
    projectLocation
      ? prisma.entry.findMany({
          where: {
            sourceType: "TRANSACTION",
            isActive: true,
            project: { location: projectLocation },
          },
          include: { project: { select: { location: true } } },
        })
      : prisma.entry.findMany({
          where: { projectId: link.projectId, sourceType: "TRANSACTION", isActive: true },
        }),
  ]);

  const dbEntries = [...listingEntries, ...transactionEntries];

  const comparables: ComparableEntry[] = dbEntries.map((e) => ({
    id: e.id,
    projectId: e.projectId,
    sourceType: e.sourceType as "LISTING" | "TRANSACTION",
    propertyType: e.propertyType,
    bedrooms: e.bedrooms,
    areaSqft: e.areaSqft ? Number(e.areaSqft) : null,
    askPsf: e.askPsf ? Number(e.askPsf) : null,
    lowPsf: e.lowPsf ? Number(e.lowPsf) : null,
    transactionAreaSqft: e.transactionAreaSqft ? Number(e.transactionAreaSqft) : null,
    transactionPsf: e.transactionPsf ? Number(e.transactionPsf) : null,
    createdDate: e.createdDate,
    transactionDate: e.transactionDate,
  }));

  // 5. Load valuation config
  const config = await settingsRepo.getValuationRules(link.projectId);

  // 6. Run valuation engine
  const engineResult = runValuationEngine(
    {
      propertyType: input.propertyType,
      bedrooms: input.bedrooms ?? null,
      areaSqft: input.areaSqft,
      clientPrice: input.clientPrice,
      projectId: link.projectId,
    },
    comparables,
    config
  );

  // 7. Create lead + valuation result atomically
  const { lead, report } = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        linkId: link.id,
        projectId: link.projectId,
        assignedAgentId: link.agentId ?? null,
        fullName: input.fullName,
        phone: input.phone,
        email: input.email ?? null,
        category: input.category,
        propertyType: input.propertyType,
        bedrooms: input.bedrooms ?? null,
        bathrooms: input.bathrooms ?? null,
        unitType: input.unitType ?? null,
        areaSqft: input.areaSqft,
        clientPrice: input.clientPrice,
        currency: input.currency,
        ipAddress: ip,
        userAgent: request.headers.get("user-agent") ?? null,
      },
    });

    await tx.valuationResult.create({
      data: {
        leadId: lead.id,
        rulesVersion: engineResult.rulesVersion,
        areaTolerancePct: engineResult.areaTolerancePct,
        outlierMethod: engineResult.outlierMethod,
        minComps: engineResult.minComps,
        benchmark: engineResult.benchmark,
        clientPsf: engineResult.clientPsf,
        listingCount: engineResult.listings?.count ?? 0,
        listingMeanPsf: engineResult.listings?.mean ?? null,
        listingMedianPsf: engineResult.listings?.median ?? null,
        listingMinPsf: engineResult.listings?.min ?? null,
        listingMaxPsf: engineResult.listings?.max ?? null,
        transactionCount: engineResult.transactions?.count ?? 0,
        transactionMeanPsf: engineResult.transactions?.mean ?? null,
        transactionMedianPsf: engineResult.transactions?.median ?? null,
        transactionMinPsf: engineResult.transactions?.min ?? null,
        transactionMaxPsf: engineResult.transactions?.max ?? null,
        recommendedLow: engineResult.recommendedLow,
        recommendedMid: engineResult.recommendedMid,
        recommendedHigh: engineResult.recommendedHigh,
        verdict: engineResult.verdict,
        ratioToMarket: engineResult.ratioToMarket,
        confidence: engineResult.confidence,
        explanations: engineResult.explanations,
        compsUsed: engineResult.compsUsed,
      },
    });

    const report = await tx.report.create({
      data: {
        leadId: lead.id,
        status: "QUEUED",
        fileName: `valuation-report-${lead.id}.pdf`,
      },
    });

    await tx.valuationLink.update({
      where: { id: link.id },
      data: { usedCount: { increment: 1 } },
    });

    return { lead, report };
  });

  // 8. Enqueue PDF generation job
  try {
    await enqueueReportGeneration({ leadId: lead.id, reportId: report.id });
  } catch (jobErr) {
    console.error("Failed to enqueue PDF job:", jobErr);
  }

  return NextResponse.json(
    {
      data: {
        leadId: lead.id,
        verdict: engineResult.verdict,
        clientPsf: Math.round(engineResult.clientPsf),
        listings: engineResult.listings
          ? {
              count: engineResult.listings.count,
              medianPsf: Math.round(engineResult.listings.median),
              meanPsf: Math.round(engineResult.listings.mean),
            }
          : null,
        transactions: engineResult.transactions
          ? {
              count: engineResult.transactions.count,
              medianPsf: Math.round(engineResult.transactions.median),
              meanPsf: Math.round(engineResult.transactions.mean),
            }
          : null,
        recommendedLow: engineResult.recommendedLow
          ? Math.round(engineResult.recommendedLow)
          : null,
        recommendedMid: engineResult.recommendedMid
          ? Math.round(engineResult.recommendedMid)
          : null,
        recommendedHigh: engineResult.recommendedHigh
          ? Math.round(engineResult.recommendedHigh)
          : null,
        ratioToMarket: engineResult.ratioToMarket,
        confidence: engineResult.confidence,
        explanations: engineResult.explanations,
        report: {
          id: report.id,
          status: "QUEUED",
        },
      },
    },
    { status: 201 }
  );
  } catch (err) {
    console.error("[submit] Unhandled error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
