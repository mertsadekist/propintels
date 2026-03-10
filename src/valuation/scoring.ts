import type { PsfAggregates } from "./types";

interface ConfidenceFactors {
  listingCount: number;
  transactionCount: number;
  listingAggregates: PsfAggregates | null;
  transactionAggregates: PsfAggregates | null;
  hasRecentData: boolean;
}

export function computeConfidence(factors: ConfidenceFactors): number {
  let score = 0;

  const totalComps = factors.listingCount + factors.transactionCount;

  // Comparable count (0–40 points)
  if (totalComps >= 15) score += 40;
  else if (totalComps >= 10) score += 30;
  else if (totalComps >= 7) score += 25;
  else if (totalComps >= 5) score += 20;
  else if (totalComps >= 3) score += 10;

  // Transaction weight bonus (0–10 points)
  if (factors.transactionCount >= 5) score += 10;
  else if (factors.transactionCount >= 3) score += 7;
  else if (factors.transactionCount >= 1) score += 3;

  // Data variance (0–30 points)
  const primaryAgg = factors.transactionAggregates ?? factors.listingAggregates;
  if (primaryAgg && primaryAgg.count >= 2) {
    const cv = coefficientOfVariation(primaryAgg.values);
    if (cv < 0.05) score += 30;
    else if (cv < 0.10) score += 25;
    else if (cv < 0.15) score += 18;
    else if (cv < 0.25) score += 10;
    else score += 3;
  }

  // Data recency (0–20 points)
  if (factors.hasRecentData) score += 20;
  else score += 5;

  return Math.min(Math.max(Math.round(score), 0), 100);
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1);
  const stdDev = Math.sqrt(variance);

  return mean === 0 ? 0 : stdDev / mean;
}

export function hasRecentComparables(
  entries: Array<{ createdDate?: Date | null; transactionDate?: Date | null }>,
  months: number = 6
): boolean {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  return entries.some((e) => {
    const date = e.transactionDate ?? e.createdDate;
    return date && date >= cutoff;
  });
}
