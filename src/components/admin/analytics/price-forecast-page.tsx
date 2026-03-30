"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ComposedChart, Line, Area,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  TrendingUp, TrendingDown, Minus, Search, X,
  BarChart2, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { Button }     from "@/components/ui/button";
import { Input }      from "@/components/ui/input";
import { Label }      from "@/components/ui/label";
import { Badge }      from "@/components/ui/badge";

// ─── Constants ────────────────────────────────────────────────────────────────
const PSM_FACTOR = 10.7639;

const PROPERTY_TYPES = ["APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "DUPLEX", "STUDIO"];
const BEDROOM_OPTS   = ["0", "1", "2", "3", "4", "5+"];

// ─── Formatting ───────────────────────────────────────────────────────────────
function fmtPsf(v: number, unit: "psf" | "psm"): string {
  return `AED ${new Intl.NumberFormat().format(Math.round(unit === "psm" ? v * PSM_FACTOR : v))} /${unit === "psm" ? "sqm" : "sqft"}`;
}
function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}
function pctColor(v: number | null | undefined): string {
  if (v == null) return "text-gray-400";
  if (v > 1) return "text-green-700";
  if (v < -1) return "text-red-700";
  return "text-gray-500";
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface HistoricalPoint {
  label: string; yr: number; qtr: number;
  medianPsf: number; medianPsm: number;
  txCount: number; changeVsPrev: number | null;
}
interface ForecastPoint {
  label: string; yr: number; qtr: number;
  medianPsf: number; medianPsm: number;
  low: number; high: number; isForecast: true;
}
interface ApiResponse {
  historical: HistoricalPoint[];
  forecast: ForecastPoint[];
  regression: { slope: number; r2: number; trend: "UP" | "DOWN" | "FLAT" };
  target: string; mode: string; totalTransactions: number;
  targets: string[];
}

// ─── Confidence Badge ─────────────────────────────────────────────────────────
function ConfidenceBadge({ r2 }: { r2: number }) {
  if (r2 >= 0.8)
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">High Confidence — R²={r2.toFixed(2)}</span>;
  if (r2 >= 0.5)
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">Moderate Confidence — R²={r2.toFixed(2)}</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Low Confidence — R²={r2.toFixed(2)}</span>;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, unit }: {
  active?: boolean; payload?: { value: number; name: string; color: string }[];
  label?: string; unit: "psf" | "psm";
}) {
  if (!active || !payload?.length) return null;
  const unitLabel = unit === "psm" ? "sqm" : "sqft";
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-lg p-3 text-sm min-w-[180px]">
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-4 text-xs text-gray-600">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium text-gray-800">
            {p.value != null ? `AED ${new Intl.NumberFormat().format(Math.round(unit === "psm" ? p.value * PSM_FACTOR : p.value))} /${unitLabel}` : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Searchable Target Selector ───────────────────────────────────────────────
function TargetSelector({
  mode, value, onChange,
}: {
  mode: "area" | "project";
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/analytics/price-forecast?mode=${mode}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => setOptions(d.targets ?? []))
      .catch(() => setOptions([]));
  }, [mode]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter((o) => o.toLowerCase().includes(query.toLowerCase())).slice(0, 50);

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
        <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <input
          className="flex-1 text-sm outline-none placeholder:text-gray-400"
          placeholder={`Search ${mode === "area" ? "area" : "project / building"}…`}
          value={value || query}
          onChange={(e) => { setQuery(e.target.value); if (value) onChange(""); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {value && (
          <button onClick={() => { onChange(""); setQuery(""); }} className="text-gray-400 hover:text-gray-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg text-sm">
          {filtered.map((o) => (
            <li key={o}>
              <button
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700"
                onClick={() => { onChange(o); setQuery(""); setOpen(false); }}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function PriceForecastPage() {
  const [mode,         setMode]         = useState<"area" | "project">("area");
  const [target,       setTarget]       = useState("");
  const [dateFrom,     setDateFrom]     = useState("2020-01-01");
  const [dateTo,       setDateTo]       = useState(new Date().toISOString().slice(0, 10));
  const [propTypes,    setPropTypes]    = useState<string[]>([]);
  const [bedrooms,     setBedrooms]     = useState<string[]>([]);
  const [unitType,     setUnitType]     = useState("");
  const [category,     setCategory]     = useState("RESIDENTIAL");
  const [unit,         setUnit]         = useState<"psf" | "psm">("psf");
  const [data,         setData]         = useState<ApiResponse | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!target) { setError("Please select an area or project first."); return; }
    setLoading(true); setError(null);
    try {
      const sp = new URLSearchParams({ mode, target, dateFrom, dateTo, category });
      if (propTypes.length) sp.set("propertyTypes", propTypes.join(","));
      if (bedrooms.length)  sp.set("bedrooms",      bedrooms.join(","));
      if (unitType)         sp.set("unitType",       unitType);
      const res = await fetch(`/api/analytics/price-forecast?${sp}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const json: ApiResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [mode, target, dateFrom, dateTo, propTypes, bedrooms, unitType, category]);

  // ── Build chart data: merge historical + forecast ──────────────────────────
  const chartData = data
    ? [
        ...data.historical.map((h) => ({
          label:    h.label,
          psf:      h.medianPsf,
          txCount:  h.txCount,
          isForecast: false,
        })),
        ...data.forecast.map((f) => ({
          label:      f.label,
          forecastPsf: f.medianPsf,
          bandLow:    f.low,
          bandHigh:   f.high,
          isForecast:  true,
        })),
      ]
    : [];

  const psfDisplay = (v: number) =>
    unit === "psm" ? v * PSM_FACTOR : v;

  // ── Summary cards: first, last, change overall ────────────────────────────
  const firstPoint = data?.historical[0];
  const lastPoint  = data?.historical[data.historical.length - 1];
  const overallPct = firstPoint && lastPoint && firstPoint.medianPsf > 0
    ? ((lastPoint.medianPsf - firstPoint.medianPsf) / firstPoint.medianPsf) * 100
    : null;

  const nextQ1 = data?.forecast[0];
  const nextQ2 = data?.forecast[1];

  return (
    <div className="space-y-6">
      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        {/* Mode toggle */}
        <div className="flex gap-2">
          {(["area", "project"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setTarget(""); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                mode === m
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
              }`}
            >
              {m === "area" ? "By Area" : "By Project / Building"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Target selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
              {mode === "area" ? "Area" : "Project / Building"}
            </Label>
            <TargetSelector mode={mode} value={target} onChange={setTarget} />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Category</Label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All</option>
              <option value="RESIDENTIAL">Residential</option>
              <option value="COMMERCIAL">Commercial</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Date From */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wide">From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-sm" />
          </div>

          {/* Date To */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wide">To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-sm" />
          </div>

          {/* Unit Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Unit Type</Label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={unitType}
              onChange={(e) => setUnitType(e.target.value)}
            >
              <option value="">All</option>
              <option value="ready">Ready</option>
              <option value="offplan">Off-Plan</option>
            </select>
          </div>

          {/* PSF / PSM toggle */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Display Unit</Label>
            <div className="flex gap-1.5">
              {(["psf", "psm"] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    unit === u
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {u.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Property types */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Property Type</Label>
          <div className="flex flex-wrap gap-1.5">
            {PROPERTY_TYPES.map((pt) => (
              <button
                key={pt}
                onClick={() => setPropTypes((prev) => prev.includes(pt) ? prev.filter((x) => x !== pt) : [...prev, pt])}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  propTypes.includes(pt)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                }`}
              >
                {pt}
              </button>
            ))}
          </div>
        </div>

        {/* Bedrooms */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Bedrooms</Label>
          <div className="flex flex-wrap gap-1.5">
            {BEDROOM_OPTS.map((b) => (
              <button
                key={b}
                onClick={() => setBedrooms((prev) => prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b])}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  bedrooms.includes(b)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                }`}
              >
                {b === "0" ? "Studio" : `${b} BR`}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={fetchData} disabled={loading || !target} className="gap-2">
          <BarChart2 className="h-4 w-4" />
          {loading ? "Analyzing…" : "Analyze Price Trend"}
        </Button>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* First point */}
            {firstPoint && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Starting Point</p>
                <p className="text-xs text-gray-400 mb-2">{firstPoint.label}</p>
                <p className="text-lg font-bold text-gray-900">
                  {new Intl.NumberFormat().format(Math.round(psfDisplay(firstPoint.medianPsf)))}
                </p>
                <p className="text-xs text-gray-500">AED /{unit === "psm" ? "sqm" : "sqft"}</p>
                <p className="text-xs text-gray-400 mt-1">{firstPoint.txCount} transactions</p>
              </div>
            )}

            {/* Last historical point */}
            {lastPoint && lastPoint !== firstPoint && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Latest</p>
                <p className="text-xs text-gray-400 mb-2">{lastPoint.label}</p>
                <p className="text-lg font-bold text-gray-900">
                  {new Intl.NumberFormat().format(Math.round(psfDisplay(lastPoint.medianPsf)))}
                </p>
                <p className="text-xs text-gray-500">AED /{unit === "psm" ? "sqm" : "sqft"}</p>
                <p className={`text-xs mt-1 font-medium ${pctColor(lastPoint.changeVsPrev)}`}>
                  {fmtPct(lastPoint.changeVsPrev)} vs prev quarter
                </p>
              </div>
            )}

            {/* Overall change */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Overall Change</p>
              <p className="text-xs text-gray-400 mb-2">{firstPoint?.label} → {lastPoint?.label}</p>
              <div className="flex items-center gap-1.5">
                {overallPct != null && overallPct > 0 && <ArrowUpRight className="h-5 w-5 text-green-600" />}
                {overallPct != null && overallPct < 0 && <ArrowDownRight className="h-5 w-5 text-red-600" />}
                {overallPct == null && <Minus className="h-5 w-5 text-gray-400" />}
                <p className={`text-lg font-bold ${pctColor(overallPct)}`}>{fmtPct(overallPct)}</p>
              </div>
              <p className="text-xs text-gray-400 mt-1">{data.totalTransactions.toLocaleString()} total transactions</p>
            </div>

            {/* Trend + confidence */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Trend</p>
              <div className="flex items-center gap-1.5 mb-2">
                {data.regression.trend === "UP"   && <TrendingUp   className="h-5 w-5 text-green-600" />}
                {data.regression.trend === "DOWN" && <TrendingDown className="h-5 w-5 text-red-600" />}
                {data.regression.trend === "FLAT" && <Minus        className="h-5 w-5 text-gray-400" />}
                <span className={`text-lg font-bold ${
                  data.regression.trend === "UP" ? "text-green-700" :
                  data.regression.trend === "DOWN" ? "text-red-700" : "text-gray-500"
                }`}>{data.regression.trend}</span>
              </div>
              <ConfidenceBadge r2={data.regression.r2} />
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">
                    Price per {unit === "psm" ? "sqm" : "sqft"} — {data.target}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Historical (solid) + Forecast for next 2 quarters (dashed)
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis
                    tickFormatter={(v) => {
                      const val = unit === "psm" ? v * PSM_FACTOR : v;
                      return val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(Math.round(val));
                    }}
                    tick={{ fontSize: 11 }}
                    width={52}
                  />
                  <Tooltip content={<CustomTooltip unit={unit} />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />

                  {/* Forecast confidence band */}
                  <Area
                    dataKey="bandHigh"
                    stroke="none"
                    fill="#7c3aed"
                    fillOpacity={0.08}
                    legendType="none"
                    name="Forecast Band High"
                    connectNulls
                  />
                  <Area
                    dataKey="bandLow"
                    stroke="none"
                    fill="#ffffff"
                    fillOpacity={1}
                    legendType="none"
                    name="Forecast Band Low"
                    connectNulls
                  />

                  {/* Historical line */}
                  <Line
                    type="monotone"
                    dataKey="psf"
                    name={`Median ${unit.toUpperCase()} (historical)`}
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#2563eb" }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />

                  {/* Forecast line */}
                  <Line
                    type="monotone"
                    dataKey="forecastPsf"
                    name={`Forecast ${unit.toUpperCase()}`}
                    stroke="#7c3aed"
                    strokeWidth={2.5}
                    strokeDasharray="6 3"
                    dot={{ r: 4, fill: "#7c3aed", strokeWidth: 0 }}
                    connectNulls
                  />

                  {/* Divider between historical and forecast */}
                  {data.historical.length > 0 && (
                    <ReferenceLine
                      x={data.historical[data.historical.length - 1].label}
                      stroke="#d1d5db"
                      strokeDasharray="4 2"
                      label={{ value: "Today", fontSize: 10, fill: "#9ca3af", position: "top" }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 text-sm">
              No transaction data found for the selected filters.
            </div>
          )}

          {/* Data Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Quarterly Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Period</th>
                    <th className="text-right px-4 py-3 font-medium">Median {unit.toUpperCase()}</th>
                    <th className="text-right px-4 py-3 font-medium">vs Previous</th>
                    <th className="text-right px-4 py-3 font-medium">Transactions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.historical.map((h) => (
                    <tr key={h.label} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{h.label}</td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        AED {new Intl.NumberFormat().format(Math.round(psfDisplay(h.medianPsf)))}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${pctColor(h.changeVsPrev)}`}>
                        {fmtPct(h.changeVsPrev)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{h.txCount.toLocaleString()}</td>
                    </tr>
                  ))}
                  {data.forecast.map((f) => (
                    <tr key={f.label} className="bg-purple-50/50 hover:bg-purple-50">
                      <td className="px-4 py-3 font-medium text-purple-700 flex items-center gap-2">
                        {f.label}
                        <Badge className="text-[10px] bg-purple-100 text-purple-700 border-purple-200 px-1.5 py-0 h-4">Forecast</Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-purple-700 font-medium">
                        AED {new Intl.NumberFormat().format(Math.round(psfDisplay(f.medianPsf)))}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs">
                        Range: {new Intl.NumberFormat().format(Math.round(psfDisplay(f.low)))} –{" "}
                        {new Intl.NumberFormat().format(Math.round(psfDisplay(f.high)))}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Forecast note */}
          {data.forecast.length > 0 && (
            <p className="text-xs text-gray-400 px-1">
              Forecast is calculated using linear regression (OLS) on all historical quarters in the selected range.
              Confidence band represents ±1 standard deviation of regression residuals.
              Past performance does not guarantee future results.
            </p>
          )}
        </>
      )}
    </div>
  );
}
