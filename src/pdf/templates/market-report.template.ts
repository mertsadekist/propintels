import type { BrandingConfig } from "./types";

const SQM_TO_SQFT = 10.7639;

function fmtN(n: number, dec = 0): string {
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: dec }).format(n);
}

function fmtPsf(psf: number): string {
  const ppsm = psf * SQM_TO_SQFT;
  return `${fmtN(psf)} AED/sqft<br/><span class="sub">${fmtN(ppsm)} AED/sqm</span>`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function diffColor(pct: number | null): string {
  if (pct === null) return "#6b7280";
  if (pct > 5) return "#ef4444";
  if (pct < -5) return "#3b82f6";
  return "#22c55e";
}

function qoqColor(pct: number | null): string {
  if (pct === null) return "#6b7280";
  if (pct > 2) return "#ef4444";
  if (pct < -2) return "#3b82f6";
  return "#22c55e";
}

export interface MarketReportFilters {
  area?: string;
  propertyType?: string;
  bedrooms?: number;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
}

export interface AreaBreakdownRow {
  area: string;
  txnCount: number;
  txnMedianPsf: number;
  txnMinPsf: number;
  txnMaxPsf: number;
  listingCount: number;
  listingAvgPsf: number;
  diffPct: number | null;
}

export interface QuarterlyTrendRow {
  yr: number;
  q: number;
  label: string;
  txnCount: number;
  txnMedianPsf: number;
  txnAvgPsf: number;
  txnMinPsf: number;
  txnMaxPsf: number;
  qoqPct: number | null;
}

export interface MarketReportData {
  summary: {
    totalTransactions: number;
    totalListings: number;
    overallMedianPsf: number;
    overallAvgDealSize: number;
    periodsCount: number;
    qoqChange: number | null;
  };
  areaBreakdown: AreaBreakdownRow[];
  quarterlyTrends: QuarterlyTrendRow[];
  filters: MarketReportFilters;
}

// Validate CSS color values to prevent CSS injection via branding config.
function sanitizeCssColor(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const v = value.trim();
  if (
    /^#[0-9a-fA-F]{3,8}$/.test(v) ||
    /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/.test(v) ||
    /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0|1|0?\.\d+)\s*\)$/.test(v)
  ) {
    return v;
  }
  return fallback;
}

