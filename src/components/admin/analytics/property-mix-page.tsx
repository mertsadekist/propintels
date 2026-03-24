"use client";

import { useCallback, useEffect, useState } from "react";
import { AnalyticsFiltersBar, EMPTY_FILTERS, type AnalyticsFilters, filtersToParams } from "./analytics-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from "recharts";

const PSM = 10.7639;

const TYPE_COLORS = [
  "#2563eb","#16a34a","#dc2626","#9333ea","#ea580c",
  "#0891b2","#65a30d","#d97706","#db2777","#64748b",
];

function fmtN(n: number) { return n.toLocaleString("en-AE", { maximumFractionDigits: 0 }); }

function fmtLabel(v: string) {
  return v.replace(/_/g, " ").charAt(0) + v.slice(1).toLowerCase();
}

interface TypeRow     { propertyType: string; txnCount: number; medianPsf: number; totalValue: number; }
interface UnitRow     { unitType: string; txnCount: number; medianPsf: number; }
interface CatRow      { category: string; txnCount: number; medianPsf: number; }
interface MonthRow    { yr: number; mo: number; unitType: string; txnCount: number; medianPsf: number; }
interface TypeBrRow   { propertyType: string; bedrooms: number | null; txnCount: number; medianPsf: number; }

interface ApiData {
  byType: TypeRow[]; byUnitType: UnitRow[]; byCategory: CatRow[];
  monthly: MonthRow[]; byTypeBedroom: TypeBrRow[];
}

function MonthLabel({ yr, mo }: { yr: number; mo: number }) {
  return `${["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][mo]} ${String(yr).slice(2)}`;
}

export function PropertyMixPage() {
  const [data,    setData]    = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchData = useCallback(async (f: AnalyticsFilters) => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/analytics/property-mix?${filtersToParams(f)}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setData(json.data);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally     { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(EMPTY_FILTERS); }, [fetchData]);

  // Build monthly stacked data
  const monthlyStacked = (() => {
    if (!data) return [];
    const map = new Map<string, Record<string, number>>();
    for (const r of data.monthly) {
      const key = `${r.yr}-${String(r.mo).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, { label: MonthLabel({ yr: r.yr, mo: r.mo }) as unknown as number } as Record<string,number>);
      const ut = r.unitType === "Off-Plan" ? "Off-Plan" : r.unitType === "Existing" ? "Ready" : "Other";
      map.get(key)![ut] = r.txnCount;
    }
    return Array.from(map.values()).slice(-18); // last 18 months
  })();

  return (
    <div className="space-y-5">
      <AnalyticsFiltersBar onApply={fetchData} />

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : data ? (
        <>
          {/* Row 1: Type donut + Unit Type donut */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* By Property Type */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">By Property Type</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={data.byType} dataKey="txnCount" nameKey="propertyType"
                      cx="50%" cy="50%" outerRadius={90} innerRadius={50}
                      label={({ name, percent }) =>
                        (percent ?? 0) > 0.03 ? `${fmtLabel(name as string)} ${((percent ?? 0) * 100).toFixed(0)}%` : ""
                      }
                      labelLine={false}
                    >
                      {data.byType.map((_, i) => (
                        <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number, name: string) => [fmtN(v) + " txns", fmtLabel(name)]} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Summary table */}
                <div className="mt-2 space-y-1">
                  {data.byType.slice(0, 5).map((r, i) => (
                    <div key={r.propertyType} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: TYPE_COLORS[i] }} />
                        <span className="text-gray-700">{fmtLabel(r.propertyType)}</span>
                      </div>
                      <div className="flex gap-3 text-gray-500 tabular-nums">
                        <span>{fmtN(r.txnCount)} txns</span>
                        <span className="text-blue-600 font-medium">{fmtN(r.medianPsf)} PSF</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Ready vs Off-Plan */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Ready vs Off-Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={data.byUnitType} dataKey="txnCount" nameKey="unitType"
                      cx="50%" cy="50%" outerRadius={90} innerRadius={50}
                      label={({ name, percent }) =>
                        `${(name as string) === "Existing" ? "Ready" : (name as string)} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {data.byUnitType.map((r, i) => (
                        <Cell key={i} fill={
                          r.unitType === "Existing" ? "#16a34a" :
                          r.unitType === "Off-Plan" ? "#9333ea" : "#94a3b8"
                        } />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number, name: string) => [fmtN(v) + " txns", name === "Existing" ? "Ready" : name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1">
                  {data.byUnitType.map((r) => (
                    <div key={r.unitType} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700">{r.unitType === "Existing" ? "Ready" : r.unitType}</span>
                      <div className="flex gap-3 text-gray-500 tabular-nums">
                        <span>{fmtN(r.txnCount)} txns</span>
                        <span className="text-blue-600 font-medium">{fmtN(r.medianPsf)} PSF</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Monthly stacked bar */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Monthly Volume — Ready vs Off-Plan (last 18 months)</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyStacked.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No monthly data</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyStacked} margin={{ top: 5, right: 20, left: 20, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" height={55} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Ready"    stackId="a" fill="#16a34a" radius={[0,0,0,0]} />
                    <Bar dataKey="Off-Plan" stackId="a" fill="#9333ea" radius={[3,3,0,0]} />
                    <Bar dataKey="Other"    stackId="a" fill="#94a3b8" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Row 3: Category + Type×Bedroom table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Category */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Residential vs Commercial</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 pt-2">
                  {data.byCategory.map((r) => {
                    const total = data.byCategory.reduce((s, x) => s + x.txnCount, 0);
                    const pct = total > 0 ? (r.txnCount / total * 100) : 0;
                    return (
                      <div key={r.category}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{fmtLabel(r.category)}</span>
                          <span className="text-gray-500">{fmtN(r.txnCount)} txns · {fmtN(r.medianPsf)} PSF</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: r.category === "RESIDENTIAL" ? "#2563eb" : "#ea580c" }}
                          />
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{pct.toFixed(1)}%</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Type × Bedroom table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Property Type × Bedrooms (Median PSF)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-2 font-semibold text-gray-700">Type</th>
                        {[0,1,2,3,4,5].map((br) => (
                          <th key={br} className="text-center px-2 py-2 font-semibold text-gray-600">
                            {br === 0 ? "Stu" : br === 5 ? "5+" : `${br}BR`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(new Set(data.byTypeBedroom.map((r) => r.propertyType))).map((pt, ri) => {
                        const rows = data.byTypeBedroom.filter((r) => r.propertyType === pt);
                        return (
                          <tr key={pt} className={`border-b border-gray-100 ${ri%2===0?"":"bg-gray-50/40"}`}>
                            <td className="px-4 py-2 font-medium text-gray-700">{fmtLabel(pt)}</td>
                            {[0,1,2,3,4,5].map((br) => {
                              const cell = rows.find((r) => Number(r.bedrooms) === br);
                              return (
                                <td key={br} className="px-2 py-2 text-center tabular-nums">
                                  {cell ? (
                                    <div>
                                      <div className="font-semibold text-gray-800">{fmtN(cell.medianPsf)}</div>
                                      <div className="text-[10px] text-gray-400">{cell.txnCount}</div>
                                    </div>
                                  ) : <span className="text-gray-200">—</span>}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
