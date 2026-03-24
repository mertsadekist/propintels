"use client";

import { useCallback, useEffect, useState } from "react";
import { AnalyticsFiltersBar, EMPTY_FILTERS, type AnalyticsFilters, filtersToParams } from "./analytics-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter,
  ReferenceLine,
} from "recharts";

const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtN(n: number) { return n.toLocaleString("en-AE", { maximumFractionDigits: 0 }); }
function fmtPct(n: number) { return `${n.toFixed(1)}%`; }

// ── Status funnel config ────────────────────────────────────────────────────
const STATUS_ORDER = ["NEW","CONTACTED","QUALIFIED","APPOINTMENT_SET","WON","LOST"];
const STATUS_LABELS: Record<string,string> = {
  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified",
  APPOINTMENT_SET: "Appt Set", WON: "Won", LOST: "Lost",
};
const STATUS_COLORS: Record<string,string> = {
  NEW: "#3b82f6", CONTACTED: "#8b5cf6", QUALIFIED: "#f59e0b",
  APPOINTMENT_SET: "#10b981", WON: "#22c55e", LOST: "#ef4444",
};

// ── Verdict config ──────────────────────────────────────────────────────────
const VERDICT_LABELS: Record<string,string> = {
  BELOW_MARKET:      "Below Market",
  ALIGNED:           "Aligned",
  SLIGHTLY_ABOVE:    "Slightly Above",
  ABOVE_MARKET:      "Above Market",
  INSUFFICIENT_DATA: "Insufficient Data",
};
const VERDICT_COLORS: Record<string,string> = {
  BELOW_MARKET:      "#22c55e",
  ALIGNED:           "#3b82f6",
  SLIGHTLY_ABOVE:    "#f59e0b",
  ABOVE_MARKET:      "#ef4444",
  INSUFFICIENT_DATA: "#9ca3af",
};

interface LeadStatus { status: string; count: number; }
interface VerdictRow { verdict: string | null; count: number; }
interface ConfBucket { bucket: string; count: number; }
interface MonthRow   { yr: number; mo: number; count: number; }
interface ScatterPoint { clientPsf: number; marketPsf: number; verdict: string | null; ratio: number | null; }
interface Summary { totalLeads: number; totalResults: number; avgConfidence: number; specialistCount: number; }

interface ApiData {
  leadsByStatus: LeadStatus[];
  byVerdict:     VerdictRow[];
  confBuckets:   ConfBucket[];
  monthlyLeads:  MonthRow[];
  scatter:       ScatterPoint[];
  summary:       Summary;
}

// Custom funnel bar label
const FunnelLabel = ({ x, y, width, value, name }: { x: number; y: number; width: number; value: number; name: string }) => (
  <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="#374151" fontSize={11}>
    {name}: {fmtN(value)}
  </text>
);

