export const DEFAULT_VALUATION_RULES = {
  areaTolerancePct: 15,
  outlierMethod: "trim10" as "trim10" | "iqr",
  minComps: 3,
  benchmark: "transactionMedianPsf" as "transactionMedianPsf" | "listingMedianPsf",
  thresholds: {
    below_market: 0.95,
    aligned_max: 1.03,
    slightly_above_max: 1.10,
  },
};

export const DEFAULT_BRANDING = {
  companyName: "IST Real Estate",
  primaryColor: "#0B1F3B",
  accentColor: "#C9A96E",
  disclaimer:
    "This valuation is an estimate based on available comparable data and is not an official appraisal.",
};
