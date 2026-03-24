"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart, Bar, Cell,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine,
  LabelList,
} from "recharts";
import {
  AnalyticsFiltersBar,
  EMPTY_FILTERS,
  filtersToParams,
  type AnalyticsFilters,
} from "./analytics-filters";

// ─── Constants ───────────────────────────────────────────────────────────────
const AREA_COLORS = [
  "#2563eb","#16a34a","#dc2626","#d97706","#7c3aed",
  "#0891b2","#be185d","#15803d","#b45309","#6d28d9",
];

// ─── Formatting ───────────────────────────────────────────────────────────────
function fmtM(v: number): string {
  if (v >= 1_000_000) return `${(v/1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v/1_000).toFixed(0)}K`;
  return String(Math.round(v));
}
function fmtN(v: number): string { return new Intl.NumberFormat().format(Math.round(v)); }
function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}
function pctColor(v: number | null): string {
  if (v == null) return "text-gray-400";
  if (v > 2)   return "text-green-700";
  if (v < -2)  return "text-red-700";
  return "text-gray-700";
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface AreaQtrRow     { area: string; yr: number; qtr: number; medianPrice: number; txnCount: number; }
interface ProjectQtrRow  { projectName: string; area: string; yr: number; qtr: number; medianPrice: number; txnCount: number; }

interface ApiData {
  areaQuarterly:    AreaQtrRow[];
  projectQuarterly: ProjectQtrRow[];
}

type SortCol = "projectName" | "area" | "latestPrice" | "yoyPct" | "qoqPct" | "txnCount";

// ─── Derived helpers ──────────────────────────────────────────────────────────
function buildQtrKey(yr: number, qtr: number) { return `${yr}-Q${qtr}`; }

function computeChange(current: number | undefined, prior: number | undefined): number | null {
  if (!current || !prior || prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function PriceChangePage() {
  const [filters, setFilters]       = useState<AnalyticsFilters>(EMPTY_FILTERS);
  const [data, setData]             = useState<ApiData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [sort, setSort]             = useState<{ col: SortCol; dir: "asc"|"desc" }>({ col: "yoyPct", dir: "desc" });

  const fetchData = useCallback(async (f: AnalyticsFilters) => {
    setLoading(true);
    setError(null);
    try {
      const sp  = filtersToParams(f);
      const res = await fetch(`/api/analytics/price-change?${sp}`);
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

  // ── Build area map: area → qtrKey → medianPrice ────────────────────────
  const { areaQtrMap, allQtrKeys, topAreasByTxn, areaTotalTxn } = useMemo(() => {
    if (!data) return { areaQtrMap: {}, allQtrKeys: [], topAreasByTxn: [], areaTotalTxn: {} };
    const areaQtrMap: Record<string, Record<string, number>> = {};
    const areaTotalTxn: Record<string, number> = {};
    for (const r of data.areaQuarterly) {
      const key = buildQtrKey(r.yr, r.qtr);
      if (!areaQtrMap[r.area]) areaQtrMap[r.area] = {};
      areaQtrMap[r.area][key] = r.medianPrice;
      areaTotalTxn[r.area] = (areaTotalTxn[r.area]||0) + r.txnCount;
    }
    const allQtrKeys = Array.from(new Set(data.areaQuarterly.map(r => buildQtrKey(r.yr, r.qtr)))).sort();
    const topAreasByTxn = Object.entries(areaTotalTxn)
      .sort((a,b)=>b[1]-a[1]).slice(0,15).map(([a])=>a);
    return { areaQtrMap, allQtrKeys, topAreasByTxn, areaTotalTxn };
  }, [data]);

  // Last 8 quarters for display
  const displayQtrKeys = allQtrKeys.slice(-8);

  // ── YoY change per area (latest Q vs same Q prior year) ────────────────
  const yoyByArea = useMemo(() => {
    const result: Record<string, number|null> = {};
    for (const area of topAreasByTxn) {
      const map = areaQtrMap[area];
      if (!map) { result[area] = null; continue; }
      const sortedKeys = Object.keys(map).sort();
      const latestKey  = sortedKeys[sortedKeys.length-1];
      if (!latestKey) { result[area] = null; continue; }
      const [latestYr, latestQtr] = latestKey.replace("Q","").split("-").map(Number);
      const priorKey = buildQtrKey(latestYr-1, latestQtr);
      result[area] = computeChange(map[latestKey], map[priorKey]);
    }
    return result;
  }, [topAreasByTxn, areaQtrMap]);

  // ── Gainers / Losers ───────────────────────────────────────────────────
  const { gainers, losers } = useMemo(() => {
    const withYoy = topAreasByTxn
      .map((area) => ({ area, yoy: yoyByArea[area] }))
      .filter((r): r is { area: string; yoy: number } => r.yoy != null);
    const sorted = [...withYoy].sort((a,b)=>b.yoy-a.yoy);
    return { gainers: sorted.slice(0,8), losers: sorted.slice(-8).reverse() };
  }, [topAreasByTxn, yoyByArea]);

  // ── Appreciation index (base = earliest Q per area) ────────────────────
  const { indexData, indexAreas } = useMemo(() => {
    if (!data) return { indexData: [], indexAreas: [] };
    const top6 = topAreasByTxn.slice(0,6);
    const baseMap: Record<string, number> = {};
    for (const area of top6) {
      const map = areaQtrMap[area];
      if (!map) continue;
      const firstKey = Object.keys(map).sort()[0];
      if (firstKey) baseMap[area] = map[firstKey];
    }
    const points = displayQtrKeys.map((key) => {
      const pt: Record<string, string|number> = { label: key.replace("-Q"," Q") };
      for (const area of top6) {
        const base  = baseMap[area];
        const price = areaQtrMap[area]?.[key];
        if (base && price) pt[area] = +((price/base)*100).toFixed(1);
      }
      return pt;
    });
    return { indexData: points, indexAreas: top6 };
  }, [data, topAreasByTxn, areaQtrMap, displayQtrKeys]);

  // ── Project table rows ─────────────────────────────────────────────────
  const projectRows = useMemo(() => {
    if (!data) return [];
    const projectMap: Record<string, { area: string; qtrMap: Record<string,number>; totalTxn: number }> = {};
    for (const r of data.projectQuarterly) {
      if (!projectMap[r.projectName]) projectMap[r.projectName] = { area: r.area||"", qtrMap: {}, totalTxn: 0 };
      const key = buildQtrKey(r.yr, r.qtr);
      projectMap[r.projectName].qtrMap[key] = r.medianPrice;
      projectMap[r.projectName].totalTxn   += r.txnCount;
    }
    return Object.entries(projectMap).map(([name, p]) => {
      const sortedKeys = Object.keys(p.qtrMap).sort();
      const latestKey  = sortedKeys[sortedKeys.length-1];
      const latestPrice = latestKey ? p.qtrMap[latestKey] : 0;
      const [latYr, latQtr] = latestKey ? latestKey.replace("Q","").split("-").map(Number) : [0,0];
      const priorQKey = buildQtrKey(latYr, latQtr > 1 ? latQtr-1 : 4);
      const prevYearKey = latYr ? buildQtrKey(latYr-1, latQtr) : "";
      // QoQ: handle Q1 → Q4 prior year
      const qoqPrior = latQtr > 1 ? p.qtrMap[priorQKey] : p.qtrMap[buildQtrKey(latYr-1, 4)];
      return {
        projectName: name,
        area:        p.area,
        latestPrice,
        yoyPct:      computeChange(latestPrice, p.qtrMap[prevYearKey]),
        qoqPct:      computeChange(latestPrice, qoqPrior),
        txnCount:    p.totalTxn,
      };
    });
  }, [data]);

  const sortedProjectRows = useMemo(() => {
    return [...projectRows].sort((a,b) => {
      const av = a[sort.col] ?? -Infinity;
      const bv = b[sort.col] ?? -Infinity;
      if (typeof av === "string" && typeof bv === "string") {
        return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = Number(av ?? -Infinity);
      const bn = Number(bv ?? -Infinity);
      return sort.dir === "asc" ? an-bn : bn-an;
    });
  }, [projectRows, sort]);

  function toggleSort(col: SortCol) {
    setSort((prev) => ({ col, dir: prev.col === col && prev.dir === "desc" ? "asc" : "desc" }));
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (sort.col !== col) return <span className="ml-1 text-gray-300">↕</span>;
    return <span className="ml-1 text-blue-600">{sort.dir === "asc" ? "↑" : "↓"}</span>;
  }

  // ── Heatmap per-area min/max ────────────────────────────────────────────
  function rowOpacity(area: string, val: number | null): number {
    if (val == null) return 0;
    const map = areaQtrMap[area];
    if (!map) return 0.08;
    const vals = Object.values(map);
    const rowMin = Math.min(...vals);
    const rowMax = Math.max(...vals);
    if (rowMax === rowMin) return 0.3;
    return 0.08 + ((val - rowMin)/(rowMax - rowMin))*0.62;
  }

  function deltaClass(area: string, key: string): string {
    const map = areaQtrMap[area];
    if (!map) return "";
    const keyIdx = displayQtrKeys.indexOf(key);
    if (keyIdx <= 0) return "";
    const prevKey  = displayQtrKeys[keyIdx-1];
    const curr = map[key];
    const prev = map[prevKey];
    if (!curr || !prev) return "";
    if (curr > prev * 1.02) return "ring-1 ring-green-400 ring-inset";
    if (curr < prev * 0.98) return "ring-1 ring-red-400 ring-inset";
    return "";
  }

  return (
    <div className="space-y-6">
      <AnalyticsFiltersBar initial={filters} onApply={handleApply} />

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Chart 1: Quarterly price heatmap */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Quarterly Median Price by Area (AED)</h3>
        <p className="text-xs text-gray-400 mb-4">Intensity = relative to each area's own min/max. Green/red ring = ±2% vs prior quarter.</p>
        {loading ? (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
        ) : topAreasByTxn.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 bg-gray-50 border border-gray-200 font-medium text-gray-600 sticky left-0 z-10 min-w-[140px]">Area</th>
                  {displayQtrKeys.map((key) => (
                    <th key={key} className="p-2 bg-gray-50 border border-gray-200 font-medium text-gray-600 text-center whitespace-nowrap min-w-[90px]">
                      {key.replace("-Q"," Q")}
                    </th>
                  ))}
                  <th className="p-2 bg-gray-50 border border-gray-200 font-medium text-gray-600 text-center whitespace-nowrap">YoY</th>
                </tr>
              </thead>
              <tbody>
                {topAreasByTxn.map((area) => (
                  <tr key={area} className="hover:bg-gray-50">
                    <td className="p-2 border border-gray-200 font-medium text-gray-700 sticky left-0 bg-white">{area}</td>
                    {displayQtrKeys.map((key) => {
                      const val = areaQtrMap[area]?.[key] ?? null;
                      const op  = rowOpacity(area, val);
                      const dc  = deltaClass(area, key);
                      return (
                        <td
                          key={key}
                          className={`p-2 border border-gray-200 text-center ${dc}`}
                          style={{ background: val != null ? `rgba(37,99,235,${op})` : "transparent" }}
                        >
                          {val != null ? (
                            <span className={op > 0.4 ? "text-white font-medium" : "text-gray-800"}>{fmtM(val)}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className={`p-2 border border-gray-200 text-center font-medium text-xs ${pctColor(yoyByArea[area])}`}>
                      {fmtPct(yoyByArea[area])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Chart 2: Gainers & Losers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">🟢 Top Gainers (YoY %)</h3>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
          ) : gainers.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={gainers.length * 36 + 24}>
              <BarChart layout="vertical" data={gainers} margin={{ top:4, right:60, bottom:4, left:0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="area" tick={{ fontSize:11 }} width={130} />
                <Tooltip formatter={(v, name) => [`${Number(v)>=0?"+":""}${(Number(v)||0).toFixed(1)}%`, String(name||"")]} />
                <Bar dataKey="yoy" name="YoY Change" fill="#16a34a" radius={[0,3,3,0]}>
                  <LabelList
                    dataKey="yoy"
                    position="right"
                    formatter={(v: unknown) => `+${(Number(v)||0).toFixed(1)}%`}
                    style={{ fontSize: 11, fill: "#16a34a", fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">🔴 Top Losers (YoY %)</h3>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
          ) : losers.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={losers.length * 36 + 24}>
              <BarChart layout="vertical" data={losers} margin={{ top:4, right:60, bottom:4, left:0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="area" tick={{ fontSize:11 }} width={130} />
                <Tooltip formatter={(v, name) => [`${(Number(v)||0).toFixed(1)}%`, String(name||"")]} />
                <Bar dataKey="yoy" name="YoY Change" fill="#dc2626" radius={[0,3,3,0]}>
                  <LabelList
                    dataKey="yoy"
                    position="right"
                    formatter={(v: unknown) => `${(Number(v)||0).toFixed(1)}%`}
                    style={{ fontSize: 11, fill: "#dc2626", fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Chart 3: Appreciation index */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Price Appreciation Index (top 6 areas)</h3>
        <p className="text-xs text-gray-400 mb-4">Base = 100 at earliest available quarter for each area. Dashed line = base.</p>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
        ) : indexData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={indexData} margin={{ top:4, right:16, bottom:4, left:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize:11 }} />
              <YAxis domain={[60,"auto"]} tickFormatter={(v)=>`${v}`} tick={{ fontSize:11 }} />
              <Tooltip formatter={(v, name) => [`${Number(v)||0}`, String(name||"")]} />
              <Legend />
              <ReferenceLine y={100} stroke="#9ca3af" strokeDasharray="4 4" />
              {indexAreas.map((area, i) => (
                <Line
                  key={area}
                  type="monotone"
                  dataKey={area}
                  stroke={AREA_COLORS[i % AREA_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r:3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Chart 4: Project price change table */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Project Price Change — Sortable Table</h3>
        {loading ? (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
        ) : sortedProjectRows.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {([
                    ["projectName","Project"],
                    ["area","Area"],
                    ["latestPrice","Latest Median (AED)"],
                    ["yoyPct","YoY %"],
                    ["qoqPct","QoQ %"],
                    ["txnCount","Deals"],
                  ] as [SortCol, string][]).map(([col, label]) => (
                    <th
                      key={col}
                      className="p-2 border border-gray-200 font-medium text-gray-600 text-left cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                      onClick={() => toggleSort(col)}
                    >
                      {label}<SortIcon col={col} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedProjectRows.map((row) => (
                  <tr key={row.projectName} className="hover:bg-gray-50">
                    <td className="p-2 border border-gray-200 font-medium text-gray-800">{row.projectName}</td>
                    <td className="p-2 border border-gray-200 text-gray-600">{row.area||"—"}</td>
                    <td className="p-2 border border-gray-200 text-gray-800">{row.latestPrice ? `AED ${fmtM(row.latestPrice)}` : "—"}</td>
                    <td className={`p-2 border border-gray-200 font-semibold ${pctColor(row.yoyPct)}`}>{fmtPct(row.yoyPct)}</td>
                    <td className={`p-2 border border-gray-200 font-semibold ${pctColor(row.qoqPct)}`}>{fmtPct(row.qoqPct)}</td>
                    <td className="p-2 border border-gray-200 text-gray-600 text-right">{fmtN(row.txnCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
