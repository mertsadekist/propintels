// ── Backward-compatibility re-export ────────────────────────────────────────
// All consumers should import from ./analytics-filters directly.
// This file is kept so old imports don't break during migration.

export type { AnalyticsFilters } from "./analytics-filters";
export { EMPTY_FILTERS, AnalyticsFiltersBar as FiltersBar, filtersToParams } from "./analytics-filters";
