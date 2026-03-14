import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";
import { runValuationEngine } from "@/valuation/engine";
import { valuationOutputToSnapshot } from "@/valuation/types";
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

    // Load entries for both passes
    const [listingEntries, areaTransactionEntries, projectTransactionEntries] = await Promise.all([
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
      prisma.entry.findMany({
        where: { projectId: lead.projectId, sourceType: "TRANSACTION", isActive: true },
      }),
    ]);

    const config = await settingsRepo.getValuationRules(lead.projectId);

    const clientInput = {
      propertyType: lead.propertyType,
      bedrooms: lead.bedrooms ?? null,
      areaSqft: Number(lead.areaSqft),
      clientPrice: Number(lead.clientPrice),
      projectId: lead.projectId,
    };

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

    // Area valuation pass
    const areaComparables: ComparableEntry[] = [
      ...listingEntries.map(toComparable),
      ...areaTransactionEntries.map(toComparable),
    ];
    const areaResult = runValuationEngine(clientInput, areaComparables, config);

    // Project valuation pass
    const projectComparables: ComparableEntry[] = [
      ...listingEntries.map(toComparable),
      ...projectTransactionEntries.map(toComparable),
    ];
    const projectResult = runValuationEngine(clientInput, projectComparables, config);
    const projectSnapshot = valuationOutputToSnapshot(projectResult);

    // Update existing valuation result
    await prisma.valuationResult.update({
      where: { leadId: lead.id },
      data: {
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
        projectValuationData: projectSnapshot as object,
        projectCompsUsed: projectResult.compsUsed,
      },
    });

    return NextResponse.json({
      data: {
        verdict: areaResult.verdict,
        confidence: areaResult.confidence,
        listingCount: areaResult.listings?.count ?? 0,
        transactionCount: areaResult.transactions?.count ?? 0,
        totalComps: (areaResult.listings?.count ?? 0) + (areaResult.transactions?.count ?? 0),
        areaScoped: !!projectLocation,
        area: projectLocation,
        projectValuation: {
          verdict: projectResult.verdict,
          confidence: projectResult.confidence,
          listingCount: projectResult.listings?.count ?? 0,
          transactionCount: projectResult.transactions?.count ?? 0,
        },
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
