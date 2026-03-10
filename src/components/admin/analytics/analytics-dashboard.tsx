"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiltersBar, type AnalyticsFilters } from "./filters-bar";
import { PriceTrendChart } from "./price-trend-chart";
import { TrendDrillDown } from "./trend-drill-down";
import { MarketIntelligence } from "./market-intelligence";
import { AreaComparisonTable, type AreaSortBy, type SortDir } from "./area-comparison-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileDown, TrendingUp, TrendingDown, Minus } from "lucide-react";

const SQM_TO_SQFT = 10.7639;

interface AnalyticsSummary {
  totalTransactions: number;
  totalListings: number;
  overallMedianPsf: number;
  overallAvgDealSize: number;
  periodsCount: number;
  wowChange: number | null;
  qoqChange: number | null;
}

interface TopArea {
  area: string;
  txnCount: number;
  txnMedianPsf: number;
  listingCount: number;
  listingAvgPsf: number;
  diffPct: number | null;
}

interface WeeklyTrendRow {
  yr: number;
  wk: number;
  label: string;
  txnCount: number;
  txnMedianPsf: number;
  txnAvgPsf: number;
  txnMinPsf: number;
  txnMaxPsf: number;
  changePct: number | null;
  qoqPct: number | null;
}

interface AreaRow {
  area: string;
  txnCount: number;
  txnMedianPsf: number;
  txnMinPsf: number;
  txnMaxPsf: number;
  listingCount: number;
  listingAvgPsf: number;
  diffPct: number | null;
}

function fmtN(n: number) {
  return n.toLocaleString("en-AE", { maximumFractionDigits: 0 });
}

function WoWIndicator({ pct }: { pct: number | null }) {
  if (pct === null) return <Minus className="h-4 w-4 text-gray-400" />;
  if (pct > 0)
    return (
      <span className="flex items-center gap-1 text-red-600 font-semibold text-sm">
        <TrendingUp className="h-4 w-4" />+{pct.toFixed(1)}%
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-blue-600 font-semibold text-sm">
      <TrendingDown className="h-4 w-4" />
      {pct.toFixed(1)}%
    </span>
  );
}

