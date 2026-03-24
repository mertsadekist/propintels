"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnalyticsFiltersBar, EMPTY_FILTERS, type AnalyticsFilters, filtersToParams } from "./analytics-filters";
import { AreaComparisonTable, type AreaSortBy, type SortDir } from "./area-comparison-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";

interface AreaRow {
  area: string;
  txnCount: number; txnMedianPsf: number; txnMinPsf: number; txnMaxPsf: number;
  listingCount: number; listingAvgPsf: number; diffPct: number | null;
}

function fmtN(n: number) { return n.toLocaleString("en-AE", { maximumFractionDigits: 0 }); }

export function AreaComparisonPageWrapper() {
  const [filters,   setFilters]   = useState<AnalyticsFilters>(EMPTY_FILTERS);
  const [areaData,  setAreaData]  = useState<AreaRow[]>([]);
  const [areaTotal, setAreaTotal] = useState(0);
  const [areaPage,  setAreaPage]  = useState(1);
  const [sortBy,    setSortBy]    = useState<AreaSortBy>("txnCount");
  const [sortDir,   setSortDir]   = useState<SortDir>("desc");
  const [loading,   setLoading]   = useState(true);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const PAGE_SIZE = 20;

  const fetchData = useCallback(async (
    f: AnalyticsFilters, pg: number, sb: AreaSortBy, sd: SortDir
  ) => {
    setLoading(true);
    try {
      const sp = filtersToParams(f);
      sp.set("page", String(pg));
      sp.set("pageSize", String(PAGE_SIZE));
      sp.set("sortBy", sb);
      sp.set("sortDir", sd);
      const res  = await fetch(`/api/analytics/areas-breakdown?${sp}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setAreaData(json.data ?? []);
      setAreaTotal(json.meta?.total ?? 0);
    } catch { /* silently */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(EMPTY_FILTERS, 1, "txnCount", "desc"); }, [fetchData]);

  const handleApply = (f: AnalyticsFilters) => {
    setFilters(f); setAreaPage(1);
    fetchData(f, 1, sortBy, sortDir);
  };

  const handlePageChange = (pg: number) => {
    setAreaPage(pg); fetchData(filtersRef.current, pg, sortBy, sortDir);
  };

  const handleSortChange = (key: AreaSortBy) => {
    const nd: SortDir = key === sortBy ? (sortDir === "asc" ? "desc" : "asc") : "desc";
    setSortBy(key); setSortDir(nd); setAreaPage(1);
    fetchData(filtersRef.current, 1, key, nd);
  };

  // CSV export
  const handleExport = () => {
    const headers = ["Area","Txn Count","Median PSF","Min PSF","Max PSF","Listing Count","Ask PSF","Ask vs Mkt %"];
    const rows = areaData.map((r) => [
      r.area, r.txnCount, r.txnMedianPsf, r.txnMinPsf, r.txnMaxPsf,
      r.listingCount, r.listingAvgPsf, r.diffPct ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "area-comparison.csv";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <AnalyticsFiltersBar onApply={handleApply} />

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Area Price Comparison
              {areaTotal > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-400">
                  {fmtN(areaTotal)} areas total
                </span>
              )}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleExport} className="h-7 text-xs gap-1">
              <Download className="h-3 w-3" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && areaData.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
            </div>
          ) : (
            <AreaComparisonTable
              data={areaData}
              total={areaTotal}
              page={areaPage}
              pageSize={PAGE_SIZE}
              sortBy={sortBy}
              sortDir={sortDir}
              loading={loading}
              onPageChange={handlePageChange}
              onSortChange={handleSortChange}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
