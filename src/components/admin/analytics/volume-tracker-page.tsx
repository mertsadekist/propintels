"use client";

import { useCallback, useEffect, useState } from "react";
import { AnalyticsFiltersBar, EMPTY_FILTERS, type AnalyticsFilters, filtersToParams } from "./analytics-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from "recharts";

const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtN(n: number) { return n.toLocaleString("en-AE", { maximumFractionDigits: 0 }); }
function fmtM(v: number) {
  if (v >= 1_000_000_000) return `${(v/1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000)     return `${(v/1_000_000).toFixed(0)}M`;
  if (v >= 1_000)         return `${(v/1_000).toFixed(0)}K`;
  return String(v);
}

interface MonthRow   { yr: number; mo: number; txnCount: number; totalValue: number; medianPsf: number; }
interface DayRow     { date: string; txnCount: number; totalValue: number; }

interface ApiData    { monthly: MonthRow[]; daily: DayRow[]; areaMonthly: { area: string; yr: number; mo: number; txnCount: number }[]; }

// Calendar heatmap helpers
function buildCalendar(daily: DayRow[], year: number) {
  const map = new Map<string, number>();
  daily.forEach((d) => { if (d.date.startsWith(String(year))) map.set(d.date, d.txnCount); });
  // Build week grid
  const jan1 = new Date(`${year}-01-01`);
  const startDay = jan1.getDay(); // 0=Sun
  const weeks: (null | { date: string; count: number })[][] = [];
  let week: (null | { date: string; count: number })[] = Array(startDay).fill(null);
  for (let d = 0; d < 366; d++) {
    const dt = new Date(jan1); dt.setDate(jan1.getDate() + d);
    if (dt.getFullYear() !== year) break;
    const key = dt.toISOString().split("T")[0];
    week.push({ date: key, count: map.get(key) ?? 0 });
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }
  return weeks;
}

function heatColor(count: number, max: number): string {
  if (count === 0) return "#f1f5f9";
  const t = Math.min(count / max, 1);
  const r = Math.round(220 + (21  - 220) * t);
  const g = Math.round(252 + (128 - 252) * t);
  const b = Math.round(231 + (97  - 231) * t);
  return `rgb(${r},${g},${b})`;
}

export function VolumeTrackerPage() {
  const [data,    setData]    = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  const fetchData = useCallback(async (f: AnalyticsFilters) => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/analytics/volume?${filtersToParams(f)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json.data);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally     { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(EMPTY_FILTERS); }, [fetchData]);

  // Monthly chart data
  const monthlyChart = (data?.monthly ?? []).map((r) => ({
    label: `${MONTH_NAMES[r.mo]} ${String(r.yr).slice(2)}`,
    txnCount: r.txnCount,
    totalValue: r.totalValue,
    medianPsf: r.medianPsf,
  })).slice(-24);

  // Calendar
  const calYears = Array.from(new Set((data?.daily ?? []).map((d) => parseInt(d.date.slice(0,4))))).sort();
  const calWeeks = data ? buildCalendar(data.daily, calYear) : [];
  const calMax   = Math.max(...(data?.daily.filter((d) => d.date.startsWith(String(calYear))).map((d) => d.txnCount) ?? [1]));

  return (
    <div className="space-y-5">
      <AnalyticsFiltersBar onApply={fetchData} />

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
      ) : data ? (
        <>
          {/* Monthly bar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Monthly Transaction Volume (last 24 months)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyChart} margin={{ top: 5, right: 20, left: 20, bottom: 35 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" height={60} interval={1} />
                  <YAxis yAxisId="left"  tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={fmtM} />
                  <Tooltip
                    formatter={(v, name) => [
                      String(name || "") === "totalValue" ? `AED ${fmtM(Number(v) || 0)}` : fmtN(Number(v) || 0),
                      String(name || "") === "txnCount" ? "Transactions" : "Total Value",
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left"  dataKey="txnCount"   name="Transactions" fill="#2563eb" radius={[3,3,0,0]}>
                    {monthlyChart.map((_, i) => (
                      <Cell key={i} fill={`hsl(${220 + i * 3}, 80%, ${45 + (i % 3) * 5}%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Calendar heatmap */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Daily Activity Calendar</CardTitle>
                <div className="flex gap-1">
                  {calYears.map((y) => (
                    <button
                      key={y}
                      onClick={() => setCalYear(y)}
                      className={`text-xs px-2.5 py-1 rounded transition-colors ${
                        calYear === y ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto pb-2">
                <div className="inline-flex gap-1">
                  {/* Month labels */}
                  <div className="flex flex-col gap-1 mr-1">
                    {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                      <div key={d} className="h-3 w-7 text-[9px] text-gray-400 flex items-center">{d}</div>
                    ))}
                  </div>
                  {calWeeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-1">
                      {week.map((day, di) => (
                        day ? (
                          <div
                            key={di}
                            title={`${day.date}: ${day.count} txns`}
                            className="h-3 w-3 rounded-sm cursor-default"
                            style={{ background: heatColor(day.count, calMax) }}
                          />
                        ) : (
                          <div key={di} className="h-3 w-3" />
                        )
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-2 mt-3 text-[11px] text-gray-400">
                <span>Less</span>
                {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
                  <div key={i} className="h-3 w-3 rounded-sm" style={{ background: heatColor(Math.round(t * calMax), calMax) }} />
                ))}
                <span>More</span>
                <span className="ml-2 text-gray-400">Max: {fmtN(calMax)} txns/day</span>
              </div>
            </CardContent>
          </Card>

          {/* Summary stats row */}
          {data.monthly.length > 0 && (() => {
            const total   = data.monthly.reduce((s, r) => s + r.txnCount, 0);
            const value   = data.monthly.reduce((s, r) => s + r.totalValue, 0);
            const avgMth  = Math.round(total / data.monthly.length);
            const maxMo   = data.monthly.reduce((a, b) => a.txnCount > b.txnCount ? a : b);
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Transactions", value: fmtN(total) },
                  { label: "Total Volume (AED)",  value: `${fmtM(value)}` },
                  { label: "Avg / Month",          value: fmtN(avgMth) },
                  { label: "Busiest Month",        value: `${MONTH_NAMES[maxMo.mo]} ${maxMo.yr}`, sub: `${fmtN(maxMo.txnCount)} txns` },
                ].map(({ label, value, sub }) => (
                  <Card key={label}>
                    <CardContent className="pt-4">
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
                      <div className="text-xl font-bold text-gray-900">{value}</div>
                      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })()}
        </>
      ) : null}
    </div>
  );
}
