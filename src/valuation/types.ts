export interface ClientInput {
  propertyType: string;
  bedrooms?: number | null;
  areaSqft: number;
  clientPrice: number;
  /** The project this lead belongs to — used to bypass propertyType check for same-project comps */
  projectId?: string | null;
}

export interface ComparableEntry {
  id: string;
  /** Project this comparable belongs to — used for same-project matching bypass */
  projectId?: string | null;
  sourceType: "LISTING" | "TRANSACTION";
  propertyType: string;
  bedrooms?: number | null;
  areaSqft?: number | null;
  askPsf?: number | null;
  lowPsf?: number | null;
  transactionAreaSqft?: number | null;
  transactionPsf?: number | null;
  createdDate?: Date | null;
  transactionDate?: Date | null;
}

export interface ValuationEngineConfig {
  areaTolerancePct: number;
  outlierMethod: "trim10" | "iqr";
  minComps: number;
  benchmark: "transactionMedianPsf" | "listingMedianPsf";
  thresholds: {
    below_market: number;
    aligned_max: number;
    slightly_above_max: number;
  };
}

export type VerdictLabel =
  | "BELOW_MARKET"
  | "ALIGNED"
  | "SLIGHTLY_ABOVE"
  | "ABOVE_MARKET"
  | "INSUFFICIENT_DATA";

export interface PsfAggregates {
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  values: number[];
}

export interface ValuationOutput {
  clientPsf: number;
  listings: PsfAggregates | null;
  transactions: PsfAggregates | null;
  recommendedLow: number | null;
  recommendedMid: number | null;
  recommendedHigh: number | null;
  verdict: VerdictLabel;
  ratioToMarket: number | null;
  confidence: number;
  explanations: string[];
  compsUsed: string[];
  rulesVersion: number;
  areaTolerancePct: number;
  outlierMethod: string;
  minComps: number;
  benchmark: string;
}
