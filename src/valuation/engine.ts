import type {
  ClientInput,
  ComparableEntry,
  ValuationEngineConfig,
  ValuationOutput,
} from "./types";
import { filterComparables, extractPsf } from "./matching";
import { applyOutlierFilter } from "./outliers";
import { computeAggregates, getBenchmarkPsf } from "./stats";
import { computeConfidence, hasRecentComparables } from "./scoring";
import { computeVerdict, generateExplanations } from "./verdict";

const ENGINE_RULES_VERSION = 1;

/**
 * Main valuation engine orchestrator
 */
export function runValuationEngine(
  client: ClientInput,
  comparables: ComparableEntry[],
  config: ValuationEngineConfig
): ValuationOutput {
  // 1. Compute client PSF
  const clientPsf = client.clientPrice / client.areaSqft;

  // 2. Filter comparables
  const { listings, transactions } = filterComparables(comparables, client, config);

  // 3. Extract PSF values
  const listingPsfValues = listings
    .map((c) => extractPsf(c))
    .filter((v): v is number => v !== null && v > 0);

  const transactionPsfValues = transactions
    .map((c) => extractPsf(c))
    .filter((v): v is number => v !== null && v > 0);

  // 4. Remove outliers
  const cleanedListingPsf = applyOutlierFilter(listingPsfValues, config.outlierMethod);
  const cleanedTransactionPsf = applyOutlierFilter(transactionPsfValues, config.outlierMethod);

  // 5. Compute aggregates
  const listingAggregates = computeAggregates(cleanedListingPsf);
  const transactionAggregates = computeAggregates(cleanedTransactionPsf);

  const totalComps = (listingAggregates?.count ?? 0) + (transactionAggregates?.count ?? 0);

  // 6. Check minimum comps
  if (totalComps < config.minComps) {
    return buildInsufficientOutput(
      clientPsf,
      config,
      listingAggregates,
      transactionAggregates,
      [...listings, ...transactions].map((c) => c.id)
    );
  }

  // 7. Get benchmark PSF
  const benchmarkPsf = getBenchmarkPsf(
    listingAggregates,
    transactionAggregates,
    config.benchmark
  );

  if (!benchmarkPsf) {
    return buildInsufficientOutput(
      clientPsf,
      config,
      listingAggregates,
      transactionAggregates,
      [...listings, ...transactions].map((c) => c.id)
    );
  }

  // 8. Compute verdict
  const { verdict, ratio } = computeVerdict(clientPsf, benchmarkPsf, config.thresholds);

  // 9. Compute recommended price range
  const allCleanedPsf = [...cleanedListingPsf, ...cleanedTransactionPsf];
  const lowPsf = Math.min(...allCleanedPsf);
  const highPsf = Math.max(...allCleanedPsf);

  const recommendedLow = lowPsf * client.areaSqft;
  const recommendedMid = benchmarkPsf * client.areaSqft;
  const recommendedHigh = highPsf * client.areaSqft;

  // 10. Compute confidence
  const allComps = [...listings, ...transactions];
  const isRecent = hasRecentComparables(allComps, 6);

  const confidence = computeConfidence({
    listingCount: listingAggregates?.count ?? 0,
    transactionCount: transactionAggregates?.count ?? 0,
    listingAggregates,
    transactionAggregates,
    hasRecentData: isRecent,
  });

  // 11. Generate explanations
  const explanations = generateExplanations(
    clientPsf,
    benchmarkPsf,
    ratio,
    verdict,
    listingAggregates?.count ?? 0,
    transactionAggregates?.count ?? 0,
    config.areaTolerancePct
  );

  return {
    clientPsf,
    listings: listingAggregates,
    transactions: transactionAggregates,
    recommendedLow,
    recommendedMid,
    recommendedHigh,
    verdict,
    ratioToMarket: ratio,
    confidence,
    explanations,
    compsUsed: allComps.map((c) => c.id),
    rulesVersion: ENGINE_RULES_VERSION,
    areaTolerancePct: config.areaTolerancePct,
    outlierMethod: config.outlierMethod,
    minComps: config.minComps,
    benchmark: config.benchmark,
  };
}

function buildInsufficientOutput(
  clientPsf: number,
  config: ValuationEngineConfig,
  listingAggregates: ReturnType<typeof computeAggregates>,
  transactionAggregates: ReturnType<typeof computeAggregates>,
  compsUsed: string[]
): ValuationOutput {
  return {
    clientPsf,
    listings: listingAggregates,
    transactions: transactionAggregates,
    recommendedLow: null,
    recommendedMid: null,
    recommendedHigh: null,
    verdict: "INSUFFICIENT_DATA",
    ratioToMarket: null,
    confidence: 0,
    explanations: [
      `Only ${(listingAggregates?.count ?? 0) + (transactionAggregates?.count ?? 0)} comparable(s) found — minimum required is ${config.minComps}.`,
      "Try expanding the area tolerance or adding more comparable data.",
    ],
    compsUsed,
    rulesVersion: ENGINE_RULES_VERSION,
    areaTolerancePct: config.areaTolerancePct,
    outlierMethod: config.outlierMethod,
    minComps: config.minComps,
    benchmark: config.benchmark,
  };
}

/**
 * Compute PSF fields server-side when creating/updating entries
 */
export function computePsf(data: {
  sourceType?: string;
  areaSqft?: number | null;
  askPrice?: number | null;
  lowestPrice?: number | null;
  transactionAreaSqft?: number | null;
  transactionPrice?: number | null;
}): {
  askPsf: number | null;
  lowPsf: number | null;
  transactionPsf: number | null;
} {
  let askPsf: number | null = null;
  let lowPsf: number | null = null;
  let transactionPsf: number | null = null;

  if (!data.sourceType || data.sourceType === "LISTING") {
    if (data.askPrice && data.areaSqft && data.areaSqft > 0) {
      askPsf = Number(data.askPrice) / Number(data.areaSqft);
    }
    if (data.lowestPrice && data.areaSqft && data.areaSqft > 0) {
      lowPsf = Number(data.lowestPrice) / Number(data.areaSqft);
    }
  }

  if (!data.sourceType || data.sourceType === "TRANSACTION") {
    if (data.transactionPrice && data.transactionAreaSqft && data.transactionAreaSqft > 0) {
      transactionPsf = Number(data.transactionPrice) / Number(data.transactionAreaSqft);
    }
  }

  return { askPsf, lowPsf, transactionPsf };
}
