"use client";

import { useState } from "react";
import { AnalyticsFiltersBar, EMPTY_FILTERS, type AnalyticsFilters } from "./analytics-filters";
import { PriceMatrixBox } from "./price-matrix-box";

export function PriceMatrixPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>(EMPTY_FILTERS);

  return (
    <div className="space-y-5">
      <AnalyticsFiltersBar onApply={setFilters} />
      <PriceMatrixBox filters={filters} />
    </div>
  );
}
