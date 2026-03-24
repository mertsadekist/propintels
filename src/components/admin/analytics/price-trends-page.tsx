"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from "recharts";
import {
  AnalyticsFiltersBar,
  EMPTY_FILTERS,
  filtersToParams,
  type AnalyticsFilters,
} from "./analytics-filters";

// ─── Constants ──────────────────────────────────────────────────────────────
const BRACKET_ORDER  = ["under500k","500k-1m","1m-2m","2m-5m","5m-10m","10m+"];
const BRACKET_LABELS: Record<string,string> = {
  "under500k": "<500K",
  "500k-1m":   "500K–1M",
  "1m-2m":     "1M–2M",
  "2m-5m":     "2M–5M",
  "5m-10m":    "5M–10M",
  "10m+":      "10M+",
};
const BRACKET_COLORS = ["#bfdbfe","#93c5fd","#60a5fa","#2563eb","#1d4ed8","#1e3a8a"];

const AREA_COLORS = [
  "#2563eb","#16a34a","#dc2626","#d97706","#7c3aed",
  "#0891b2","#be185d","#15803d","#b45309","#6d28d9",
];

// ─── Formatting ──────────────────────────────────────────────────────────────
function fmtM(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return String(Math.round(v));
}
function fmtN(v: number): string {
  return new Intl.NumberFormat().format(Math.round(v));
}
const MONTH_SHORT = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Types ───────────────────────────────────────────────────────────────────
interface MonthlyAreaRow { area: string; yr: number; mo: number; medianPrice: number; txnCount: number; }
interface BracketRow     { bracket: string; txnCount: number; totalValue: number; }
interface AreaRankRow    { area: string; medianPrice: number; maxPrice: number; minPrice: number; txnCount: number; }
interface QtrAreaRow     { area: string; yr: number; qtr: number; medianPrice: number; txnCount: number; }

interface ApiData {
  monthlyByArea:  MonthlyAreaRow[];
  brackets:       BracketRow[];
  areaRanking:    AreaRankRow[];
  quarterlyTable: QtrAreaRow[];
}

