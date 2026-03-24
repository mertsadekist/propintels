"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine,
} from "recharts";
import {
  AnalyticsFiltersBar,
  EMPTY_FILTERS,
  filtersToParams,
  type AnalyticsFilters,
} from "./analytics-filters";

// ─── Constants ───────────────────────────────────────────────────────────────
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
const BR_LABELS: Record<number,string> = { 0:"Studio",1:"1BR",2:"2BR",3:"3BR",4:"4BR",5:"5BR+" };

// ─── Formatting ───────────────────────────────────────────────────────────────
function fmtN(v: number): string { return new Intl.NumberFormat().format(Math.round(v)); }
function fmtM(v: number): string {
  if (v >= 1_000_000) return `${(v/1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v/1_000).toFixed(0)}K`;
  return String(Math.round(v));
}
const MONTH_SHORT = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Types ────────────────────────────────────────────────────────────────────
interface BracketRow      { bracket: string; txnCount: number; totalValue: number; }
interface MonthBracketRow { yr: number; mo: number; bracket: string; txnCount: number; }
interface BrBracketRow    { bedroomsGroup: number; bracket: string; txnCount: number; }
interface LuxuryQtrRow    { yr: number; qtr: number; totalTxns: number; luxuryTxns: number; }

interface ApiData {
  brackets:        BracketRow[];
  monthlyBracket:  MonthBracketRow[];
  brBracket:       BrBracketRow[];
  luxuryQuarterly: LuxuryQtrRow[];
}

