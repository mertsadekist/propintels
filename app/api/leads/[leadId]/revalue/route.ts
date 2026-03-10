import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";
import { runValuationEngine } from "@/valuation/engine";
import { settingsRepo } from "@/db/repositories/settings.repo";
import type { ComparableEntry } from "@/valuation/types";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const { error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: params.leadId },
      include: { project: true },
    });

    if (!lead) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Lead not found" } },
        { status: 404 }
      );
    }

    const projectLocation = lead.project.location;

    // Listings: project-scoped
    // Transactions: area-scoped (same location across all projects)
    const [listingEntries, transactionEntries] = await Promise.all([
      prisma.entry.findMany({
        where: { projectId: lead.projectId, sourceType: "LISTING", isActive: true },
      }),
      projectLocation
        ? prisma.entry.findMany({
            where: {
              sourceType: "TRANSACTION",
              isActive: true,
              project: { location: projectLocation },
            },
          })
        : prisma.entry.findMany({
            where: { projectId: lead.projectId, sourceType: "TRANSACTION", isActive: true },
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

    const config = await settingsRepo.getValuationRules(lead.projectId);

    const engineResult = runValuationEngine(
      {
        propertyType: lead.propertyType,
        bedrooms: lead.bedrooms ?? null,
        areaSqft: Number(lead.areaSqft),
        clientPrice: Number(lead.clientPrice),
        projectId: lead.projectId,
      },
      comparables,
      config
    );

    // Update existing valuation result
    await prisma.valuationResult.update({
      where: { leadId: lead.id },
      data: {
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

    return NextResponse.json({
      data: {
        verdict: engineResult.verdict,
        confidence: engineResult.confidence,
        listingCount: engineResult.listings?.count ?? 0,
        transactionCount: engineResult.transactions?.count ?? 0,
        totalComps: (engineResult.listings?.count ?? 0) + (engineResult.transactions?.count ?? 0),
        areaScoped: !!projectLocation,
        area: projectLocation,
      },
    });
  } catch (err) {
    console.error("[revalue] Error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Unknown error" } },
      { status: 500 }
    );
  }
}
