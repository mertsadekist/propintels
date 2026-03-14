import { prisma } from "@/db/prisma";
import { settingsRepo } from "@/db/repositories/settings.repo";
import { buildReportHtml } from "./templates/report.template";
import type { ReportData, BrandingConfig, ComparableCompact, ProjectValuationReport } from "./templates/types";
import type { ValuationSnapshot } from "@/valuation/types";

function mapToComparableCompact(entries: {
  id: string;
  sourceType: string;
  locationLabel: string | null;
  bedrooms: number | null;
  areaSqft: { toNumber(): number } | null;
  askPrice: { toNumber(): number } | null;
  askPsf: { toNumber(): number } | null;
  portal: string | null;
  transactionDate: Date | null;
  transactionAreaSqft: { toNumber(): number } | null;
  transactionPrice: { toNumber(): number } | null;
  transactionPsf: { toNumber(): number } | null;
}[]): { listings: ComparableCompact[]; transactions: ComparableCompact[] } {
  const listings: ComparableCompact[] = [];
  const transactions: ComparableCompact[] = [];

  for (const e of entries) {
    if (e.sourceType === "LISTING") {
      listings.push({
        id: e.id,
        locationLabel: e.locationLabel,
        bedrooms: e.bedrooms,
        areaSqft: e.areaSqft ? e.areaSqft.toNumber() : null,
        askPrice: e.askPrice ? e.askPrice.toNumber() : null,
        askPsf: e.askPsf ? e.askPsf.toNumber() : null,
        portal: e.portal,
      });
    } else {
      transactions.push({
        id: e.id,
        locationLabel: e.locationLabel,
        bedrooms: e.bedrooms,
        transactionDate: e.transactionDate,
        transactionAreaSqft: e.transactionAreaSqft ? e.transactionAreaSqft.toNumber() : null,
        transactionPrice: e.transactionPrice ? e.transactionPrice.toNumber() : null,
        transactionPsf: e.transactionPsf ? e.transactionPsf.toNumber() : null,
      });
    }
  }

  return { listings, transactions };
}

export async function renderReportHtml(leadId: string): Promise<string> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      project: true,
      valuationResult: true,
      specialistAssessment: {
        include: {
          specialist: { select: { name: true } },
        },
      },
    },
  });

  if (!lead || !lead.valuationResult) {
    throw new Error(`Lead or valuation result not found for leadId: ${leadId}`);
  }

  const result = lead.valuationResult;

  // Load area comparable entries
  const compsUsed = (result.compsUsed as string[]) ?? [];
  const areaEntries =
    compsUsed.length > 0
      ? await prisma.entry.findMany({ where: { id: { in: compsUsed } } })
      : [];

  const { listings: listingComps, transactions: transactionComps } =
    mapToComparableCompact(areaEntries);

  // Load project comparable entries
  const projectCompsUsed = (result.projectCompsUsed as unknown as string[]) ?? [];
  let projectValuation: ProjectValuationReport | null = null;

  if (result.projectValuationData) {
    const snapshot = result.projectValuationData as unknown as ValuationSnapshot;

    const projectEntries =
      projectCompsUsed.length > 0
        ? await prisma.entry.findMany({ where: { id: { in: projectCompsUsed } } })
        : [];

    const { listings: projListingComps, transactions: projTransactionComps } =
      mapToComparableCompact(projectEntries);

    projectValuation = {
      verdict: snapshot.verdict,
      confidence: snapshot.confidence,
      ratioToMarket: snapshot.ratioToMarket,
      benchmarkPsf: snapshot.benchmarkPsf,
      recommendedLow: snapshot.recommendedLow,
      recommendedMid: snapshot.recommendedMid,
      recommendedHigh: snapshot.recommendedHigh,
      listingCount: snapshot.listingCount,
      transactionCount: snapshot.transactionCount,
      listingComps: projListingComps,
      transactionComps: projTransactionComps,
    };
  }

  // Specialist assessment
  const specialistData = lead.specialistAssessment
    ? {
        estimatedPrice: Number(lead.specialistAssessment.estimatedPrice),
        estimatedPsf: Number(lead.specialistAssessment.estimatedPsf),
        notes: lead.specialistAssessment.notes,
        specialistName: lead.specialistAssessment.specialist.name,
        assessedAt: lead.specialistAssessment.updatedAt.toISOString(),
      }
    : null;

  // Load branding settings
  const brandingRaw = await settingsRepo.getBranding();
  const branding = brandingRaw as BrandingConfig;

  const reportData: ReportData = {
    leadId: lead.id,
    projectName: lead.project.name,
    clientName: lead.fullName,
    clientPsf: Number(result.clientPsf),
    areaSqft: Number(lead.areaSqft),
    clientPrice: Number(lead.clientPrice),
    propertyType: lead.propertyType,
    bedrooms: lead.bedrooms,
    verdict: result.verdict,
    confidence: result.confidence,
    ratioToMarket: result.ratioToMarket ? Number(result.ratioToMarket) : null,
    recommendedLow: result.recommendedLow ? Number(result.recommendedLow) : null,
    recommendedMid: result.recommendedMid ? Number(result.recommendedMid) : null,
    recommendedHigh: result.recommendedHigh ? Number(result.recommendedHigh) : null,
    listings:
      result.listingCount && result.listingCount > 0
        ? {
            count: result.listingCount,
            medianPsf: Number(result.listingMedianPsf ?? 0),
            meanPsf: Number(result.listingMeanPsf ?? 0),
            minPsf: Number(result.listingMinPsf ?? 0),
            maxPsf: Number(result.listingMaxPsf ?? 0),
          }
        : null,
    transactions:
      result.transactionCount && result.transactionCount > 0
        ? {
            count: result.transactionCount,
            medianPsf: Number(result.transactionMedianPsf ?? 0),
            meanPsf: Number(result.transactionMeanPsf ?? 0),
            minPsf: Number(result.transactionMinPsf ?? 0),
            maxPsf: Number(result.transactionMaxPsf ?? 0),
          }
        : null,
    listingComps,
    transactionComps,
    explanations: (result.explanations as string[]) ?? [],
    projectValuation,
    specialistAssessment: specialistData,
  };

  return buildReportHtml(reportData, branding);
}
