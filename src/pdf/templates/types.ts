export interface BrandingConfig {
  companyName: string;
  primaryColor: string;
  accentColor?: string;
  logoUrl?: string | null;
  disclaimer?: string;
  website?: string;
  phone?: string;
  email?: string;
}

export interface ComparableCompact {
  id: string;
  locationLabel?: string | null;
  bedrooms?: number | null;
  areaSqft?: number | null;
  askPrice?: number | null;
  askPsf?: number | null;
  portal?: string | null;
  transactionDate?: Date | null;
  transactionAreaSqft?: number | null;
  transactionPrice?: number | null;
  transactionPsf?: number | null;
}

export interface ValuationBlock {
  count: number;
  medianPsf: number;
  meanPsf: number;
  minPsf: number;
  maxPsf: number;
}

export interface ProjectValuationReport {
  verdict: string;
  confidence: number;
  ratioToMarket: number | null;
  benchmarkPsf: number | null;
  recommendedLow: number | null;
  recommendedMid: number | null;
  recommendedHigh: number | null;
  listingCount: number;
  transactionCount: number;
  listingComps: ComparableCompact[];
  transactionComps: ComparableCompact[];
}

export interface SpecialistAssessmentReport {
  estimatedPrice: number;
  estimatedPsf: number;
  notes: string;
  specialistName: string;
  assessedAt: string; // ISO date string
}

export interface ReportData {
  leadId: string;
  projectName: string;
  clientName: string;
  clientPsf: number;
  areaSqft: number;
  clientPrice: number;
  propertyType: string;
  bedrooms?: number | null;

  // Area valuation (primary / existing)
  verdict: string;
  confidence: number;
  ratioToMarket?: number | null;
  recommendedLow?: number | null;
  recommendedMid?: number | null;
  recommendedHigh?: number | null;
  listings?: ValuationBlock | null;
  transactions?: ValuationBlock | null;
  listingComps: ComparableCompact[];
  transactionComps: ComparableCompact[];
  explanations: string[];

  // Project valuation (optional)
  projectValuation?: ProjectValuationReport | null;

  // Specialist assessment (optional)
  specialistAssessment?: SpecialistAssessmentReport | null;
}