export function AnalyticsDashboard() {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    area: "",
    propertyType: "",
    bedrooms: "",
    category: "",
    dateFrom: "",
    dateTo: "",
  });

  // Market data state
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [weeklyTrends, setWeeklyTrends] = useState<WeeklyTrendRow[]>([]);
  const [topAreas, setTopAreas] = useState<TopArea[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);

  // Area breakdown state
  const [areaData, setAreaData] = useState<AreaRow[]>([]);
  const [areaTotal, setAreaTotal] = useState(0);
  const [areaPage, setAreaPage] = useState(1);
  const areaPageSize = 20;
  const [areaSortBy, setAreaSortBy] = useState<AreaSortBy>("txnCount");
  const [areaSortDir, setAreaSortDir] = useState<SortDir>("desc");
  const [areaLoading, setAreaLoading] = useState(true);

  // Trend drill-down state
  const [drillLabel, setDrillLabel] = useState("");

  const [generating, setGenerating] = useState(false);

  // Keep latest filters ref to avoid stale closures
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchMarketData = useCallback(
    async (f: AnalyticsFilters, drillArea: string, drillProjectId: string) => {
      setMarketLoading(true);
      setMarketError(null);
      try {
        const sp = new URLSearchParams();
        if (f.area) sp.set("area", f.area);
        if (f.propertyType) sp.set("propertyType", f.propertyType);
        if (f.bedrooms) sp.set("bedrooms", f.bedrooms);
        if (f.category) sp.set("category", f.category);
        if (f.dateFrom) sp.set("dateFrom", f.dateFrom);
        if (f.dateTo) sp.set("dateTo", f.dateTo);
        if (drillArea) sp.set("area", drillArea);
        if (drillProjectId) sp.set("projectId", drillProjectId);

        const res = await fetch(`/api/analytics/market?${sp.toString()}`);
        if (!res.ok) throw new Error("Failed to load market data");
        const json = await res.json();
        setSummary(json.data.summary);
        setWeeklyTrends(json.data.weeklyTrends ?? []);
        setTopAreas(json.data.topAreas ?? []);
      } catch (e) {
        setMarketError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setMarketLoading(false);
      }
    },
    []
  );

  const fetchAreaData = useCallback(
    async (
      f: AnalyticsFilters,
      pg: number,
      sb: AreaSortBy,
      sd: SortDir
    ) => {
      setAreaLoading(true);
      try {
        const sp = new URLSearchParams();
        if (f.area) sp.set("area", f.area);
        if (f.propertyType) sp.set("propertyType", f.propertyType);
        if (f.bedrooms) sp.set("bedrooms", f.bedrooms);
        if (f.category) sp.set("category", f.category);
        if (f.dateFrom) sp.set("dateFrom", f.dateFrom);
        if (f.dateTo) sp.set("dateTo", f.dateTo);
        sp.set("page", String(pg));
        sp.set("pageSize", String(areaPageSize));
        sp.set("sortBy", sb);
        sp.set("sortDir", sd);

        const res = await fetch(`/api/analytics/areas-breakdown?${sp.toString()}`);
        if (!res.ok) throw new Error("Failed to load area data");
        const json = await res.json();
        setAreaData(json.data ?? []);
        setAreaTotal(json.meta?.total ?? 0);
      } catch {
        // silently handle — main error shown from market fetch
      } finally {
        setAreaLoading(false);
      }
    },
    [areaPageSize]
  );

  // Initial load
  useEffect(() => {
    fetchMarketData(filters, "", "");
    fetchAreaData(filters, 1, "txnCount", "desc");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApply = (f: AnalyticsFilters) => {
    setFilters(f);
    setAreaPage(1);
    setDrillLabel("");
    fetchMarketData(f, "", "");
    fetchAreaData(f, 1, areaSortBy, areaSortDir);
  };

  const handleAreaPageChange = (pg: number) => {
    setAreaPage(pg);
    fetchAreaData(filtersRef.current, pg, areaSortBy, areaSortDir);
  };

  const handleAreaSortChange = (key: AreaSortBy) => {
    const newDir: SortDir =
      key === areaSortBy ? (areaSortDir === "asc" ? "desc" : "asc") : "desc";
    setAreaSortBy(key);
    setAreaSortDir(newDir);
    setAreaPage(1);
    fetchAreaData(filtersRef.current, 1, key, newDir);
  };

  const handleDrillApply = (area: string, projectId: string) => {
    setDrillLabel(projectId ? `${area} — project filtered` : area);
    fetchMarketData(filtersRef.current, area, projectId);
  };

  const handleDrillClear = () => {
    setDrillLabel("");
    fetchMarketData(filtersRef.current, "", "");
  };

  const handleFilterByArea = (area: string) => {
    const newFilters = { ...filtersRef.current, area };
    setFilters(newFilters);
    setAreaPage(1);
    setDrillLabel("");
    fetchMarketData(newFilters, "", "");
    fetchAreaData(newFilters, 1, areaSortBy, areaSortDir);
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const body: Record<string, unknown> = {};
      if (filters.area) body.area = filters.area;
      if (filters.propertyType) body.propertyType = filters.propertyType;
      if (filters.bedrooms) body.bedrooms = parseInt(filters.bedrooms);
      if (filters.category) body.category = filters.category;
      if (filters.dateFrom) body.dateFrom = filters.dateFrom;
      if (filters.dateTo) body.dateTo = filters.dateTo;

      const res = await fetch("/api/analytics/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message ?? "Failed to generate report");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition");
      const match = cd?.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? "market-report.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Report generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <FiltersBar onApply={handleApply} />

      {/* Actions */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateReport}
          disabled={generating || marketLoading}
          className="gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Generating PDF...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4" /> Generate Report
            </>
          )}
        </Button>
      </div>

      {marketError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {marketError}
        </div>
      )}

      {marketLoading && !summary ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : summary ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Transactions
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {fmtN(summary.totalTransactions)}
                </div>
                {summary.totalListings > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    {fmtN(summary.totalListings)} listings
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Median PSF</div>
                <div className="text-2xl font-bold text-gray-900">
                  {fmtN(summary.overallMedianPsf)}
                  <span className="text-sm font-normal text-gray-400 ml-1">AED/sqft</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {fmtN(Math.round(summary.overallMedianPsf * SQM_TO_SQFT))} AED/sqm
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Avg Deal Size
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  AED{" "}
                  {summary.overallAvgDealSize >= 1_000_000
                    ? `${(summary.overallAvgDealSize / 1_000_000).toFixed(1)}M`
                    : fmtN(summary.overallAvgDealSize)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Latest WoW Change
                </div>
                <div className="text-2xl font-bold">
                  <WoWIndicator pct={summary.wowChange} />
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {summary.periodsCount} weeks tracked
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Market Intelligence */}
          {topAreas.length > 0 && (
            <MarketIntelligence topAreas={topAreas} onFilterByArea={handleFilterByArea} />
          )}

          {/* Weekly Price Trends + Drill-Down */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Weekly Price Trends (Median PSF)
                {drillLabel && (
                  <span className="ml-2 text-sm font-normal text-blue-600">— {drillLabel}</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TrendDrillDown
                topAreas={topAreas}
                onApply={handleDrillApply}
                onClear={handleDrillClear}
              />
              {marketLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
                </div>
              ) : (
                <PriceTrendChart data={weeklyTrends} />
              )}
            </CardContent>
          </Card>

          {/* Area Comparison Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Area Price Comparison
                {areaTotal > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-400">
                    {fmtN(areaTotal)} areas total
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {areaLoading && areaData.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
                </div>
              ) : (
                <AreaComparisonTable
                  data={areaData}
                  total={areaTotal}
                  page={areaPage}
                  pageSize={areaPageSize}
                  sortBy={areaSortBy}
                  sortDir={areaSortDir}
                  loading={areaLoading}
                  onPageChange={handleAreaPageChange}
                  onSortChange={handleAreaSortChange}
                />
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
