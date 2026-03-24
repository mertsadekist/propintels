"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  Search,
  CalendarDays,
  DollarSign,
  Maximize2,
  MapPin,
  Building2,
  LayoutGrid,
  BedDouble,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AnalyticsFilters {
  areas:         string[];   // multi-select
  projects:      string[];   // multi-select
  propertyTypes: string[];   // multi-select chips
  bedrooms:      string[];   // multi-chip
  category:      string;     // "" | "RESIDENTIAL" | "COMMERCIAL"
  unitType:      string;     // "" | "ready" | "offplan"
  dateFrom:      string;
  dateTo:        string;
  priceMin:      string;
  priceMax:      string;
  areaSqftMin:   string;
  areaSqftMax:   string;
}

export const EMPTY_FILTERS: AnalyticsFilters = {
  areas: [], projects: [], propertyTypes: [], bedrooms: [],
  category: "", unitType: "", dateFrom: "", dateTo: "",
  priceMin: "", priceMax: "", areaSqftMin: "", areaSqftMax: "",
};

/** Convert new AnalyticsFilters to legacy API query params (single-value compat) */
export function filtersToParams(f: AnalyticsFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.areas.length)         sp.set("areas",         f.areas.join(","));
  if (f.projects.length)      sp.set("projects",      f.projects.join(","));
  if (f.propertyTypes.length) sp.set("propertyTypes", f.propertyTypes.join(","));
  if (f.bedrooms.length)      sp.set("bedrooms",      f.bedrooms.join(","));
  if (f.category)             sp.set("category",      f.category);
  if (f.unitType)             sp.set("unitType",      f.unitType);
  if (f.dateFrom)             sp.set("dateFrom",      f.dateFrom);
  if (f.dateTo)               sp.set("dateTo",        f.dateTo);
  if (f.priceMin)             sp.set("priceMin",      f.priceMin);
  if (f.priceMax)             sp.set("priceMax",      f.priceMax);
  if (f.areaSqftMin)          sp.set("areaSqftMin",   f.areaSqftMin);
  if (f.areaSqftMax)          sp.set("areaSqftMax",   f.areaSqftMax);
  return sp;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const PROPERTY_TYPES = [
  { value: "APARTMENT",  label: "Apartment" },
  { value: "VILLA",      label: "Villa" },
  { value: "TOWNHOUSE",  label: "Townhouse" },
  { value: "PENTHOUSE",  label: "Penthouse" },
  { value: "DUPLEX",     label: "Duplex" },
  { value: "OFFICE",     label: "Office" },
  { value: "RETAIL",     label: "Retail" },
  { value: "WAREHOUSE",  label: "Warehouse" },
  { value: "LAND",       label: "Land" },
  { value: "OTHER",      label: "Other" },
];

const BEDROOM_OPTIONS = [
  { value: "0", label: "Studio" },
  { value: "1", label: "1 BR"   },
  { value: "2", label: "2 BR"   },
  { value: "3", label: "3 BR"   },
  { value: "4", label: "4 BR"   },
  { value: "5", label: "5 BR+"  },
];

