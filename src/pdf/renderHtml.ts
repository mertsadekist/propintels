import { prisma } from "@/db/prisma";
import { settingsRepo } from "@/db/repositories/settings.repo";
import { buildReportHtml } from "./templates/report.template";
import type { ReportData, BrandingConfig } from "./templates/types";

export async function renderReportHtml(leadId: string): Promise<string> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      project: true,
      valuationResult: true,
    },
  });

  if (!lead || !lead.valuationResult) {
    throw new Error(`Lead or valuation result not found for leadId: ${leadId}`);
  }

  const result = lead.valuationResult;

  // Load comparable entries used in valuation
  const compsUsed = (result.compsUsed as string[]) ?? [];
  const entries =
    compsUsed.length > 0
      ? await prisma.entry.findMany({ where: { id: { in: compsUsed } } })
      : [];

  const listingComps = entries
    .filter((e) => e.sourceType === "LISTING")
    .map((e) => ({
      id: e.id,
      locationLabel: e.locationLabel,
      bedrooms: e.bedrooms,
      areaSqft: e.areaSqft ? Number(e.areaSqft) : null,
      askPrice: e.askPrice ? Number(e.askPrice) : null,
      askPsf: e.askPsf ? Number(e.askPsf) : null,
      portal: e.portal,
    }));

  const transactionComps = entries
    .filter((e) => e.sourceType === "TRANSACTION")
    .map((e) => ({
      id: e.id,
      locationLabel: e.locationLabel,
      bedrooms: e.bedrooms,
      transactionDate: e.transactionDate,
      transactionAreaSqft: e.transactionAreaSqft ? Number(e.transactionAreaSqft) : null,
      transactionPrice: e.transactionPrice ? Number(e.transactionPrice) : null,
      transactionPsf: e.transactionPsf ? Number(e.transactionPsf) : null,
    }));

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
  };

  return buildReportHtml(reportData, branding);
}
