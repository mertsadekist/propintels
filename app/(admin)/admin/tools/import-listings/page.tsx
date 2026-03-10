"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  ChevronRight,
  Download,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Search,
  X,
} from "lucide-react";

interface ParsedListing {
  externalId: string;
  title: string;
  propertyType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqft: number | null;
  askPrice: number | null;
  locationLabel: string;
  isFeatured: boolean;
}

interface Project {
  id: string;
  name: string;
  location?: string | null;
}

interface SelectableListing extends ParsedListing {
  selected: boolean;
}

function fmtN(n: number) {
  return n.toLocaleString("en-AE", { maximumFractionDigits: 0 });
}

function calcPsf(askPrice: number | null, areaSqft: number | null): string {
  if (!askPrice || !areaSqft || areaSqft === 0) return "—";
  return fmtN(Math.round(askPrice / areaSqft));
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  APARTMENT: "Apartment",
  VILLA: "Villa",
  TOWNHOUSE: "Townhouse",
  PENTHOUSE: "Penthouse",
  DUPLEX: "Duplex",
  OFFICE: "Office",
  RETAIL: "Retail",
  WAREHOUSE: "Warehouse",
  LAND: "Land",
  OTHER: "Other",
};

// ── Searchable Project Combobox ──────────────────────────────────────────────
function ProjectCombobox({
  projects,
  value,
  onChange,
}: {
  projects: Project[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = projects.find((p) => p.id === value);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = query.trim()
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          (p.location ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : projects;

  function handleSelect(p: Project) {
    onChange(p.id);
    setQuery("");
    setOpen(false);
  }

  function handleClear() {
    onChange("");
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <Input
          className="pl-9 pr-8"
          placeholder="Search project by name or location…"
          value={selected && !open ? selected.name : query}
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Selected project badge */}
      {selected && !open && (
        <p className="text-xs text-gray-500 mt-1">
          Selected:{" "}
          <span className="font-medium text-blue-700">{selected.name}</span>
          {selected.location && (
            <span className="text-gray-400"> — {selected.location}</span>
          )}
        </p>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-400 text-center">
              No projects match &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between gap-2 ${
                  p.id === value ? "bg-blue-50 text-blue-700" : "text-gray-800"
                }`}
                onClick={() => handleSelect(p)}
              >
                <span className="font-medium truncate">{p.name}</span>
                {p.location && (
                  <span className="text-xs text-gray-400 shrink-0">{p.location}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3;

export default function ImportListingsPage() {
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [url, setUrl] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  // Step 2
  const [listings, setListings] = useState<SelectableListing[]>([]);

  // Step 3
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  // Load all projects for combobox
  useEffect(() => {
    fetch("/api/projects?pageSize=500&isActive=true")
      .then((r) => r.json())
      .then((j) => setProjects(j.data ?? []))
      .catch(console.error);
  }, []);

  const selectedProject = projects.find((p) => p.id === projectId);
  const selectedCount = listings.filter((l) => l.selected).length;

  // Step 1 → Fetch
  async function handleFetch() {
    if (!url.trim() || !projectId) {
      toast.error("Please enter a URL and select a target project.");
      return;
    }
    setFetching(true);
    setFetchMessage(null);
    setBlocked(false);
    try {
      const res = await fetch("/api/tools/pf-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error?.message ?? "Failed to extract data.");
        return;
      }

      if (data.blocked) {
        setBlocked(true);
        setFetchMessage(
          data.message ??
            "Request blocked by PropertyFinder (Cloudflare). Try again later or enter data manually."
        );
        return;
      }

      if (!data.listings?.length) {
        setFetchMessage(
          data.message ?? "No listings found on this page."
        );
        return;
      }

      setListings(data.listings.map((l: ParsedListing) => ({ ...l, selected: true })));
      setStep(2);
    } catch {
      toast.error("Connection error. Please try again.");
    } finally {
      setFetching(false);
    }
  }

  // Step 2 helpers
  function toggleAll(val: boolean) {
    setListings((prev) => prev.map((l) => ({ ...l, selected: val })));
  }

  function excludeFeatured() {
    setListings((prev) =>
      prev.map((l) => ({ ...l, selected: l.isFeatured ? false : l.selected }))
    );
  }

  function toggleOne(externalId: string) {
    setListings((prev) =>
      prev.map((l) => (l.externalId === externalId ? { ...l, selected: !l.selected } : l))
    );
  }

  // Step 3 → Import
  async function handleImport() {
    const toImport = listings.filter((l) => l.selected);
    if (!toImport.length) {
      toast.error("Select at least one listing to import.");
      return;
    }
    setImporting(true);
    try {
      const rows = toImport.map((l) => ({
        sourceType: "LISTING",
        propertyType: l.propertyType,
        bedrooms: l.bedrooms ?? undefined,
        bathrooms: l.bathrooms ?? undefined,
        areaSqft: l.areaSqft ?? undefined,
        askPrice: l.askPrice ?? undefined,
        locationLabel: l.locationLabel || l.title || undefined,
        portal: "PropertyFinder",
        notes: l.isFeatured ? "Featured/AD listing" : undefined,
      }));

      const res = await fetch(`/api/projects/${projectId}/entries/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error?.message ?? "Import failed.");
        return;
      }

      setImportedCount(data.count);
      setStep(3);
    } catch {
      toast.error("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  function handleReset() {
    setStep(1);
    setUrl("");
    setProjectId("");
    setListings([]);
    setImportedCount(null);
    setFetchMessage(null);
    setBlocked(false);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Listings from PropertyFinder</h1>
        <p className="text-sm text-gray-500 mt-1">
          Extract property listings from a PropertyFinder search URL and add them as entries to a
          selected project.
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {(["Enter URL", "Review & Filter", "Done"] as const).map((label, i) => {
          const s = (i + 1) as Step;
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="h-4 w-4 text-gray-300" />}
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  step === s
                    ? "bg-blue-600 text-white"
                    : step > s
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {step > s ? <CheckCircle2 className="h-3 w-3" /> : <span>{s}</span>}
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 1 — Enter the PropertyFinder URL and target project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Warning */}
            <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                Scraping data from PropertyFinder may violate their Terms of Service. This tool is
                for internal use only and is used at your own risk.
              </span>
            </div>

            {/* URL */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                PropertyFinder Search URL
              </label>
              <Input
                placeholder="https://www.propertyfinder.ae/en/search?l=17793&c=1&fu=0&ob=mr"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-xs text-gray-400">
                Copy the URL from PropertyFinder after searching for the project or location you
                want to import.
              </p>
            </div>

            {/* Project — searchable combobox */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Target Project</label>
              <ProjectCombobox
                projects={projects}
                value={projectId}
                onChange={setProjectId}
              />
              <p className="text-xs text-gray-400">
                Listings will be imported as entries into this project.
              </p>
            </div>

            {/* Error / blocked message */}
            {fetchMessage && (
              <div
                className={`flex gap-2 rounded-lg p-3 text-sm ${
                  blocked
                    ? "bg-red-50 border border-red-200 text-red-700"
                    : "bg-gray-50 border border-gray-200 text-gray-600"
                }`}
              >
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{fetchMessage}</span>
              </div>
            )}

            <Button onClick={handleFetch} disabled={fetching || !url.trim() || !projectId}>
              {fetching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Extracting data…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" /> Extract Listings
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg p-4">
            <div>
              <p className="font-semibold text-gray-900">
                {listings.length} listings extracted from PropertyFinder
              </p>
              <p className="text-sm text-gray-500">
                Target project:{" "}
                <span className="font-medium text-blue-700">{selectedProject?.name}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>
                Deselect All
              </Button>
              {listings.some((l) => l.isFeatured) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-300 text-orange-700 hover:bg-orange-50"
                  onClick={excludeFeatured}
                >
                  Exclude AD listings
                </Button>
              )}
            </div>
          </div>

          {/* Counter */}
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{selectedCount}</span> of{" "}
            <span className="font-semibold">{listings.length}</span> listings selected for import
          </p>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2.5 text-left w-10">
                        <input
                          type="checkbox"
                          checked={selectedCount === listings.length && listings.length > 0}
                          onChange={(e) => toggleAll(e.target.checked)}
                          className="rounded"
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Type</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600">BR</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600">Bath</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">Area (sqft)</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">Price (AED)</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">PSF</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Location</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600">AD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map((l, i) => (
                      <tr
                        key={l.externalId}
                        className={`border-b border-gray-100 cursor-pointer transition-colors ${
                          !l.selected
                            ? "opacity-40"
                            : i % 2 === 0
                            ? "hover:bg-gray-50"
                            : "bg-gray-50/40 hover:bg-gray-50"
                        }`}
                        onClick={() => toggleOne(l.externalId)}
                      >
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={l.selected}
                            onChange={() => toggleOne(l.externalId)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-xs">
                            {PROPERTY_TYPE_LABELS[l.propertyType] ?? l.propertyType}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">
                          {l.bedrooms !== null ? l.bedrooms : "—"}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">
                          {l.bathrooms !== null ? l.bathrooms : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700 font-medium">
                          {l.areaSqft ? fmtN(l.areaSqft) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">
                          {l.askPrice ? fmtN(l.askPrice) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-gray-500">
                          {calcPsf(l.askPrice, l.areaSqft)}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 max-w-[180px] truncate">
                          {l.locationLabel || "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {l.isFeatured && (
                            <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                              AD
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={handleImport} disabled={selectedCount === 0 || importing}>
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" /> Import {selectedCount}{" "}
                  {selectedCount === 1 ? "listing" : "listings"}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3 ── */}
      {step === 3 && (
        <Card>
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Import Successful!</h2>
                <p className="text-gray-500 mt-1">
                  <span className="font-semibold text-gray-900">{importedCount}</span>{" "}
                  {importedCount === 1 ? "listing was" : "listings were"} imported into{" "}
                  <span className="font-semibold text-blue-700">{selectedProject?.name}</span>.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Portal: PropertyFinder — review them in the project&apos;s Entries page.
                </p>
              </div>
              <div className="flex gap-3 mt-2">
                <Button variant="outline" onClick={handleReset}>
                  Import Another Batch
                </Button>
                {projectId && (
                  <Button asChild>
                    <Link href={`/admin/projects/${projectId}/entries`}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Entries
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
