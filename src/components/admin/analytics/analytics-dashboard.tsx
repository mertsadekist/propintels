"use client";

import { useCallback, useEffect, useState } from "react";
import { AnalyticsFiltersBar, EMPTY_FILTERS, type AnalyticsFilters, filtersToParams } from "./analytics-filters";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import Link from "next/link";

const SQM_TO_SQFT = 10.7639;

interface AnalyticsSummary {
  totalTransactions: number;
  totalListings:     number;
  overallMedianPsf:  number;
  overallAvgDealSize:number;
  periodsCount:      number;
  wowChange:         number | null;
  qoqChange:         number | null;
}

interface TopArea {
  area:          string;
  txnCount:      number;
  txnMedianPsf:  number;
  listingCount:  number;
  listingAvgPsf: number;
  diffPct:       number | null;
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
      <TrendingDown className="h-4 w-4" />{pct.toFixed(1)}%
    </span>
  );
}

const QUICK_LINKS = [
  { label: "Price Matrix",       href: "/admin/analytics/price-matrix",    desc: "Area × Bedroom heatmap",          color: "bg-blue-50   text-blue-700   border-blue-200"   },
  { label: "Market Trends",      href: "/admin/analytics/market-trends",   desc: "Weekly PSF trend chart",           color: "bg-green-50  text-green-700  border-green-200"  },
  { label: "Area Comparison",    href: "/admin/analytics/area-comparison", desc: "Sortable area ranking table",      color: "bg-violet-50 text-violet-700 border-violet-200" },
  { label: "Property Mix",       href: "/admin/analytics/property-mix",    desc: "Type & Off-Plan breakdown",        color: "bg-orange-50 text-orange-700 border-orange-200" },
  { label: "Volume Tracker",     href: "/admin/analytics/volume",          desc: "Monthly transaction calendar",     color: "bg-teal-50   text-teal-700   border-teal-200"   },
  { label: "Valuation Insights", href: "/admin/analytics/valuations",      desc: "Lead funnel & verdicts",           color: "bg-pink-50   text-pink-700   border-pink-200"   },
  { label: "Price Trends",       href: "/admin/analytics/price-trends",    desc: "Price brackets over time",         color: "bg-sky-50    text-sky-700    border-sky-200"    },
  { label: "Price Changes",      href: "/admin/analytics/price-change",    desc: "YoY & MoM area price shifts",      color: "bg-red-50    text-red-700    border-red-200"    },
  { label: "Deal Segments",      href: "/admin/analytics/deal-segments",   desc: "Deal size & bedroom distribution", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
];

export function AnalyticsDashboard() {
  const [filters, setFilters] = useState<AnalyticsFilters>(EMPTY_FILTERS);

  const [summary,     setSummary]     = useState<AnalyticsSummary | null>(null);
  const [topAreas,    setTopAreas]    = useState<TopArea[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  const fetchData = useCallback(async (f: AnalyticsFilters) => {
    setLoading(true);
    setError(null);
    try {
      const sp = filtersToParams(f);
      const res = await fetch(`/api/analytics/market?${sp.toString()}`);
      if (!res.ok) throw new Error("Failed to load market data");
      const json = await res.json();
      setSummary(json.data.summary);
      setTopAreas(json.data.topAreas ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(EMPTY_FILTERS); }, [fetchData]);

  const handleApply = (f: AnalyticsFilters) => {
    setFilters(f);
    fetchData(f);
  };

  return (
    <div className="space-y-5">
      <AnalyticsFiltersBar onApply={handleApply} />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {loading && !summary ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : summary ? (
        <>
          {/* ── KPI Cards ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Transactions</div>
                <div className="text-2xl font-bold text-gray-900">{fmtN(summary.totalTransactions)}</div>
                {summary.totalListings > 0 && (
                  <div className="text-xs text-gray-400 mt-1">{fmtN(summary.totalListings)} listings</div>
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
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Avg Deal Size</div>
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
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Latest WoW</div>
                <div className="text-2xl font-bold">
                  <WoWIndicator pct={summary.wowChange} />
                </div>
                <div className="text-xs text-gray-400 mt-1">{summary.periodsCount} weeks tracked</div>
              </CardContent>
            </Card>
          </div>

          {/* ── Top Areas strip ─────────────────────────────────────────── */}
          {topAreas.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {topAreas.slice(0, 5).map((a) => (
                <Card key={a.area} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="pt-4 pb-3">
                    <div className="text-xs text-gray-400 truncate mb-1" title={a.area}>{a.area}</div>
                    <div className="text-lg font-bold text-gray-900">{fmtN(a.txnMedianPsf)}</div>
                    <div className="text-[11px] text-gray-400">AED/sqft · {fmtN(a.txnCount)} txns</div>
                    {a.diffPct !== null && (
                      <div className={`text-[11px] mt-1 font-medium ${a.diffPct > 0 ? "text-red-500" : "text-blue-500"}`}>
                        Ask {a.diffPct > 0 ? "+" : ""}{a.diffPct.toFixed(1)}% vs mkt
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ── Quick links to sub-pages ────────────────────────────────── */}
          <div>
            <h2 className="text-sm font-semibold text-gray-600 mb-3">Analytics Sections</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {QUICK_LINKS.map(({ label, href, desc, color }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-col gap-1 p-3 rounded-xl border ${color} hover:shadow-md transition-all group`}
                >
                  <span className="text-sm font-semibold leading-tight">{label}</span>
                  <span className="text-[11px] opacity-70">{desc}</span>
                  <ArrowRight className="h-3 w-3 mt-1 opacity-0 group-hover:opacity-70 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