const DATE_PRESETS = [
  { key: "30d",  label: "30D"  },
  { key: "3m",   label: "3M"   },
  { key: "6m",   label: "6M"   },
  { key: "1y",   label: "1Y"   },
  { key: "ytd",  label: "YTD"  },
  { key: "2025", label: "2025" },
  { key: "2024", label: "2024" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function applyPreset(preset: string): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const to = fmt(today);
  if (preset === "30d") { const f = new Date(today); f.setDate(f.getDate() - 30);           return { from: fmt(f), to }; }
  if (preset === "3m")  { const f = new Date(today); f.setMonth(f.getMonth() - 3);           return { from: fmt(f), to }; }
  if (preset === "6m")  { const f = new Date(today); f.setMonth(f.getMonth() - 6);           return { from: fmt(f), to }; }
  if (preset === "1y")  { const f = new Date(today); f.setFullYear(f.getFullYear() - 1);     return { from: fmt(f), to }; }
  if (preset === "ytd") return { from: `${today.getFullYear()}-01-01`, to };
  if (preset === "2025") return { from: "2025-01-01", to: "2025-12-31" };
  if (preset === "2024") return { from: "2024-01-01", to: "2024-12-31" };
  return { from: "", to: "" };
}

function toggleInArray(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

function fmtPrice(v: string): string {
  const n = parseInt(v, 10);
  if (isNaN(n)) return v;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ─── Active chips builder ───────────────────────────────────────────────────

interface Chip { key: string; label: string; onRemove: () => AnalyticsFilters; }

function buildChips(f: AnalyticsFilters): Chip[] {
  const chips: Chip[] = [];
  f.areas.forEach((a) => chips.push({
    key: `area-${a}`, label: a,
    onRemove: () => ({ ...f, areas: f.areas.filter((x) => x !== a) }),
  }));
  f.projects.forEach((p) => chips.push({
    key: `proj-${p}`, label: p,
    onRemove: () => ({ ...f, projects: f.projects.filter((x) => x !== p) }),
  }));
  f.propertyTypes.forEach((pt) => {
    const lbl = PROPERTY_TYPES.find((t) => t.value === pt)?.label ?? pt;
    chips.push({ key: `pt-${pt}`, label: lbl, onRemove: () => ({ ...f, propertyTypes: f.propertyTypes.filter((x) => x !== pt) }) });
  });
  f.bedrooms.forEach((b) => {
    const lbl = BEDROOM_OPTIONS.find((o) => o.value === b)?.label ?? `${b}BR`;
    chips.push({ key: `br-${b}`, label: lbl, onRemove: () => ({ ...f, bedrooms: f.bedrooms.filter((x) => x !== b) }) });
  });
  if (f.category) chips.push({ key: "cat", label: f.category === "RESIDENTIAL" ? "Residential" : "Commercial", onRemove: () => ({ ...f, category: "" }) });
  if (f.unitType) chips.push({ key: "ut", label: f.unitType === "ready" ? "Ready" : "Off-Plan", onRemove: () => ({ ...f, unitType: "" }) });
  if (f.dateFrom || f.dateTo) chips.push({
    key: "date",
    label: `${f.dateFrom || "…"} → ${f.dateTo || "…"}`,
    onRemove: () => ({ ...f, dateFrom: "", dateTo: "" }),
  });
  if (f.priceMin || f.priceMax) chips.push({
    key: "price",
    label: `AED ${fmtPrice(f.priceMin) || "0"} – ${fmtPrice(f.priceMax) || "∞"}`,
    onRemove: () => ({ ...f, priceMin: "", priceMax: "" }),
  });
  if (f.areaSqftMin || f.areaSqftMax) chips.push({
    key: "sqft",
    label: `${f.areaSqftMin || "0"} – ${f.areaSqftMax || "∞"} sqft`,
    onRemove: () => ({ ...f, areaSqftMin: "", areaSqftMax: "" }),
  });
  return chips;
}

function countAdvanced(f: AnalyticsFilters): number {
  let n = 0;
  if (f.areas.length)         n++;
  if (f.projects.length)      n++;
  if (f.propertyTypes.length) n++;
  if (f.bedrooms.length)      n++;
  if (f.category)             n++;
  if (f.priceMin || f.priceMax)       n++;
  if (f.areaSqftMin || f.areaSqftMax) n++;
  return n;
}

// ─── Multi-select area popover ──────────────────────────────────────────────

function AreaMultiSelect({
  areas,
  selected,
  onChange,
}: {
  areas: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = areas.filter((a) => a.toLowerCase().includes(search.toLowerCase()));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:border-gray-300 transition-colors">
          <MapPin className="h-3 w-3 text-gray-400" />
          {selected.length === 0 ? "All Areas" : `${selected.length} area${selected.length > 1 ? "s" : ""}`}
          <ChevronDown className="h-3 w-3 ml-1 text-gray-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
          <input
            className="w-full h-7 pl-7 pr-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Search areas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {selected.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="w-full text-xs text-red-500 text-left px-1 py-0.5 hover:underline mb-1"
          >
            Clear ({selected.length})
          </button>
        )}
        <div className="max-h-52 overflow-y-auto space-y-0.5">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No areas found</p>
          ) : (
            filtered.map((a) => (
              <label
                key={a}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(a)}
                  onChange={() => onChange(toggleInArray(selected, a))}
                  className="h-3 w-3 accent-blue-600"
                />
                <span className="truncate">{a}</span>
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

interface Props {
  initialFilters?: AnalyticsFilters;
  onApply: (filters: AnalyticsFilters) => void;
}

export function AnalyticsFiltersBar({ initialFilters, onApply }: Props) {
  const [areas, setAreas] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState<AnalyticsFilters>(initialFilters ?? EMPTY_FILTERS);
  const [applied, setApplied]   = useState<AnalyticsFilters>(initialFilters ?? EMPTY_FILTERS);
  const [activePreset, setActivePreset] = useState<string>("");

  // Load areas
  useEffect(() => {
    fetch("/api/analytics/areas")
      .then((r) => r.json())
      .then((j) => setAreas(j.data ?? []))
      .catch(console.error);
  }, []);

  const set = <K extends keyof AnalyticsFilters>(key: K, val: AnalyticsFilters[K]) =>
    setPending((prev) => ({ ...prev, [key]: val }));

  const handlePreset = (preset: string) => {
    const { from, to } = applyPreset(preset);
    setActivePreset(preset);
    setPending((prev) => ({ ...prev, dateFrom: from, dateTo: to }));
  };

  const handleApply = () => {
    setApplied(pending);
    onApply(pending);
  };

  const handleReset = () => {
    setPending(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setActivePreset("");
    onApply(EMPTY_FILTERS);
  };

  const handleChipRemove = (newFilters: AnalyticsFilters) => {
    setPending(newFilters);
    setApplied(newFilters);
    setActivePreset("");
    onApply(newFilters);
  };

  const chips = buildChips(applied);
  const advancedCount = countAdvanced(pending);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* ── Always-visible row ─────────────────────────────────────────── */}
      <div className="px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Unit type */}
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs shadow-sm shrink-0">
          {([
            { key: "",        label: "All"      },
            { key: "ready",   label: "✓ Ready"  },
            { key: "offplan", label: "⬡ Off-Plan" },
          ] as { key: string; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => set("unitType", key)}
              className={`px-3 py-1.5 transition-colors ${
                pending.unitType === key
                  ? key === "ready"
                    ? "bg-emerald-600 text-white"
                    : key === "offplan"
                    ? "bg-violet-600 text-white"
                    : "bg-gray-900 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date presets */}
        <div className="flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <div className="flex gap-0.5">
            {DATE_PRESETS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handlePreset(key)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  activePreset === key
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Manual date */}
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            className="h-7 text-xs w-32"
            value={pending.dateFrom}
            onChange={(e) => { set("dateFrom", e.target.value); setActivePreset(""); }}
          />
          <span className="text-gray-400 text-xs">–</span>
          <Input
            type="date"
            className="h-7 text-xs w-32"
            value={pending.dateTo}
            onChange={(e) => { set("dateTo", e.target.value); setActivePreset(""); }}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Advanced toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            expanded || advancedCount > 0
              ? "bg-blue-50 border-blue-200 text-blue-700"
              : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Filter className="h-3 w-3" />
          {advancedCount > 0 ? (
            <>Advanced <span className="bg-blue-600 text-white rounded-full px-1.5 py-0 text-[10px] font-bold ml-0.5">{advancedCount}</span></>
          ) : "Advanced"}
          {expanded ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
        </button>

        {/* Clear / Apply */}
        {(chips.length > 0 || advancedCount > 0) && (
          <button onClick={handleReset} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
            <X className="h-3 w-3" /> Clear all
          </button>
        )}
        <Button size="sm" className="h-7 text-xs" onClick={handleApply}>
          Apply
        </Button>
      </div>

      {/* ── Expanded advanced section ───────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/60 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Area multi-select */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Area
            </Label>
            <AreaMultiSelect
              areas={areas}
              selected={pending.areas}
              onChange={(v) => set("areas", v)}
            />
            {pending.areas.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {pending.areas.map((a) => (
                  <span key={a} className="inline-flex items-center gap-0.5 text-[10px] bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                    {a}
                    <button onClick={() => set("areas", pending.areas.filter((x) => x !== a))}>
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Property type chips */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <LayoutGrid className="h-3 w-3" /> Property Type
            </Label>
            <div className="flex flex-wrap gap-1">
              {PROPERTY_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => set("propertyTypes", toggleInArray(pending.propertyTypes, value))}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                    pending.propertyTypes.includes(value)
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Bedrooms chips */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <BedDouble className="h-3 w-3" /> Bedrooms
            </Label>
            <div className="flex flex-wrap gap-1">
              {BEDROOM_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => set("bedrooms", toggleInArray(pending.bedrooms, value))}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                    pending.bedrooms.includes(value)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <Building2 className="h-3 w-3" /> Category
            </Label>
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              {([
                { key: "",             label: "All"           },
                { key: "RESIDENTIAL",  label: "Residential"   },
                { key: "COMMERCIAL",   label: "Commercial"    },
              ] as { key: string; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => set("category", key)}
                  className={`px-3 py-1.5 transition-colors ${
                    pending.category === key
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Price range */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Price Range (AED)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Min"
                className="h-7 text-xs"
                value={pending.priceMin}
                onChange={(e) => set("priceMin", e.target.value)}
              />
              <span className="text-gray-400 text-xs shrink-0">–</span>
              <Input
                type="number"
                placeholder="Max"
                className="h-7 text-xs"
                value={pending.priceMax}
                onChange={(e) => set("priceMax", e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              {[["500K","500000"],["1M","1000000"],["2M","2000000"],["5M","5000000"]].map(([lbl, val]) => (
                <button key={lbl} onClick={() => set("priceMax", val)} className="text-[10px] bg-gray-100 hover:bg-gray-200 rounded px-1.5 py-0.5 text-gray-500">
                  ≤ {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Area size */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <Maximize2 className="h-3 w-3" /> Area Size (sqft)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Min"
                className="h-7 text-xs"
                value={pending.areaSqftMin}
                onChange={(e) => set("areaSqftMin", e.target.value)}
              />
              <span className="text-gray-400 text-xs shrink-0">–</span>
              <Input
                type="number"
                placeholder="Max"
                className="h-7 text-xs"
                value={pending.areaSqftMax}
                onChange={(e) => set("areaSqftMax", e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              {[["500","500"],["1000","1000"],["2000","2000"],["5000","5000"]].map(([lbl, val]) => (
                <button key={lbl} onClick={() => set("areaSqftMax", val)} className="text-[10px] bg-gray-100 hover:bg-gray-200 rounded px-1.5 py-0.5 text-gray-500">
                  ≤ {lbl}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Active chips row ────────────────────────────────────────────── */}
      {chips.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5"
            >
              {chip.label}
              <button
                onClick={() => handleChipRemove(chip.onRemove())}
                className="hover:text-red-500 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
