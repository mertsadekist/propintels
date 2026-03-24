"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnalyticsFiltersBar, EMPTY_FILTERS, type AnalyticsFilters, filtersToParams } from "./analytics-filters";
import { PriceTrendChart } from "./price-trend-chart";
import { TrendDrillDown } from "./trend-drill-down";
import { QuarterlyTrendChart } from "./quarterly-trend-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface WeeklyTrendRow {
  yr: number; wk: number; label: string;
  txnCount: number; txnMedianPsf: number; txnAvgPsf: number;
  txnMinPsf: number; txnMaxPsf: number;
  changePct: number | null; qoqPct: number | null;
}

interface TopArea {
  area: string; txnCount: number; txnMedianPsf: number;
  listingCount: number; listingAvgPsf: number; diffPct: number | null;
}

export function MarketTrendsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>(EMPTY_FILTERS);
  const [weekly,   setWeekly]   = useState<WeeklyTrendRow[]>([]);
  const [topAreas, setTopAreas] = useState<TopArea[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [drillLabel, setDrillLabel] = useState("");
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchData = useCallback(async (f: AnalyticsFilters, drillArea = "", drillProjectId = "") => {
    setLoading(true);
    setError(null);
    try {
      const sp = filtersToParams(f);
      if (drillArea)      sp.set("area",      drillArea);
      if (drillProjectId) sp.set("projectId", drillProjectId);
      const res  = await fetch(`/api/analytics/market?${sp}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setWeekly(json.data.weeklyTrends ?? []);
      setTopAreas(json.data.topAreas ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally     { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(EMPTY_FILTERS); }, [fetchData]);

  const handleApply = (f: AnalyticsFilters) => { setFilters(f); fetchData(f); };
  const handleDrillApply = (area: string, pid: string) => {
    setDrillLabel(pid ? `${area} — project` : area);
    fetchData(filtersRef.current, area, pid);
  };
  const handleDrillClear = () => { setDrillLabel(""); fetchData(filtersRef.current); };

  return (
    <div className="space-y-5">
      <AnalyticsFiltersBar onApply={handleApply} />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* Weekly Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Weekly Price Trends (Median PSF)
            {drillLabel && <span className="ml-2 text-sm font-normal text-blue-600">— {drillLabel}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TrendDrillDown
            topAreas={topAreas}
            onApply={handleDrillApply}
            onClear={handleDrillClear}
          />
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
            </div>
          ) : (
            <PriceTrendChart data={weekly} />
          )}
        </CardContent>
      </Card>

      {/* Quarterly Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Quarterly Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
            </div>
          ) : (
            <QuarterlyTrendChart data={weekly} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
