import type { ClientInput, ComparableEntry, ValuationEngineConfig } from "./types";

/**
 * In Dubai DLD data, villa/townhouse/duplex plots are often recorded as LAND.
 * These are treated as equivalent for valuation matching purposes.
 */
const VILLA_LIKE_TYPES = ["VILLA", "TOWNHOUSE", "DUPLEX", "PENTHOUSE"];

function isPropertyTypeMatch(compType: string, clientType: string): boolean {
  if (compType === clientType) return true;
  // LAND is treated as equivalent to villa-like types in DLD transaction data
  if (VILLA_LIKE_TYPES.includes(clientType) && compType === "LAND") return true;
  return false;
}

/**
 * Filter comparables to only those that match the subject property.
 * First attempt: strict match. If too few found, relax bedroom filter.
 */
export function filterComparables(
  comparables: ComparableEntry[],
  client: ClientInput,
  config: ValuationEngineConfig
): { listings: ComparableEntry[]; transactions: ComparableEntry[] } {
  const { areaTolerancePct } = config;
  const toleranceFraction = areaTolerancePct / 100;

  const baseFilter = (comp: ComparableEntry, strictBedrooms: boolean) => {
    // If the comparable is from the same project as the lead, skip the property type check.
    // Reason: DLD often records under-construction villa/townhouse units as LAND because
    // the plot is sold during off-plan stage. We trust same-project entries regardless of type.
    const isSameProject =
      !!client.projectId && !!comp.projectId && comp.projectId === client.projectId;

    if (!isSameProject && !isPropertyTypeMatch(comp.propertyType, client.propertyType)) return false;

    // Bedrooms must match if specified (strict mode)
    if (strictBedrooms && client.bedrooms !== null && client.bedrooms !== undefined) {
      if (comp.bedrooms !== null && comp.bedrooms !== client.bedrooms) return false;
    }

    // For same-project comps we skip the area size tolerance check.
    // DLD records under-construction transactions as LAND, where transactionAreaSqft
    // is the PLOT area (e.g. 2,000 sqft), not the built-up area (e.g. 1,208 sqft).
    // The bedroom filter above already provides sufficient unit-level granularity.
    if (!isSameProject) {
      // Area size tolerance check for listings
      if (comp.sourceType === "LISTING" && comp.areaSqft) {
        const lower = client.areaSqft * (1 - toleranceFraction);
        const upper = client.areaSqft * (1 + toleranceFraction);
        if (comp.areaSqft < lower || comp.areaSqft > upper) return false;
      }

      // Area size tolerance check for transactions
      if (comp.sourceType === "TRANSACTION" && comp.transactionAreaSqft) {
        const lower = client.areaSqft * (1 - toleranceFraction);
        const upper = client.areaSqft * (1 + toleranceFraction);
        if (comp.transactionAreaSqft < lower || comp.transactionAreaSqft > upper) return false;
      }
    }

    return true;
  };

  // Try strict match first (bedrooms required)
  let matched = comparables.filter((c) => baseFilter(c, true));

  // If not enough comps, relax bedroom requirement
  if (matched.length < config.minComps) {
    const relaxed = comparables.filter((c) => baseFilter(c, false));
    if (relaxed.length > matched.length) {
      matched = relaxed;
    }
  }

  return {
    listings: matched.filter((c) => c.sourceType === "LISTING"),
    transactions: matched.filter((c) => c.sourceType === "TRANSACTION"),
  };
}

/**
 * Extract the primary PSF value from a comparable
 */
export function extractPsf(comp: ComparableEntry): number | null {
  if (comp.sourceType === "LISTING") {
    return comp.askPsf ?? null;
  }
  if (comp.sourceType === "TRANSACTION") {
    return comp.transactionPsf ?? null;
  }
  return null;
}
