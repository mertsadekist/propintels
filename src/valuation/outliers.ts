/**
 * Remove top and bottom X% of values (default: 10% each side)
 */
export function trimOutliers(values: number[], pct: number = 10): number[] {
  if (values.length < 4) return values;

  const sorted = [...values].sort((a, b) => a - b);
  const cutCount = Math.floor(sorted.length * (pct / 100));

  if (cutCount === 0) return sorted;

  return sorted.slice(cutCount, sorted.length - cutCount);
}

/**
 * Remove values outside 1.5 * IQR
 */
export function removeByIQR(values: number[]): number[] {
  if (values.length < 4) return values;

  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  const iqr = q3 - q1;

  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;

  return sorted.filter((v) => v >= lower && v <= upper);
}

/**
 * Apply outlier removal method based on config
 */
export function applyOutlierFilter(
  values: number[],
  method: "trim10" | "iqr"
): number[] {
  if (values.length === 0) return [];

  switch (method) {
    case "trim10":
      return trimOutliers(values, 10);
    case "iqr":
      return removeByIQR(values);
    default:
      return values;
  }
}

function percentile(sorted: number[], p: number): number {
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sorted.length) return sorted[sorted.length - 1];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
