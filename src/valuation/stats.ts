import type { PsfAggregates } from "./types";

export function computeAggregates(values: number[]): PsfAggregates | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / sorted.length;
  const median = computeMedian(sorted);

  return {
    count: sorted.length,
    mean,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    values: sorted,
  };
}

export function computeMedian(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function getBenchmarkPsf(
  listings: PsfAggregates | null,
  transactions: PsfAggregates | null,
  benchmark: "transactionMedianPsf" | "listingMedianPsf"
): number | null {
  if (benchmark === "transactionMedianPsf") {
    if (transactions && transactions.count > 0) return transactions.median;
    if (listings && listings.count > 0) return listings.median;
    return null;
  }

  if (benchmark === "listingMedianPsf") {
    if (listings && listings.count > 0) return listings.median;
    if (transactions && transactions.count > 0) return transactions.median;
    return null;
  }

  return null;
}
