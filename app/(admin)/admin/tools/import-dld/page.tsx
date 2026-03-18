"use client";

import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  ChevronRight,
  CheckCircle2,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  X,
  Database,
  RefreshCw,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const TRANSACTION_TYPES = ["Sales", "Mortgages", "Gifts"] as const;
type TransactionType = (typeof TRANSACTION_TYPES)[number];

const BATCH_SIZE = 300;

const TYPE_STYLES: Record<TransactionType, { badge: string; border: string; bg: string }> = {
  Sales:     { badge: "bg-green-100 text-green-700", border: "border-green-500", bg: "bg-green-50" },
  Mortgages: { badge: "bg-blue-100 text-blue-700",   border: "border-blue-500",  bg: "bg-blue-50"  },
  Gifts:     { badge: "bg-purple-100 text-purple-700", border: "border-purple-500", bg: "bg-purple-50" },
};

// ── DLD row shape (parsed from Excel) ────────────────────────────────────────

interface DLDRow {
  transactionId:     string;
  transGroup:        string;
  propertyTypeEn:    string;
  propertySubTypeEn: string | null;
  propertyUsageEn:   string | null;
  regTypeEn:         string | null;
  areaNameEn:        string;
  buildingNameEn:    string | null;
  projectNameEn:     string | null;
  roomsEn:           string | null;
  procedureAreaSqm:  number | null;
  actualWorth:       number | null;
  transactionDate:   string | null;
}

interface ParsedFile {
  name:            string;
  totalRows:       number;
  rows:            DLDRow[];
  byType:          Record<string, number>;
  byPropertyType:  Record<string, number>;
  byArea:          Record<string, number>;   // top-5 areas
  withProject:     number;
  withoutProject:  number;
}

interface ImportProgress {
  batchDone:  number;
  batchTotal: number;
  imported:   number;
  projectsCreated: number;
  skipped:    number;
  errors:     number;
}

// ── Excel row parser ──────────────────────────────────────────────────────────

function str(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  return s || null;
}

function num(v: unknown): number | null {
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, ""));
    return isFinite(n) ? n : null;
  }
  return null;
}

function parseDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().split("T")[0];
  if (typeof v === "number") {
    // Excel serial date
    try {
      const info = XLSX.SSF.parse_date_code(v);
      return `${info.y}-${String(info.m).padStart(2, "0")}-${String(info.d).padStart(2, "0")}`;
    } catch { return null; }
  }
  if (typeof v === "string") {
    const s = v.trim();
    // DD/MM/YYYY
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    // Already ISO or similar
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  return null;
}

function normalizeKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) out[k.trim()] = v;
  return out;
}

function parseRow(raw: Record<string, unknown>): DLDRow | null {
  const r = normalizeKeys(raw);
  const transactionId = str(r["transaction_id"]);
  if (!transactionId) return null;

  const areaNameEn = str(r["area_name_en"]) ?? "Unknown";
  const transGroup  = str(r["trans_group_en"]) ?? "Sales";

  // Date: prefer the standardized DATE column, fall back to instance_date
  const rawDate = r["DATE"] ?? r["instance_date"];
  const transactionDate = parseDate(rawDate);

  return {
    transactionId,
    transGroup,
    propertyTypeEn:    str(r["property_type_en"]) ?? "Unit",
    propertySubTypeEn: str(r["property_sub_type_en"]),
    propertyUsageEn:   str(r["property_usage_en"]),
    regTypeEn:         str(r["reg_type_en"]),
    areaNameEn,
    buildingNameEn:    str(r["building_name_en"]),
    projectNameEn:     str(r["project_name_en"]),
    roomsEn:           str(r["rooms_en"]),
    procedureAreaSqm:  num(r["procedure_area"]),
    actualWorth:       num(r["actual_worth"]),
    transactionDate,
  };
}

// ── xlsx → ParsedFile ─────────────────────────────────────────────────────────

function parseXLSX(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: null,
          raw: true,
        });

        const rows: DLDRow[] = [];
        const byType:         Record<string, number> = {};
        const byPropertyType: Record<string, number> = {};
        const allAreas:       Record<string, number> = {};
        let withProject = 0, withoutProject = 0;

        for (const raw of rawRows) {
          const row = parseRow(raw);
          if (!row) continue;
          rows.push(row);
          byType[row.transGroup]             = (byType[row.transGroup]             ?? 0) + 1;
          byPropertyType[row.propertyTypeEn] = (byPropertyType[row.propertyTypeEn] ?? 0) + 1;
          allAreas[row.areaNameEn]           = (allAreas[row.areaNameEn]           ?? 0) + 1;
          if (row.projectNameEn) withProject++; else withoutProject++;
        }

        // top-5 areas
        const byArea = Object.fromEntries(
          Object.entries(allAreas).sort((a, b) => b[1] - a[1]).slice(0, 5)
        );

        resolve({ name: file.name, totalRows: rows.length, rows, byType, byPropertyType, byArea, withProject, withoutProject });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtN(n: number) {
  return n.toLocaleString("en-AE");
}