// ─── Component ───────────────────────────────────────────────────────────────
export function PriceTrendsPage() {
  const [filters, setFilters]   = useState<AnalyticsFilters>(EMPTY_FILTERS);
  const [data, setData]         = useState<ApiData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const fetchData = useCallback(async (f: AnalyticsFilters) => {
    setLoading(true);
    setError(null);
    try {
      const sp = filtersToParams(f);
      const res = await fetch(`/api/analytics/price-trends?${sp}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(EMPTY_FILTERS); }, [fetchData]);

  function handleApply(f: AnalyticsFilters) {
    setFilters(f);
    fetchData(f);
  }

  // ── Chart 1: Pivot monthlyByArea → line chart data ────────────────────
  const lineData = (() => {
    if (!data) return { series: [] as string[], points: [] as Record<string,number|string>[] };
    // top 8 areas by total txnCount
    const areaTotal: Record<string,number> = {};
    for (const r of data.monthlyByArea) areaTotal[r.area] = (areaTotal[r.area]||0) + r.txnCount;
    const topAreas = Object.entries(areaTotal)
      .sort((a,b) => b[1]-a[1])
      .slice(0,8)
      .map(([a]) => a);

    const pointMap: Record<string, Record<string,number>> = {};
    for (const r of data.monthlyByArea) {
      if (!topAreas.includes(r.area)) continue;
      const key = `${r.yr}-${String(r.mo).padStart(2,"0")}`;
      if (!pointMap[key]) pointMap[key] = {};
      pointMap[key][r.area] = r.medianPrice;
    }
    const points = Object.entries(pointMap)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([key, vals]) => {
        const [yr,mo] = key.split("-");
        return { label: `${MONTH_SHORT[Number(mo)]} ${String(yr).slice(2)}`, ...vals };
      });
    return { series: topAreas, points };
  })();

  // ── Chart 2: brackets sorted ──────────────────────────────────────────
  const sortedBrackets = data
    ? [...data.brackets].sort((a,b) => BRACKET_ORDER.indexOf(a.bracket) - BRACKET_ORDER.indexOf(b.bracket))
    : [];

  // ── Chart 3: area ranking top 15 ─────────────────────────────────────
  const areaRanking = data
    ? [...data.areaRanking].slice(0,15).map((r) => ({ ...r, areaShort: r.area.length>22 ? r.area.slice(0,20)+"…" : r.area }))
    : [];

  // ── Chart 4: quarterly table ──────────────────────────────────────────
  const qtrData = (() => {
    if (!data) return { cols: [] as string[], rows: [] as { area: string; cells: Record<string,number|null> }[] };
    const colSet = new Set<string>();
    const areaMap: Record<string, Record<string,number>> = {};
    const areaTotalTxn: Record<string,number> = {};
    for (const r of data.quarterlyTable) {
      const col = `${r.yr}-Q${r.qtr}`;
      colSet.add(col);
      if (!areaMap[r.area]) areaMap[r.area] = {};
      areaMap[r.area][col] = r.medianPrice;
      areaTotalTxn[r.area] = (areaTotalTxn[r.area]||0) + r.txnCount;
    }
    // last 8 quarters max, sorted
    const cols = Array.from(colSet).sort().slice(-8);
    // top 20 areas by total txnCount
    const topAreas = Object.entries(areaTotalTxn)
      .sort((a,b)=>b[1]-a[1]).slice(0,20).map(([a])=>a);
    const globalMax = Math.max(...Object.values(areaMap).flatMap((m)=>Object.values(m)));
    const rows = topAreas.map((area) => ({
      area,
      cells: Object.fromEntries(cols.map((c) => [c, areaMap[area]?.[c] ?? null])) as Record<string,number|null>,
    }));
    return { cols, rows, globalMax };
  })();

  const totalDeals  = data ? data.brackets.reduce((s,r)=>s+r.txnCount,0) : 0;
  const totalVolume = data ? data.brackets.reduce((s,r)=>s+r.totalValue,0) : 0;

  return (
    <div className="space-y-6">
      <AnalyticsFiltersBar initial={filters} onApply={handleApply} />

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* KPI row */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Transactions", value: fmtN(totalDeals) },
            { label: "Total Volume",       value: `AED ${fmtM(totalVolume)}` },
            { label: "Areas Tracked",      value: String(data.areaRanking.length) },
            { label: "Median Deal Size",   value: data.areaRanking.length ? `AED ${fmtM(data.areaRanking.reduce((s,r)=>s+r.medianPrice,0)/data.areaRanking.length)}` : "—" },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500">{k.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Chart 1: Monthly median price by area */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Median Deal Price by Area (AED)</h3>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
        ) : lineData.points.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineData.points} margin={{ top:4, right:16, bottom:4, left:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize:11 }} />
              <YAxis tickFormatter={(v) => `AED ${fmtM(Number(v)||0)}`} tick={{ fontSize:11 }} width={80} />
              <Tooltip formatter={(v, name) => [`AED ${fmtM(Number(v)||0)}`, String(name||"")]} />
              <Legend />
              {lineData.series.map((area, i) => (
                <Line
                  key={area}
                  type="monotone"
                  dataKey={area}
                  stroke={AREA_COLORS[i % AREA_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chart 2: Price distribution histogram */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Price Bracket Distribution</h3>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
          ) : sortedBrackets.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sortedBrackets.map((r) => ({ ...r, label: BRACKET_LABELS[r.bracket]||r.bracket }))}
                  margin={{ top:4, right:8, bottom:4, left:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize:11 }} />
                  <YAxis tickFormatter={(v) => fmtN(Number(v)||0)} tick={{ fontSize:11 }} width={60} />
                  <Tooltip formatter={(v, name) => [fmtN(Number(v)||0) + " deals", String(name||"")]} />
                  <Bar dataKey="txnCount" name="Deals" radius={[3,3,0,0]}>
                    {sortedBrackets.map((_,i) => (
                      <Cell key={i} fill={BRACKET_COLORS[i % BRACKET_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Summary rows */}
              <div className="mt-3 space-y-1">
                {sortedBrackets.map((r, i) => (
                  <div key={r.bracket} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: BRACKET_COLORS[i%BRACKET_COLORS.length] }} />
                    <span className="w-20">{BRACKET_LABELS[r.bracket]||r.bracket}</span>
                    <span className="font-medium">{fmtN(r.txnCount)} deals</span>
                    <span className="text-gray-400">· AED {fmtM(r.totalValue)}</span>
                    <span className="ml-auto text-gray-400">{totalDeals>0 ? ((r.txnCount/totalDeals)*100).toFixed(1) : "0"}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Chart 3: Area ranking horizontal bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Area Ranking by Median Deal Size</h3>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
          ) : areaRanking.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                layout="vertical"
                data={areaRanking}
                margin={{ top:4, right:50, bottom:4, left:0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${fmtM(Number(v)||0)}`} tick={{ fontSize:10 }} />
                <YAxis type="category" dataKey="areaShort" tick={{ fontSize:10 }} width={130} />
                <Tooltip
                  formatter={(v, name) => [`AED ${fmtM(Number(v)||0)}`, String(name||"")]}
                  labelFormatter={(l) => String(l)}
                />
                <Bar dataKey="medianPrice" name="Median Price" fill="#2563eb" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Chart 4: Quarterly median price table (heatmap) */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Quarterly Median Deal Price by Area (AED)</h3>
        <p className="text-xs text-gray-400 mb-4">Color intensity = deal size relative to overall maximum</p>
        {loading ? (
          <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
        ) : qtrData.rows.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-gray-400 text-sm">No data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 bg-gray-50 border border-gray-200 font-medium text-gray-600 sticky left-0 z-10 min-w-[140px]">
                    Area
                  </th>
                  {qtrData.cols.map((col) => (
                    <th key={col} className="p-2 bg-gray-50 border border-gray-200 font-medium text-gray-600 text-center whitespace-nowrap min-w-[90px]">
                      {col.replace("-Q", " Q")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {qtrData.rows.map((row) => {
                  const rowMax = Math.max(...Object.values(row.cells).filter((v): v is number => v !== null));
                  return (
                    <tr key={row.area} className="hover:bg-gray-50">
                      <td className="p-2 border border-gray-200 font-medium text-gray-700 sticky left-0 bg-white">
                        {row.area}
                      </td>
                      {qtrData.cols.map((col) => {
                        const val = row.cells[col];
                        const opacity = val != null && rowMax > 0 ? 0.08 + (val/rowMax)*0.62 : 0;
                        return (
                          <td
                            key={col}
                            className="p-2 border border-gray-200 text-center"
                            style={{ background: val != null ? `rgba(37,99,235,${opacity})` : "transparent" }}
                          >
                            {val != null ? (
                              <span className={opacity > 0.4 ? "text-white font-medium" : "text-gray-800"}>
                                {fmtM(val)}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
