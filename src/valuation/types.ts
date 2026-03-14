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

/**
 * Serialisable snapshot of a single valuation pass (area OR project).
 * Stored as JSON in ValuationResult.projectValuationData for the project pass.
 */
export interface ValuationSnapshot {
  listingCount: number;
  listingMeanPsf: number | null;
  listingMedianPsf: number | null;
  listingMinPsf: number | null;
  listingMaxPsf: number | null;
  transactionCount: number;
  transactionMeanPsf: number | null;
  transactionMedianPsf: number | null;
  transactionMinPsf: number | null;
  transactionMaxPsf: number | null;
  benchmarkPsf: number | null;
  verdict: VerdictLabel;
  ratioToMarket: number | null;
  recommendedLow: number | null;
  recommendedMid: number | null;
  recommendedHigh: number | null;
  confidence: number;
  compsUsed: string[];
  explanations: string[];
}

export interface ValuationOutput {
  clientPsf: number;
  listings: PsfAggregates | null;
  transactions: PsfAggregates | null;
  benchmarkPsf: number | null;
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

/** Convert a ValuationOutput to a serialisable ValuationSnapshot */
export function valuationOutputToSnapshot(output: ValuationOutput): ValuationSnapshot {
  return {
    listingCount: output.listings?.count ?? 0,
    listingMeanPsf: output.listings?.mean ?? null,
    listingMedianPsf: output.listings?.median ?? null,
    listingMinPsf: output.listings?.min ?? null,
    listingMaxPsf: output.listings?.max ?? null,
    transactionCount: output.transactions?.count ?? 0,
    transactionMeanPsf: output.transactions?.mean ?? null,
    transactionMedianPsf: output.transactions?.median ?? null,
    transactionMinPsf: output.transactions?.min ?? null,
    transactionMaxPsf: output.transactions?.max ?? null,
    benchmarkPsf: output.benchmarkPsf,
    verdict: output.verdict,
    ratioToMarket: output.ratioToMarket,
    recommendedLow: output.recommendedLow,
    recommendedMid: output.recommendedMid,
    recommendedHigh: output.recommendedHigh,
    confidence: output.confidence,
    compsUsed: output.compsUsed,
    explanations: output.explanations,
  };
}