export function ValuationInsightsPage() {
  const [data,    setData]    = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchData = useCallback(async (f: AnalyticsFilters) => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/analytics/valuations?${filtersToParams(f)}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setData(json.data);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally     { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(EMPTY_FILTERS); }, [fetchData]);

  // Lead funnel — ordered
  const funnelData = STATUS_ORDER.map((s) => ({
    name:  STATUS_LABELS[s] ?? s,
    value: data?.leadsByStatus.find((r) => r.status === s)?.count ?? 0,
    color: STATUS_COLORS[s] ?? "#9ca3af",
    key:   s,
  })).filter((r) => r.value > 0);

  // Verdict donut
  const verdictData = (data?.byVerdict ?? []).map((r) => ({
    name:  VERDICT_LABELS[r.verdict ?? ""] ?? r.verdict ?? "Unknown",
    value: r.count,
    color: VERDICT_COLORS[r.verdict ?? ""] ?? "#9ca3af",
  }));

  // Monthly leads (last 24m)
  const monthlyChart = (data?.monthlyLeads ?? [])
    .map((r) => ({ label: `${MONTH_NAMES[r.mo]} ${String(r.yr).slice(2)}`, count: r.count }))
    .slice(-24);

  // Confidence buckets ordered
  const BUCKET_ORDER = ["0-20","21-40","41-60","61-80","81-100"];
  const confData = BUCKET_ORDER.map((b) => ({
    bucket: b,
    count:  data?.confBuckets.find((r) => r.bucket === b)?.count ?? 0,
  }));

  // Scatter — colour by verdict
  const scatterPoints = (data?.scatter ?? []).filter((p) => p.clientPsf > 0 && p.marketPsf > 0);

  const totalVerdicts = verdictData.reduce((s, r) => s + r.value, 0);

  return (
    <div className="space-y-5">
      <AnalyticsFiltersBar onApply={fetchData} />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : data ? (
        <>
          {/* Summary KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Leads",        value: fmtN(data.summary.totalLeads) },
              { label: "Valuations Done",    value: fmtN(data.summary.totalResults) },
              { label: "Avg Confidence",     value: `${data.summary.avgConfidence}%` },
              { label: "Specialist Reviews", value: fmtN(data.summary.specialistCount) },
            ].map(({ label, value }) => (
              <Card key={label}>
                <CardContent className="pt-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
                  <div className="text-xl font-bold text-gray-900">{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Funnel + Verdict donut */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lead Funnel */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Lead Pipeline Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={funnelData}
                    layout="vertical"
                    margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={82} />
                    <Tooltip
                      formatter={(v: number | undefined) => [fmtN(v ?? 0), "Leads"]}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11 }}>
                      {funnelData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* Conversion rate */}
                {funnelData.length >= 2 && (() => {
                  const newCount = funnelData.find((r) => r.key === "NEW")?.value ?? 0;
                  const wonCount = funnelData.find((r) => r.key === "WON")?.value ?? 0;
                  const lostCount = funnelData.find((r) => r.key === "LOST")?.value ?? 0;
                  if (!newCount) return null;
                  return (
                    <div className="flex gap-4 mt-3 text-xs text-gray-500 border-t pt-3">
                      <span>Win rate: <strong className="text-green-600">{fmtPct(wonCount / newCount * 100)}</strong></span>
                      <span>Loss rate: <strong className="text-red-500">{fmtPct(lostCount / newCount * 100)}</strong></span>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Verdict Distribution Donut */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Verdict Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {verdictData.length === 0 ? (
                  <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">No data</div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="50%" height={220}>
                      <PieChart>
                        <Pie
                          data={verdictData}
                          cx="50%" cy="50%"
                          innerRadius={55} outerRadius={85}
                          dataKey="value"
                          paddingAngle={2}
                        >
                          {verdictData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number | undefined) => [fmtN(v ?? 0), "Valuations"]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {verdictData.map((entry) => (
                        <div key={entry.name} className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: entry.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-700 truncate">{entry.name}</div>
                            <div className="text-xs text-gray-400">
                              {fmtN(entry.value)} · {totalVerdicts > 0 ? fmtPct(entry.value / totalVerdicts * 100) : "0%"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Confidence Histogram + Monthly Leads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Confidence Histogram */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Confidence Score Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={confData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number | undefined) => [fmtN(v ?? 0), "Valuations"]} />
                    <Bar dataKey="count" radius={[4,4,0,0]}>
                      {confData.map((entry, i) => {
                        const t = i / (confData.length - 1);
                        const r = Math.round(239 + (34  - 239) * t);
                        const g = Math.round(68  + (197 - 68)  * t);
                        const b = Math.round(68  + (94  - 68)  * t);
                        return <Cell key={i} fill={`rgb(${r},${g},${b})`} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
                  <span>← Low confidence</span>
                  <span>High confidence →</span>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Leads Trend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Monthly Lead Volume (last 24m)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyChart} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" height={60} interval={1} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number | undefined) => [fmtN(v ?? 0), "Leads"]} />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Client PSF vs Market PSF Scatter */}
          {scatterPoints.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  Client Ask PSF vs Market Median PSF
                  <span className="ml-2 text-sm font-normal text-gray-400">
                    ({fmtN(scatterPoints.length)} data points)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="marketPsf"
                      name="Market PSF"
                      tick={{ fontSize: 11 }}
                      label={{ value: "Market Median PSF (AED)", position: "insideBottom", offset: -10, fontSize: 11 }}
                    />
                    <YAxis
                      dataKey="clientPsf"
                      name="Client PSF"
                      tick={{ fontSize: 11 }}
                      label={{ value: "Client Ask PSF", angle: -90, position: "insideLeft", fontSize: 11 }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ payload }) => {
                        if (!payload?.length) return null;
                        const p = payload[0].payload as ScatterPoint;
                        return (
                          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2 text-xs">
                            <div>Client Ask: <strong>{fmtN(p.clientPsf)} AED/sqft</strong></div>
                            <div>Market PSF: <strong>{fmtN(p.marketPsf)} AED/sqft</strong></div>
                            {p.ratio && <div>Ratio: <strong>{(p.ratio * 100).toFixed(1)}%</strong></div>}
                            {p.verdict && (
                              <div className="mt-1" style={{ color: VERDICT_COLORS[p.verdict] ?? "#6b7280" }}>
                                {VERDICT_LABELS[p.verdict] ?? p.verdict}
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                    {/* Reference line: client = market */}
                    <ReferenceLine
                      segment={[{ x: 0, y: 0 }, { x: 5000, y: 5000 }]}
                      stroke="#94a3b8"
                      strokeDasharray="6 3"
                      label={{ value: "1:1", fontSize: 10, fill: "#94a3b8" }}
                    />
                    {/* One scatter per verdict group */}
                    {Object.entries(VERDICT_COLORS).map(([verdict, color]) => {
                      const pts = scatterPoints.filter((p) => p.verdict === verdict);
                      if (!pts.length) return null;
                      return (
                        <Scatter
                          key={verdict}
                          name={VERDICT_LABELS[verdict] ?? verdict}
                          data={pts}
                          fill={color}
                          fillOpacity={0.65}
                          r={4}
                        />
                      );
                    })}
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </ScatterChart>
                </ResponsiveContainer>
                <p className="text-[11px] text-gray-400 mt-2 text-center">
                  Dashed line = perfect alignment (client ask equals market). Points above = client asking above market.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
