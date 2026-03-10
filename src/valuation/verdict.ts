import type { ValuationEngineConfig, VerdictLabel } from "./types";

export function computeVerdict(
  clientPsf: number,
  benchmarkPsf: number,
  thresholds: ValuationEngineConfig["thresholds"]
): { verdict: VerdictLabel; ratio: number } {
  const ratio = clientPsf / benchmarkPsf;

  let verdict: VerdictLabel;

  if (ratio < thresholds.below_market) {
    verdict = "BELOW_MARKET";
  } else if (ratio <= thresholds.aligned_max) {
    verdict = "ALIGNED";
  } else if (ratio <= thresholds.slightly_above_max) {
    verdict = "SLIGHTLY_ABOVE";
  } else {
    verdict = "ABOVE_MARKET";
  }

  return { verdict, ratio };
}

export function generateExplanations(
  clientPsf: number,
  benchmarkPsf: number,
  ratio: number,
  verdict: VerdictLabel,
  listingCount: number,
  transactionCount: number,
  areaTolerancePct: number
): string[] {
  const explanations: string[] = [];
  const clientPsfFormatted = clientPsf.toFixed(0);
  const benchmarkPsfFormatted = benchmarkPsf.toFixed(0);
  const ratioPercent = ((ratio - 1) * 100).toFixed(1);

  explanations.push(
    `Analysis based on ${listingCount} listing(s) and ${transactionCount} transaction(s) within ±${areaTolerancePct}% area tolerance.`
  );

  explanations.push(`Your property's price per sqft: AED ${clientPsfFormatted}`);

  explanations.push(`Market benchmark PSF: AED ${benchmarkPsfFormatted}`);

  switch (verdict) {
    case "BELOW_MARKET":
      explanations.push(
        `Your asking price is ${Math.abs(parseFloat(ratioPercent)).toFixed(1)}% below market — this is a competitive price.`
      );
      break;
    case "ALIGNED":
      explanations.push(
        `Your asking price aligns well with current market data (${parseFloat(ratioPercent) >= 0 ? "+" : ""}${ratioPercent}% vs. benchmark).`
      );
      break;
    case "SLIGHTLY_ABOVE":
      explanations.push(
        `Your asking price is ${parseFloat(ratioPercent).toFixed(1)}% above the market benchmark. Minor negotiation may be expected.`
      );
      break;
    case "ABOVE_MARKET":
      explanations.push(
        `Your asking price is ${parseFloat(ratioPercent).toFixed(1)}% above market. Consider adjusting your price for better market reception.`
      );
      break;
    case "INSUFFICIENT_DATA":
      explanations.push("Insufficient comparable data found for a reliable valuation.");
      break;
  }

  return explanations;
}