export function buildMarketReportHtml(data: MarketReportData, branding: BrandingConfig): string {
  const primaryColor = sanitizeCssColor(branding.primaryColor, "#1d4ed8");
  const accentColor = sanitizeCssColor(branding.accentColor ?? branding.primaryColor, primaryColor);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Market Analytics Report</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 10.5pt;
      color: #1a1a1a;
      background: #fff;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 14mm 18mm;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 12px;
      border-bottom: 3px solid ${primaryColor};
      margin-bottom: 20px;
    }
    .header-company { font-size: 19pt; font-weight: 700; color: ${primaryColor}; }
    .header-meta { text-align: right; font-size: 9pt; color: #666; }
    .header-meta strong { color: #333; }
    .section-title {
      font-size: 12pt;
      font-weight: 700;
      color: ${primaryColor};
      border-left: 4px solid ${accentColor};
      padding-left: 10px;
      margin: 22px 0 10px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    .kpi-card {
      background: #f8f9fa;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    .kpi-label { font-size: 7.5pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-value { font-size: 15pt; font-weight: 700; color: ${primaryColor}; margin-top: 4px; }
    .kpi-sub { font-size: 8pt; color: #9ca3af; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 16px; }
    th {
      background: ${primaryColor};
      color: #fff;
      padding: 6px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    td { padding: 5px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .sub { font-size: 8pt; color: #6b7280; }
    .badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 600;
      color: #fff;
    }
    .filter-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 16px;
    }
    .filter-pill {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 2px 10px;
      font-size: 8pt;
      color: #1d4ed8;
    }
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
      font-size: 7pt;
      color: #9ca3af;
      text-align: center;
    }
    .page-break { page-break-after: always; }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div>
      <div class="header-company">${escHtml(branding.companyName)}</div>
      <div style="font-size: 9pt; color: #666; margin-top: 2px;">Market Analytics Report</div>
    </div>
    <div class="header-meta">
      <strong>${new Date().toLocaleDateString("en-AE", { year: "numeric", month: "long", day: "numeric" })}</strong><br/>
      DLD Transactions Analysis
    </div>
  </div>

  <!-- Active Filters -->
  ${buildFiltersSection(data.filters)}

  <!-- KPI Summary -->
  <div class="section-title">Market Overview</div>
  ${buildKpiSection(data, branding)}

  <!-- Area Breakdown -->
  <div class="section-title">Area Price Comparison — Top ${data.areaBreakdown.length} Areas by Volume</div>
  ${buildAreaTable(data.areaBreakdown)}

  <div class="page-break"></div>

  <!-- Quarterly Trends -->
  <div class="section-title">Quarterly Price Trends</div>
  ${buildQuarterlyTable(data.quarterlyTrends)}

  <!-- Footer -->
  <div class="footer">
    <p>${escHtml(branding.disclaimer ?? "This report is for informational purposes only and does not constitute financial advice.")}</p>
    <p style="margin-top: 4px;">${escHtml(branding.companyName)} | Generated: ${new Date().toISOString()}</p>
  </div>

</div>
</body>
</html>`;
}

function buildFiltersSection(filters: MarketReportFilters): string {
  const pills: string[] = [];
  if (filters.area) pills.push(`Area: ${escHtml(filters.area)}`);
  if (filters.propertyType) pills.push(`Type: ${escHtml(filters.propertyType)}`);
  if (filters.bedrooms !== undefined) pills.push(`Bedrooms: ${filters.bedrooms === 0 ? "Studio" : filters.bedrooms}`);
  if (filters.category) pills.push(`Category: ${escHtml(filters.category)}`);
  if (filters.dateFrom) pills.push(`From: ${filters.dateFrom}`);
  if (filters.dateTo) pills.push(`To: ${filters.dateTo}`);

  if (pills.length === 0) return `<p style="font-size:8.5pt;color:#6b7280;margin-bottom:16px;">Showing all data — no filters applied</p>`;

  return `<div class="filter-pills">${pills.map((p) => `<span class="filter-pill">${p}</span>`).join("")}</div>`;
}

function buildKpiSection(data: MarketReportData, _branding: BrandingConfig): string {
  const { summary } = data;
  const qoqSign = summary.qoqChange !== null && summary.qoqChange > 0 ? "+" : "";
  const qoqColor = summary.qoqChange === null ? "#6b7280" : summary.qoqChange > 2 ? "#ef4444" : summary.qoqChange < -2 ? "#3b82f6" : "#22c55e";

  return `<div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Total Transactions</div>
      <div class="kpi-value">${fmtN(summary.totalTransactions)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Median PSF</div>
      <div class="kpi-value" style="font-size:12pt;">${fmtN(summary.overallMedianPsf)}</div>
      <div class="kpi-sub">${fmtN(summary.overallMedianPsf * SQM_TO_SQFT)} AED/sqm</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Avg Deal Size</div>
      <div class="kpi-value" style="font-size:11pt;">AED ${fmtN(summary.overallAvgDealSize)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Latest QoQ Change</div>
      <div class="kpi-value" style="color:${qoqColor};font-size:14pt;">
        ${summary.qoqChange !== null ? `${qoqSign}${summary.qoqChange}%` : "—"}
      </div>
      <div class="kpi-sub">${summary.periodsCount} periods tracked</div>
    </div>
  </div>`;
}

function buildAreaTable(areas: AreaBreakdownRow[]): string {
  if (areas.length === 0) return `<p style="color:#6b7280;font-size:9pt;">No transaction data available for the selected filters.</p>`;

  const rows = areas.map((r) => {
    const dc = diffColor(r.diffPct);
    const diffStr =
      r.diffPct !== null
        ? `<span class="badge" style="background:${dc};">${r.diffPct > 0 ? "+" : ""}${r.diffPct.toFixed(1)}%</span>`
        : `<span style="color:#9ca3af;">—</span>`;
    return `<tr>
      <td><strong>${escHtml(r.area)}</strong></td>
      <td class="text-right">${fmtN(r.txnCount)}</td>
      <td class="text-right">${fmtPsf(r.txnMedianPsf)}</td>
      <td class="text-right" style="color:#6b7280;font-size:7.5pt;">${fmtN(r.txnMinPsf)} – ${fmtN(r.txnMaxPsf)}</td>
      <td class="text-right">${r.listingCount > 0 ? fmtPsf(r.listingAvgPsf) : '<span style="color:#9ca3af;">—</span>'}</td>
      <td class="text-center">${diffStr}</td>
    </tr>`;
  }).join("");

  return `<table>
    <thead>
      <tr>
        <th>Area</th>
        <th class="text-right">Txn Count</th>
        <th class="text-right">Median PSF (Txn)</th>
        <th class="text-right">Range (AED/sqft)</th>
        <th class="text-right">Avg Ask PSF (Listing)</th>
        <th class="text-center">Listing vs Txn</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildQuarterlyTable(quarters: QuarterlyTrendRow[]): string {
  if (quarters.length === 0) return `<p style="color:#6b7280;font-size:9pt;">No quarterly data available for the selected filters.</p>`;

  const rows = quarters.map((r) => {
    const qc = qoqColor(r.qoqPct);
    const qoqStr =
      r.qoqPct !== null
        ? `<span class="badge" style="background:${qc};">${r.qoqPct > 0 ? "+" : ""}${r.qoqPct.toFixed(1)}%</span>`
        : `<span style="color:#9ca3af;">—</span>`;
    return `<tr>
      <td><strong>${escHtml(r.label)}</strong></td>
      <td class="text-right">${fmtN(r.txnCount)}</td>
      <td class="text-right">${fmtPsf(r.txnMedianPsf)}</td>
      <td class="text-right">${fmtPsf(r.txnAvgPsf)}</td>
      <td class="text-right" style="color:#6b7280;font-size:7.5pt;">${fmtN(r.txnMinPsf)} – ${fmtN(r.txnMaxPsf)}</td>
      <td class="text-center">${qoqStr}</td>
    </tr>`;
  }).join("");

  return `<table>
    <thead>
      <tr>
        <th>Quarter</th>
        <th class="text-right">Transactions</th>
        <th class="text-right">Median PSF</th>
        <th class="text-right">Avg PSF</th>
        <th class="text-right">Range (AED/sqft)</th>
        <th class="text-center">QoQ Change</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}
