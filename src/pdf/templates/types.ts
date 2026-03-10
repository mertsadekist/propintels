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

export interface ReportData {
  leadId: string;
  projectName: string;
  clientName: string;
  clientPsf: number;
  areaSqft: number;
  clientPrice: number;
  propertyType: string;
  bedrooms?: number | null;
  verdict: string;
  confidence: number;
  ratioToMarket?: number | null;
  recommendedLow?: number | null;
  recommendedMid?: number | null;
  recommendedHigh?: number | null;
  listings?: {
    count: number;
    medianPsf: number;
    meanPsf: number;
    minPsf: number;
    maxPsf: number;
  } | null;
  transactions?: {
    count: number;
    medianPsf: number;
    meanPsf: number;
    minPsf: number;
    maxPsf: number;
  } | null;
  listingComps: ComparableCompact[];
  transactionComps: ComparableCompact[];
  explanations: string[];
}
