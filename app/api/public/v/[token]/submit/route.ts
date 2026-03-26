import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/prisma";
import { publicSubmitSchema } from "@/validation/lead.schema";
import { runValuationEngine } from "@/valuation/engine";
import { valuationOutputToSnapshot } from "@/valuation/types";
import { settingsRepo } from "@/db/repositories/settings.repo";
import { enqueueReportGeneration } from "@/jobs/queue";
import { checkRateLimit } from "@/lib/ratelimit";
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

  const rateLimit = await checkRateLimit(`submit:${ip}`, 5, 60);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests. Please wait before trying again." } },
      { status: 429 }
    );
  }

  // 2. Validate token
  const link = await prisma.valuationLink.findUnique({
    where: { id: params.token },
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
  // Area valuation: project listings + ALL transactions in same location
  // Project valuation: project listings + project-only transactions
  const projectLocation = link.project.location;

  const [listingEntries, areaTransactionEntries, projectTransactionEntries] = await Promise.all([
    // Listings within the same project (shared by both passes)
    prisma.entry.findMany({
      where: { projectId: link.projectId, sourceType: "LISTING", isActive: true },
    }),
    // Area transactions: all DLD transactions in the same location
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
    // Project-only transactions (for project valuation pass)
    prisma.entry.findMany({
      where: { projectId: link.projectId, sourceType: "TRANSACTION", isActive: true },
    }),
  ]);

  // 5. Load valuation config
  const config = await settingsRepo.getValuationRules(link.projectId);

  const clientInput = {
    propertyType: input.propertyType,
    bedrooms: input.bedrooms ?? null,
    areaSqft: input.areaSqft,
    clientPrice: input.clientPrice,
    projectId: link.projectId,
  };

  // Helper to map DB entries to ComparableEntry
  const toComparable = (e: typeof listingEntries[0]): ComparableEntry => ({
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
  });

  // 6a. Run AREA valuation engine (listings + area-wide transactions)
  const areaComparables: ComparableEntry[] = [
    ...listingEntries.map(toComparable),
    ...areaTransactionEntries.map(toComparable),
  ];
  const areaResult = runValuationEngine(clientInput, areaComparables, config);

  // 6b. Run PROJECT valuation engine (project-only entries)
  const projectComparables: ComparableEntry[] = [
    ...listingEntries.map(toComparable),
    ...projectTransactionEntries.map(toComparable),
  ];
  const projectResult = runValuationEngine(clientInput, projectComparables, config);
  const projectSnapshot = valuationOutputToSnapshot(projectResult);

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
        rulesVersion: areaResult.rulesVersion,
        areaTolerancePct: areaResult.areaTolerancePct,
        outlierMethod: areaResult.outlierMethod,
        minComps: areaResult.minComps,
        benchmark: areaResult.benchmark,
        clientPsf: areaResult.clientPsf,
        listingCount: areaResult.listings?.count ?? 0,
        listingMeanPsf: areaResult.listings?.mean ?? null,
        listingMedianPsf: areaResult.listings?.median ?? null,
        listingMinPsf: areaResult.listings?.min ?? null,
        listingMaxPsf: areaResult.listings?.max ?? null,
        transactionCount: areaResult.transactions?.count ?? 0,
        transactionMeanPsf: areaResult.transactions?.mean ?? null,
        transactionMedianPsf: areaResult.transactions?.median ?? null,
        transactionMinPsf: areaResult.transactions?.min ?? null,
        transactionMaxPsf: areaResult.transactions?.max ?? null,
        recommendedLow: areaResult.recommendedLow,
        recommendedMid: areaResult.recommendedMid,
        recommendedHigh: areaResult.recommendedHigh,
        verdict: areaResult.verdict,
        ratioToMarket: areaResult.ratioToMarket,
        confidence: areaResult.confidence,
        explanations: areaResult.explanations,
        compsUsed: areaResult.compsUsed,
        // Project valuation snapshot
        projectValuationData: projectSnapshot as object,
        projectCompsUsed: projectResult.compsUsed,
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
        // Area valuation
        verdict: areaResult.verdict,
        clientPsf: Math.round(areaResult.clientPsf),
        listings: areaResult.listings
          ? {
              count: areaResult.listings.count,
              medianPsf: Math.round(areaResult.listings.median),
              meanPsf: Math.round(areaResult.listings.mean),
            }
          : null,
        transactions: areaResult.transactions
          ? {
              count: areaResult.transactions.count,
              medianPsf: Math.round(areaResult.transactions.median),
              meanPsf: Math.round(areaResult.transactions.mean),
            }
          : null,
        recommendedLow: areaResult.recommendedLow ? Math.round(areaResult.recommendedLow) : null,
        recommendedMid: areaResult.recommendedMid ? Math.round(areaResult.recommendedMid) : null,
        recommendedHigh: areaResult.recommendedHigh ? Math.round(areaResult.recommendedHigh) : null,
        ratioToMarket: areaResult.ratioToMarket,
        confidence: areaResult.confidence,
        explanations: areaResult.explanations,
        // Project valuation
        projectValuation: {
          verdict: projectResult.verdict,
          confidence: projectResult.confidence,
          ratioToMarket: projectResult.ratioToMarket,
          benchmarkPsf: projectResult.benchmarkPsf ? Math.round(projectResult.benchmarkPsf) : null,
          recommendedLow: projectResult.recommendedLow ? Math.round(projectResult.recommendedLow) : null,
          recommendedMid: projectResult.recommendedMid ? Math.round(projectResult.recommendedMid) : null,
          recommendedHigh: projectResult.recommendedHigh ? Math.round(projectResult.recommendedHigh) : null,
          listingCount: projectResult.listings?.count ?? 0,
          transactionCount: projectResult.transactions?.count ?? 0,
        },
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