function pct(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

// ── Step indicator ────────────────────────────────────────────────────────────

const STEP_LABELS = ["Upload File", "Configure", "Importing", "Done"] as const;

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEP_LABELS.map((label, i) => {
        const s = i + 1;
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
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color = "text-gray-900",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3">
      <p className={`text-2xl font-bold ${color}`}>{typeof value === "number" ? fmtN(value) : value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ImportDLDPage() {
  const [step, setStep]               = useState(1);
  const [parsing, setParsing]         = useState(false);
  const [parsed, setParsed]           = useState<ParsedFile | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<Set<TransactionType>>(
    new Set(TRANSACTION_TYPES)
  );
  const [prog, setProg] = useState<ImportProgress>({
    batchDone: 0, batchTotal: 0, imported: 0, projectsCreated: 0, skipped: 0, errors: 0,
  });
  const abortRef = useRef(false);

  // ── File drop ──────────────────────────────────────────────────────────────

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Please upload an .xlsx file");
      return;
    }
    setParsing(true);
    try {
      const result = await parseXLSX(file);
      if (result.totalRows === 0) {
        toast.error("No valid rows found in this file");
        return;
      }
      setParsed(result);
      setStep(2);
    } catch {
      toast.error("Failed to parse the Excel file — make sure it is a valid DLD export");
    } finally {
      setParsing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    multiple: false,
    disabled: parsing,
  });

  // ── Toggle transaction type ────────────────────────────────────────────────

  function toggleType(type: TransactionType) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  async function handleImport() {
    if (!parsed) return;
    abortRef.current = false;

    const filteredRows = parsed.rows.filter((r) =>
      selectedTypes.has(r.transGroup as TransactionType)
    );
    if (filteredRows.length === 0) {
      toast.error("No rows to import — select at least one transaction type");
      return;
    }

    // Split into batches
    const batches: DLDRow[][] = [];
    for (let i = 0; i < filteredRows.length; i += BATCH_SIZE) {
      batches.push(filteredRows.slice(i, i + BATCH_SIZE));
    }

    setStep(3);
    setProg({ batchDone: 0, batchTotal: batches.length, imported: 0, projectsCreated: 0, skipped: 0, errors: 0 });

    let totalImported = 0, totalCreated = 0, totalSkipped = 0, totalErrors = 0;

    for (let i = 0; i < batches.length; i++) {
      if (abortRef.current) break;

      try {
        const res = await fetch("/api/tools/dld-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: batches[i] }),
        });

        if (res.ok) {
          const data = await res.json();
          totalImported += data.imported   ?? 0;
          totalCreated  += data.projectsCreated ?? 0;
          totalSkipped  += data.skipped    ?? 0;
        } else {
          totalErrors += batches[i].length;
        }
      } catch {
        totalErrors += batches[i].length;
      }

      setProg({
        batchDone:       i + 1,
        batchTotal:      batches.length,
        imported:        totalImported,
        projectsCreated: totalCreated,
        skipped:         totalSkipped,
        errors:          totalErrors,
      });
    }

    setStep(4);
  }

  function handleReset() {
    abortRef.current = true;
    setParsed(null);
    setStep(1);
    setSelectedTypes(new Set(TRANSACTION_TYPES));
    setProg({ batchDone: 0, batchTotal: 0, imported: 0, projectsCreated: 0, skipped: 0, errors: 0 });
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const selectedCount = parsed
    ? parsed.rows.filter((r) => selectedTypes.has(r.transGroup as TransactionType)).length
    : 0;
  const batchCount  = Math.ceil(selectedCount / BATCH_SIZE);
  const progressPct = prog.batchTotal > 0
    ? Math.round((prog.batchDone / prog.batchTotal) * 100)
    : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import DLD Transactions</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload Dubai Land Department (DLD) transaction export files (.xlsx). Entries are matched
          to existing projects by name, or new projects are auto-created for unrecognised ones.
        </p>
      </div>

      <StepBar step={step} />

      {/* ── STEP 1: Upload ─────────────────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 1 — Upload a DLD Excel file (.xlsx)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-14 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              } ${parsing ? "opacity-60 cursor-wait" : ""}`}
            >
              <input {...getInputProps()} />
              {parsing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
                  <p className="text-sm font-medium text-gray-600">Parsing Excel file…</p>
                  <p className="text-xs text-gray-400">This may take a moment for large files</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center">
                    {isDragActive ? (
                      <Upload className="h-7 w-7 text-blue-500" />
                    ) : (
                      <FileSpreadsheet className="h-7 w-7 text-gray-400" />
                    )}
                  </div>
                  {isDragActive ? (
                    <p className="text-sm font-medium text-blue-600">Drop the file here</p>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-gray-700">
                        Drag & drop your DLD .xlsx file here
                      </p>
                      <p className="text-xs text-gray-400 mt-1">or click to browse files</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-500" />
              <span>
                Expected DLD export columns:{" "}
                <code className="font-mono">transaction_id</code>,{" "}
                <code className="font-mono">trans_group_en</code>,{" "}
                <code className="font-mono">property_type_en</code>,{" "}
                <code className="font-mono">project_name_en</code>,{" "}
                <code className="font-mono">area_name_en</code>,{" "}
                <code className="font-mono">procedure_area</code>,{" "}
                <code className="font-mono">actual_worth</code>,{" "}
                <code className="font-mono">DATE</code> and standard DLD fields.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 2: Configure ──────────────────────────────────────────────── */}
      {step === 2 && parsed && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Step 2 — Review & Configure</CardTitle>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"
                >
                  <X className="h-3.5 w-3.5" /> Change file
                </button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* File info */}
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <FileSpreadsheet className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{parsed.name}</p>
                  <p className="text-xs text-gray-500">
                    {fmtN(parsed.totalRows)} rows parsed successfully
                  </p>
                </div>
                <Badge className="bg-green-100 text-green-700 border-0">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Valid
                </Badge>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Total Rows"         value={parsed.totalRows}      />
                <StatCard label="With Project Name"  value={parsed.withProject}    color="text-green-600" />
                <StatCard label="Area-Only Rows"     value={parsed.withoutProject} color="text-orange-500" />
                <StatCard label="Unique Areas"       value={Object.keys(parsed.byArea).length + "+"} />
              </div>

              {/* Property type breakdown */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Property types</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(parsed.byPropertyType)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type}{" "}
                        <span className="text-gray-400 ml-1">
                          {fmtN(count)} ({pct(count, parsed.totalRows)})
                        </span>
                      </Badge>
                    ))}
                </div>
              </div>

              {/* Top areas */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Top 5 areas</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(parsed.byArea).map(([area, count]) => (
                    <Badge key={area} variant="outline" className="text-xs">
                      {area}{" "}
                      <span className="text-gray-400 ml-1">{fmtN(count)}</span>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Transaction type selector */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Select transaction types to import:
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {TRANSACTION_TYPES.map((type) => {
                    const count  = parsed.byType[type] ?? 0;
                    const active = selectedTypes.has(type);
                    const style  = TYPE_STYLES[type];
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => toggleType(type)}
                        className={`rounded-xl border-2 px-4 py-3 text-left transition-all ${
                          active
                            ? `${style.border} ${style.bg}`
                            : "border-gray-200 bg-white opacity-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{type}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {fmtN(count)} rows ({pct(count, parsed.totalRows)})
                            </p>
                          </div>
                          <div
                            className={`mt-0.5 h-5 w-5 flex-shrink-0 rounded border-2 flex items-center justify-center ${
                              active
                                ? `${style.border} bg-white`
                                : "border-gray-300"
                            }`}
                          >
                            {active && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Import summary & CTA */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-bold text-blue-900">
                    {fmtN(selectedCount)} rows will be imported
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    ~{batchCount} batches of {BATCH_SIZE} rows each · Projects are matched by name
                    or auto-created · Areas used as project name when project field is empty
                  </p>
                </div>
                <Button
                  onClick={handleImport}
                  disabled={selectedCount === 0}
                  className="shrink-0 gap-2"
                  size="lg"
                >
                  <Database className="h-4 w-4" />
                  Start Import
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── STEP 3: Importing ──────────────────────────────────────────────── */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 3 — Importing…</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  Batch {fmtN(prog.batchDone)} of {fmtN(prog.batchTotal)}
                </span>
                <span className="font-semibold text-gray-700">{progressPct}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                Processing {fmtN(prog.batchDone * BATCH_SIZE)} of ~{fmtN(selectedCount)} rows —
                do not close this tab.
              </p>
            </div>

            {/* Live stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Rows Imported"    value={prog.imported}        color="text-green-600" />
              <StatCard label="Projects Created" value={prog.projectsCreated} color="text-blue-600"  />
              <StatCard label="Rows Skipped"     value={prog.skipped}         color="text-orange-500" />
              <StatCard label="Errors"           value={prog.errors}          color="text-red-500"   />
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              Processing batch {prog.batchDone + 1} of {prog.batchTotal}…
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 4: Done ───────────────────────────────────────────────────── */}
      {step === 4 && (
        <Card>
          <CardContent className="pt-10 pb-10">
            <div className="flex flex-col items-center text-center gap-5">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-green-600" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900">Import Complete</h2>
                <p className="text-sm text-gray-500 mt-1">
                  DLD 2025 transaction entries have been added to the database.
                </p>
              </div>

              {/* Final stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-lg">
                <StatCard label="Rows Imported"    value={prog.imported}        color="text-green-600" />
                <StatCard label="Projects Created" value={prog.projectsCreated} color="text-blue-600"  />
                <StatCard label="Rows Skipped"     value={prog.skipped}         color="text-orange-500" />
                <StatCard label="Errors"           value={prog.errors}          color="text-red-500"   />
              </div>

              {prog.errors > 0 && (
                <div className="flex gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 text-left max-w-lg w-full">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    {fmtN(prog.errors)} rows failed. This is usually caused by a temporary
                    database timeout. You can re-import the same file — duplicate
                    entries will be detected via the DLD transaction ID stored in the notes field.
                  </span>
                </div>
              )}

              <Button variant="outline" onClick={handleReset} className="gap-2 mt-2">
                <RefreshCw className="h-4 w-4" />
                Import Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