// ─── Pie label renderer ───────────────────────────────────────────────────────
function renderPieLabel({ name, percent }: { name?: string; percent?: number }) {
  const pct = percent ?? 0;
  if (pct < 0.03) return null;
  return `${BRACKET_LABELS[String(name||"")] ?? name} ${(pct*100).toFixed(0)}%`;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function DealSegmentsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>(EMPTY_FILTERS);
  const [data, setData]       = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchData = useCallback(async (f: AnalyticsFilters) => {
    setLoading(true);
    setError(null);
    try {
      const sp  = filtersToParams(f);
      const res = await fetch(`/api/analytics/deal-segments?${sp}`);
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

  // ── Sorted brackets ───────────────────────────────────────────────────
  const sortedBrackets = data
    ? [...data.brackets].sort((a,b) => BRACKET_ORDER.indexOf(a.bracket)-BRACKET_ORDER.indexOf(b.bracket))
    : [];
  const totalDeals = sortedBrackets.reduce((s,r)=>s+r.txnCount,0);

  // ── Stacked bar pivot ─────────────────────────────────────────────────
  const stackedData = (() => {
    if (!data) return [];
    const pointMap: Record<string,Record<string,number>> = {};
    for (const r of data.monthlyBracket) {
      const key = `${r.yr}-${String(r.mo).padStart(2,"0")}`;
      if (!pointMap[key]) {
        pointMap[key] = {};
        // init all brackets to 0 to prevent NaN gaps
        for (const b of BRACKET_ORDER) pointMap[key][b] = 0;
      }
      pointMap[key][r.bracket] = r.txnCount;
    }
    return Object.entries(pointMap)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([key, vals]) => {
        const [yr, mo] = key.split("-");
        return { label: `${MONTH_SHORT[Number(mo)]} ${String(yr).slice(2)}`, ...vals };
      });
  })();

  // ── Bedroom × bracket grid ─────────────────────────────────────────────
  const gridData = (() => {
    if (!data) return { bdGroups: [] as number[], colMaxes: {} as Record<string,number>, map: {} as Record<string,Record<string,number>> };
    const bdSet = new Set<number>();
    const map: Record<string,Record<string,number>> = {};
    for (const r of data.brBracket) {
      bdSet.add(r.bedroomsGroup);
      const bk = String(r.bedroomsGroup);
      if (!map[bk]) map[bk] = {};
      map[bk][r.bracket] = r.txnCount;
    }
    const bdGroups = Array.from(bdSet).sort((a,b)=>a-b);
    // col maxes (per bracket) for intensity
    const colMaxes: Record<string,number> = {};
    for (const b of BRACKET_ORDER) {
      colMaxes[b] = Math.max(...bdGroups.map((bg) => map[String(bg)]?.[b]||0));
    }
    return { bdGroups, colMaxes, map };
  })();

  // ── Luxury line data ───────────────────────────────────────────────────
  const luxuryLine = data
    ? data.luxuryQuarterly.map((r) => ({
        label:      `Q${r.qtr} ${r.yr}`,
        luxuryPct:  r.totalTxns > 0 ? +((r.luxuryTxns/r.totalTxns)*100).toFixed(1) : 0,
        totalTxns:  r.totalTxns,
        luxuryTxns: r.luxuryTxns,
      }))
    : [];

  const currentLuxuryPct = luxuryLine.length > 0 ? luxuryLine[luxuryLine.length-1].luxuryPct : 0;

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
            { label: "Total Transactions",    value: fmtN(totalDeals) },
            { label: "Luxury Deals (5M+)",    value: fmtN(sortedBrackets.filter(r=>r.bracket==="5m-10m"||r.bracket==="10m+").reduce((s,r)=>s+r.txnCount,0)) },
            { label: "Luxury Market Share",   value: `${currentLuxuryPct.toFixed(1)}%` },
            { label: "Total Volume",          value: `AED ${fmtM(sortedBrackets.reduce((s,r)=>s+r.totalValue,0))}` },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500">{k.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chart 1: Price bracket donut */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Price Bracket Distribution</h3>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
          ) : sortedBrackets.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={sortedBrackets.map((r) => ({ ...r, name: r.bracket }))}
                    dataKey="txnCount"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    label={renderPieLabel}
                    labelLine
                  >
                    {sortedBrackets.map((_,i) => (
                      <Cell key={i} fill={BRACKET_COLORS[i%BRACKET_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, name) => [fmtN(Number(v)||0) + " deals", BRACKET_LABELS[String(name||"")]||String(name||"")]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {sortedBrackets.map((r,i) => (
                  <div key={r.bracket} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background:BRACKET_COLORS[i%BRACKET_COLORS.length] }} />
                    <span className="w-20">{BRACKET_LABELS[r.bracket]||r.bracket}</span>
                    <span className="font-medium">{fmtN(r.txnCount)} deals</span>
                    <span className="ml-auto text-gray-400">{totalDeals>0?((r.txnCount/totalDeals)*100).toFixed(1):"0"}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Chart 4: Luxury market share */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Luxury Market Share (≥5M AED) by Quarter</h3>
          <p className="text-xs text-gray-400 mb-4">Dashed line = 10% benchmark</p>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
          ) : luxuryLine.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={luxuryLine} margin={{ top:4, right:16, bottom:4, left:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize:10 }} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize:11 }} domain={[0,"auto"]} />
                <Tooltip formatter={(v, name) => [`${Number(v)||0}%`, String(name||"")]} />
                <ReferenceLine y={10} stroke="#9ca3af" strokeDasharray="4 4" label={{ value:"10%", position:"right", fontSize:10, fill:"#9ca3af" }} />
                <Line type="monotone" dataKey="luxuryPct" name="Luxury %" stroke="#1d4ed8" strokeWidth={2} dot={{ r:3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Chart 2: Bracket trend stacked bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Bracket Trend (last 18 months)</h3>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
        ) : stackedData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stackedData} margin={{ top:4, right:8, bottom:4, left:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize:10 }} />
              <YAxis tickFormatter={(v) => fmtN(Number(v)||0)} tick={{ fontSize:11 }} width={55} />
              <Tooltip formatter={(v, name) => [fmtN(Number(v)||0) + " deals", BRACKET_LABELS[String(name||"")]||String(name||"")]} />
              <Legend formatter={(v) => BRACKET_LABELS[String(v||"")]||String(v||"")} />
              {BRACKET_ORDER.map((b,i) => (
                <Bar key={b} dataKey={b} stackId="a" fill={BRACKET_COLORS[i]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Chart 3: Bedroom × bracket grid */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Bedroom Type × Price Bracket (deal count)</h3>
        <p className="text-xs text-gray-400 mb-4">Color intensity = share within each price bracket</p>
        {loading ? (
          <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
        ) : gridData.bdGroups.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-gray-400 text-sm">No data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2 bg-gray-50 border border-gray-200 text-left font-medium text-gray-600 w-20">Type</th>
                  {BRACKET_ORDER.map((b,i) => (
                    <th key={b} className="p-2 border border-gray-200 font-medium text-gray-600 text-center whitespace-nowrap min-w-[80px]">
                      <span className="inline-block w-3 h-3 rounded-sm mr-1 align-middle" style={{ background: BRACKET_COLORS[i] }} />
                      {BRACKET_LABELS[b]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gridData.bdGroups.map((bg) => (
                  <tr key={bg} className="hover:bg-gray-50">
                    <td className="p-2 border border-gray-200 font-medium text-gray-700">{BR_LABELS[bg]??`${bg}BR`}</td>
                    {BRACKET_ORDER.map((b) => {
                      const val = gridData.map[String(bg)]?.[b] ?? 0;
                      const colMax = gridData.colMaxes[b] || 1;
                      const opacity = val > 0 ? 0.08 + (val/colMax)*0.62 : 0;
                      return (
                        <td
                          key={b}
                          className="p-2 border border-gray-200 text-center"
                          style={{ background: val > 0 ? `rgba(37,99,235,${opacity})` : "transparent" }}
                        >
                          <span className={opacity > 0.4 ? "text-white font-medium" : "text-gray-700"}>
                            {val > 0 ? fmtN(val) : <span className="text-gray-300">—</span>}
                          </span>
                        </td>
                      );
                    })}
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
