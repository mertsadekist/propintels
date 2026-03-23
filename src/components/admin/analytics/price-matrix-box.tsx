"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MapPin, Building2, BarChart2 } from "lucide-react";
import type { AnalyticsFilters } from "./filters-bar";

// ─── Types ─────────────────────────────────────────────────────────────────

type UnitTypeFilter = "all" | "ready" | "offplan";
type ModeFilter     = "area" | "project";
type MetricType     = "psf" | "psm";

interface CellData {
  psf:   number;
  psm:   number;
  count: number;
}

interface MatrixRow {
  name:  string;
  total: number;
  cells: Record<string, CellData | null>;
}

interface MatrixData {
  rows:        MatrixRow[];
  bedroomCols: number[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function bedroomLabel(br: number): string {
  if (br === 0) return "Studio";
  if (br >= 5)  return "5BR+";
  return `${br}BR`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-AE", { maximumFractionDigits: 0 });
}

/** Heat-map colour: EFF6FF (blue-50) → 1D4ED8 (blue-700) */
function heatBg(t: number): string {
  const r = Math.round(239 + (29  - 239) * t);
  const g = Math.round(246 + (78  - 246) * t);
  const b = Math.round(255 + (216 - 255) * t);
  return `rgb(${r},${g},${b})`;
}

function heatText(t: number): string {
  return t > 0.55 ? "#ffffff" : "#1e3a5f";
}

// Per-column min/max for relative colouring
function buildColMM(rows: MatrixRow[], cols: number[], metric: MetricType) {
  const mm = new Map<number, { min: number; max: number }>();
  for (const br of cols) {
    let min = Infinity, max = -Infinity;
    for (const row of rows) {
      const cell = row.cells[String(br)];
      if (cell) {
        const v = metric === "psf" ? cell.psf : cell.psm;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (min !== Infinity) mm.set(br, { min, max });
  }
  return mm;
}

// ─── Component ─────────────────────────────────────────────────────────────

interface Props {
  filters: AnalyticsFilters;
}

export function PriceMatrixBox({ filters }: Props) {
  const [mode,     setMode]     = useState<ModeFilter>("area");
  const [unitType, setUnitType] = useState<UnitTypeFilter>("all");
  const [metric,   setMetric]   = useState<MetricType>("psf");
  const [data,     setData]     = useState<MatrixData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const fetchData = useCallback(
    async (m: ModeFilter, ut: UnitTypeFilter, f: AnalyticsFilters) => {
      setLoading(true);
      setError(null);
      try {
        const sp = new URLSearchParams({ mode: m, unitType: ut, limit: "25" });
        if (f.dateFrom)    sp.set("dateFrom",     f.dateFrom);
        if (f.dateTo)      sp.set("dateTo",       f.dateTo);
        if (f.propertyType) sp.set("propertyType", f.propertyType);
        if (f.category)    sp.set("category",     f.category);
        // area filter only meaningful for project mode
        if (m === "project" && f.area) sp.set("area", f.area);

        const res = await fetch(`/api/analytics/price-matrix?${sp}`);
        if (!res.ok) throw new Error("Failed to load price matrix");
        const json = await res.json();
        setData(json.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchData(mode, unitType, filters);
  }, [mode, unitType, filters, fetchData]);

  const bedroomCols = data?.bedroomCols ?? [];
  const colMM       = data ? buildColMM(data.rows, bedroomCols, metric) : new Map();

  // ── Unit type badge colour ───────────────────────────────────────────
  const unitBadge: Record<UnitTypeFilter, string> = {
    all:     "bg-gray-100 text-gray-700",
    ready:   "bg-emerald-100 text-emerald-700",
    offplan: "bg-violet-100 text-violet-700",
  };

  return (
    <Card>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* Title */}
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-blue-600 shrink-0" />
            <div>
              <CardTitle className="text-base font-semibold">
                Price Matrix
                <span className="ml-1 text-gray-400 font-normal">—</span>
                <span className="ml-1 font-normal text-gray-600">
                  {mode === "area" ? "By Area" : "By Project"} × Bedrooms
                </span>
              </CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">
                Median{" "}
                <span className="font-semibold text-blue-600">
                  {metric === "psf" ? "PSF (AED/sqft)" : "PSM (AED/sqm)"}
                </span>{" "}
                · top 25 by volume
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Mode toggle */}
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs shadow-sm">
              {(
                [
                  { key: "area",    label: "By Area",    Icon: MapPin     },
                  { key: "project", label: "By Project", Icon: Building2  },
                ] as { key: ModeFilter; label: string; Icon: React.ElementType }[]
              ).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${
                    mode === key
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>

            {/* Metric toggle */}
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs shadow-sm">
              {(["psf", "psm"] as MetricType[]).map((mt) => (
                <button
                  key={mt}
                  onClick={() => setMetric(mt)}
                  className={`px-3 py-1.5 font-semibold transition-colors ${
                    metric === mt
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {mt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Unit type pills */}
        <div className="flex gap-1.5 mt-1 flex-wrap">
          {(
            [
              { key: "all",     label: "All Transactions" },
              { key: "ready",   label: "✓ Ready (Existing)" },
              { key: "offplan", label: "⬡ Off-Plan" },
            ] as { key: UnitTypeFilter; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setUnitType(key)}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                unitType === key
                  ? `${unitBadge[key]} border-transparent font-semibold shadow-sm`
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </CardHeader>

      {/* ─── Body ───────────────────────────────────────────────────── */}
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
          </div>
        ) : error ? (
          <div className="text-red-500 text-sm px-6 py-4">{error}</div>
        ) : !data || data.rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
            <BarChart2 className="h-8 w-8 opacity-30" />
            <p className="text-sm">No transaction data for this selection</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              {/* Head */}
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  {/* Row label */}
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 sticky left-0 z-10 bg-gray-50 min-w-[160px] border-r border-gray-200">
                    {mode === "area" ? "Area" : "Project"}
                  </th>
                  {/* Total txns */}
                  <th className="text-right px-3 py-2.5 font-semibold text-gray-500 whitespace-nowrap border-r border-gray-100">
                    Total Txns
                  </th>
                  {/* Bedroom columns */}
                  {bedroomCols.map((br) => (
                    <th
                      key={br}
                      className="text-center px-3 py-2.5 font-semibold text-gray-700 whitespace-nowrap min-w-[90px]"
                    >
                      {bedroomLabel(br)}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Body */}
              <tbody>
                {data.rows.map((row, ri) => (
                  <tr
                    key={row.name}
                    className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${
                      ri % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                    }`}
                  >
                    {/* Row name */}
                    <td
                      className="px-4 py-2 font-medium text-gray-800 sticky left-0 z-10 bg-inherit border-r border-gray-100 max-w-[200px] truncate"
                      title={row.name}
                    >
                      {row.name}
                    </td>

                    {/* Total */}
                    <td className="px-3 py-2 text-right text-gray-500 tabular-nums border-r border-gray-100">
                      {fmtNum(row.total)}
                    </td>

                    {/* Cells */}
                    {bedroomCols.map((br) => {
                      const cell = row.cells[String(br)];
                      if (!cell) {
                        return (
                          <td key={br} className="px-3 py-2 text-center text-gray-200 text-[11px]">
                            —
                          </td>
                        );
                      }
                      const val = metric === "psf" ? cell.psf : cell.psm;
                      const mm  = colMM.get(br);
                      const t   = mm && mm.max !== mm.min
                        ? (val - mm.min) / (mm.max - mm.min)
                        : 0.5;
                      const bg  = heatBg(t);
                      const fg  = heatText(t);

                      return (
                        <td
                          key={br}
                          className="px-3 py-2 text-center tabular-nums transition-colors"
                          style={{ backgroundColor: bg, color: fg }}
                        >
                          <div className="font-semibold text-[12px] leading-tight">
                            {fmtNum(val)}
                          </div>
                          <div className="text-[10px] mt-0.5 opacity-70">
                            {cell.count.toLocaleString()} txn
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>

              {/* Footer: column medians */}
              {data.rows.length > 3 && (
                <tfoot>
                  <tr className="bg-gray-100 border-t-2 border-gray-300">
                    <td className="px-4 py-2 font-semibold text-gray-600 sticky left-0 bg-gray-100 z-10 border-r border-gray-200 text-xs">
                      Avg across rows
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500 tabular-nums border-r border-gray-100 text-xs">
                      {fmtNum(data.rows.reduce((s, r) => s + r.total, 0))}
                    </td>
                    {bedroomCols.map((br) => {
                      const vals = data.rows
                        .map((r) => r.cells[String(br)])
                        .filter((c): c is CellData => !!c)
                        .map((c) => (metric === "psf" ? c.psf : c.psm));
                      const avg = vals.length
                        ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
                        : null;
                      return (
                        <td key={br} className="px-3 py-2 text-center font-semibold text-gray-700 tabular-nums text-xs">
                          {avg !== null ? fmtNum(avg) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Legend */}
        {data && data.rows.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
            <span>
              Median {metric.toUpperCase()} · heatmap relative per column
            </span>
            <div className="flex items-center gap-1.5">
              <span>Low</span>
              <div
                className="h-3 w-20 rounded"
                style={{
                  background:
                    "linear-gradient(to right, rgb(239,246,255), rgb(29,78,216))",
                }}
              />
              <span>High</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
