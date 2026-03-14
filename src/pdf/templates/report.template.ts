import type { BrandingConfig, ReportData } from "./types";

const SQM_TO_SQFT = 10.7639;

const VERDICT_LABELS: Record<string, string> = {
  ALIGNED: "Fair Market Value",
  BELOW_MARKET: "Below Market",
  SLIGHTLY_ABOVE: "Slightly Above",
  ABOVE_MARKET: "Above Market",
  INSUFFICIENT_DATA: "Insufficient Data",
};

const VERDICT_COLORS: Record<string, string> = {
  ALIGNED: "#22c55e",
  BELOW_MARKET: "#3b82f6",
  SLIGHTLY_ABOVE: "#f59e0b",
  ABOVE_MARKET: "#ef4444",
  INSUFFICIENT_DATA: "#9ca3af",
};

export function buildReportHtml(data: ReportData, branding: BrandingConfig): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Property Valuation Report</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      color: #1a1a1a;
      background: #fff;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 14mm 17mm;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 10px;
      border-bottom: 3px solid ${branding.primaryColor};
      margin-bottom: 16px;
    }
    .header-company { font-size: 18pt; font-weight: 700; color: ${branding.primaryColor}; }
    .header-meta { text-align: right; font-size: 8.5pt; color: #666; }
    .header-meta .report-date { font-weight: 600; color: #333; }
    .section-title {
      font-size: 12pt;
      font-weight: 700;
      color: ${branding.primaryColor};
      border-left: 4px solid ${branding.accentColor ?? branding.primaryColor};
      padding-left: 10px;
      margin: 18px 0 10px;
    }
    /* Subject property row */
    .subject-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 16px;
    }
    .subject-item { text-align: center; }
    .subject-item .lbl { font-size: 7.5pt; color: #888; text-transform: uppercase; letter-spacing: 0.4px; }
    .subject-item .val { font-size: 11pt; font-weight: 700; color: #1a1a1a; margin-top: 2px; }
    /* Triple valuation cards */
    .triple-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }
    .val-card {
      border: 1.5px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
    }
    .val-card-header {
      padding: 8px 12px;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #fff;
    }
    .val-card-body { padding: 12px; }
    .val-card-verdict {
      font-size: 10pt;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .val-card-price {
      font-size: 14pt;
      font-weight: 800;
      color: ${branding.primaryColor};
      margin-bottom: 4px;
    }
    .val-card-psf { font-size: 8pt; color: #666; margin-bottom: 8px; }
    .val-card-range {
      font-size: 7.5pt;
      color: #888;
      background: #f8f9fa;
      padding: 5px 8px;
      border-radius: 4px;
      margin-bottom: 6px;
    }
    .val-card-conf { font-size: 8pt; color: #666; }
    .val-card-conf span { font-weight: 700; }
    .val-card-notes {
      font-size: 8pt;
      color: #444;
      line-height: 1.5;
      border-top: 1px solid #f0f0f0;
      padding-top: 8px;
      margin-top: 8px;
      white-space: pre-wrap;
    }
    .val-card-meta { font-size: 7.5pt; color: #888; margin-top: 4px; }
    .insuf { font-size: 9pt; color: #9ca3af; font-style: italic; text-align: center; padding: 20px 0; }
    /* Analysis table */
    table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 14px; }
    th {
      background: ${branding.primaryColor};
      color: #fff;
      padding: 6px 9px;
      text-align: left;
      font-weight: 600;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    td { padding: 5px 9px; border-bottom: 1px solid #f0f0f0; }
    tr:nth-child(even) td { background: #fafafa; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .highlight-row td { background: #e8f0fe !important; font-weight: 600; }
    .explanations { list-style: none; padding: 0; }
    .explanations li {
      padding: 5px 0 5px 16px;
      position: relative;
      font-size: 9.5pt;
      color: #444;
      border-bottom: 1px solid #f0f0f0;
    }
    .explanations li::before {
      content: "▸";
      position: absolute;
      left: 0;
      color: ${branding.primaryColor};
    }
    .footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
      font-size: 7pt;
      color: #aaa;
      text-align: center;
    }
    .page-break { page-break-after: always; }
    .section-sub {
      font-size: 10.5pt;
      font-weight: 600;
      color: #444;
      margin: 14px 0 8px;
      padding-left: 6px;
      border-left: 3px solid ${branding.accentColor ?? branding.primaryColor}44;
    }
  </style>
</head>
<body>
<div class="page">
  ${buildHeader(data, branding)}
  ${buildSubjectProperty(data)}
  ${buildTripleValuationSummary(data, branding)}
  ${buildAreaAnalysisSection(data)}
  ${buildListingsSection(data, "Area Comparable Listings", data.listingComps)}
  ${buildTransactionsSection(data, "Area DLD Transactions", data.transactionComps)}
  ${buildProjectCompsSection(data)}
  ${buildExplanationsSection(data)}
  ${buildFooter(branding)}
</div>
</body>
</html>`;
}

// ── Header ───────────────────────────────────────────────────────────────────

function buildHeader(data: ReportData, branding: BrandingConfig): string {
  return `
  <div class="header">
    <div>
      <div class="header-company">${escHtml(branding.companyName)}</div>
      <div style="font-size: 8.5pt; color: #666; margin-top: 2px;">Property Valuation Report</div>
    </div>
    <div class="header-meta">
      <div class="report-date">${new Date().toLocaleDateString("en-AE", { year: "numeric", month: "long", day: "numeric" })}</div>
      <div>Ref: ${data.leadId}</div>
      <div>Project: ${escHtml(data.projectName)}</div>
    </div>
  </div>`;
}

// ── Subject Property ─────────────────────────────────────────────────────────

function buildSubjectProperty(data: ReportData): string {
  return `
  <div class="section-title">Subject Property</div>
  <div class="subject-grid">
    <div class="subject-item">
      <div class="lbl">Client</div>
      <div class="val" style="font-size:9.5pt;">${escHtml(data.clientName)}</div>
    </div>
    <div class="subject-item">
      <div class="lbl">Type</div>
      <div class="val" style="font-size:9.5pt;">${data.propertyType}</div>
    </div>
    <div class="subject-item">
      <div class="lbl">Bedrooms</div>
      <div class="val">${data.bedrooms ?? "—"}</div>
    </div>
    <div class="subject-item">
      <div class="lbl">Area (sqft)</div>
      <div class="val">${fmtN(data.areaSqft)}</div>
    </div>
    <div class="subject-item">
      <div class="lbl">Asking Price</div>
      <div class="val" style="font-size:9.5pt;">AED ${fmtN(data.clientPrice)}</div>
    </div>
    <div class="subject-item">
      <div class="lbl">Ask PSF</div>
      <div class="val">AED ${fmtN(data.clientPsf)}</div>
    </div>
  </div>`;
}

// ── Triple Valuation Summary ─────────────────────────────────────────────────

function buildTripleValuationSummary(data: ReportData, branding: BrandingConfig): string {
  const areaCard = buildAreaCard(data, branding);
  const projectCard = buildProjectCard(data, branding);
  const specialistCard = buildSpecialistCard(data, branding);

  return `
  <div class="section-title">Valuation Summary</div>
  <div class="triple-grid">
    ${areaCard}
    ${projectCard}
    ${specialistCard}
  </div>`;
}

function buildAreaCard(data: ReportData, _branding: BrandingConfig): string {
  const color = VERDICT_COLORS[data.verdict] ?? VERDICT_COLORS.INSUFFICIENT_DATA;
  const label = VERDICT_LABELS[data.verdict] ?? data.verdict;
  const ratio = data.ratioToMarket !== null && data.ratioToMarket !== undefined
    ? `${((data.ratioToMarket * 100) - 100).toFixed(1)}% vs. area market`
    : "";

  return `
  <div class="val-card">
    <div class="val-card-header" style="background: ${color}20; color: ${color}; border-bottom: 2px solid ${color};">
      🏘 Area Valuation
    </div>
    <div class="val-card-body">
      <div class="val-card-verdict" style="color:${color}">${label}</div>
      ${data.recommendedMid
        ? `<div class="val-card-price">AED ${fmtN(data.recommendedMid)}</div>
           <div class="val-card-psf">AED ${fmtN(data.recommendedMid / data.areaSqft)}/sqft</div>
           <div class="val-card-range">
             Low: AED ${fmtN(data.recommendedLow ?? 0)} &nbsp;|&nbsp; High: AED ${fmtN(data.recommendedHigh ?? 0)}
           </div>`
        : `<div class="insuf">Insufficient data</div>`}
      <div class="val-card-conf">Confidence: <span>${data.confidence}%</span> &nbsp;|&nbsp; ${ratio}</div>
      <div class="val-card-psf" style="margin-top:6px;">
        ${(data.listingComps?.length ?? 0) + (data.transactionComps?.length ?? 0)} area comparables
      </div>
    </div>
  </div>`;
}

function buildProjectCard(data: ReportData, _branding: BrandingConfig): string {
  const pv = data.projectValuation;

  if (!pv || pv.verdict === "INSUFFICIENT_DATA") {
    return `
    <div class="val-card">
      <div class="val-card-header" style="background:#f3f4f6; color:#9ca3af; border-bottom:2px solid #e5e7eb;">
        🏢 Project Valuation
      </div>
      <div class="val-card-body">
        <div class="insuf">Not enough project-specific comparables</div>
      </div>
    </div>`;
  }

  const color = VERDICT_COLORS[pv.verdict] ?? VERDICT_COLORS.INSUFFICIENT_DATA;
  const label = VERDICT_LABELS[pv.verdict] ?? pv.verdict;
  const ratio = pv.ratioToMarket !== null && pv.ratioToMarket !== undefined
    ? `${((pv.ratioToMarket * 100) - 100).toFixed(1)}% vs. project`
    : "";

  return `
  <div class="val-card">
    <div class="val-card-header" style="background:${color}20; color:${color}; border-bottom:2px solid ${color};">
      🏢 Project Valuation
    </div>
    <div class="val-card-body">
      <div class="val-card-verdict" style="color:${color}">${label}</div>
      ${pv.recommendedMid
        ? `<div class="val-card-price">AED ${fmtN(pv.recommendedMid)}</div>
           <div class="val-card-psf">AED ${fmtN(pv.recommendedMid / data.areaSqft)}/sqft</div>
           <div class="val-card-range">
             Low: AED ${fmtN(pv.recommendedLow ?? 0)} &nbsp;|&nbsp; High: AED ${fmtN(pv.recommendedHigh ?? 0)}
           </div>`
        : `<div class="insuf">No price range available</div>`}
      <div class="val-card-conf">Confidence: <span>${pv.confidence}%</span> &nbsp;|&nbsp; ${ratio}</div>
      <div class="val-card-psf" style="margin-top:6px;">
        ${(pv.listingCount ?? 0) + (pv.transactionCount ?? 0)} project comparables
      </div>
    </div>
  </div>`;
}

function buildSpecialistCard(data: ReportData, _branding: BrandingConfig): string {
  const sa = data.specialistAssessment;

  if (!sa) {
    return `
    <div class="val-card">
      <div class="val-card-header" style="background:#fffbeb; color:#d97706; border-bottom:2px solid #fde68a;">
        👤 Specialist Assessment
      </div>
      <div class="val-card-body">
        <div class="insuf">Pending specialist review</div>
      </div>
    </div>`;
  }

  const assessDate = new Date(sa.assessedAt).toLocaleDateString("en-AE");
  const notesPreview = sa.notes.length > 280 ? sa.notes.slice(0, 280) + "…" : sa.notes;

  return `
  <div class="val-card">
    <div class="val-card-header" style="background:#fffbeb; color:#d97706; border-bottom:2px solid #f59e0b;">
      👤 Specialist Assessment
    </div>
    <div class="val-card-body">
      <div class="val-card-price">AED ${fmtN(sa.estimatedPrice)}</div>
      <div class="val-card-psf">AED ${fmtN(sa.estimatedPsf)}/sqft</div>
      <div class="val-card-notes">${escHtml(notesPreview)}</div>
      <div class="val-card-meta">By ${escHtml(sa.specialistName)} · ${assessDate}</div>
    </div>
  </div>`;
}

// ── Area Market Analysis ──────────────────────────────────────────────────────

function buildAreaAnalysisSection(data: ReportData): string {
  const rows: string[] = [];

  if (data.listings) {
    rows.push(`
      <tr>
        <td>Area Listings</td>
        <td class="text-right">${data.listings.count}</td>
        <td class="text-right">${fmtPsfCell(data.listings.medianPsf)}</td>
        <td class="text-right">${fmtPsfCell(data.listings.meanPsf)}</td>
        <td class="text-right">AED ${fmtN(data.listings.minPsf)} – ${fmtN(data.listings.maxPsf)}</td>
      </tr>`);
  }

  if (data.transactions) {
    rows.push(`
      <tr class="highlight-row">
        <td>Area DLD Transactions ★</td>
        <td class="text-right">${data.transactions.count}</td>
        <td class="text-right">${fmtPsfCell(data.transactions.medianPsf)}</td>
        <td class="text-right">${fmtPsfCell(data.transactions.meanPsf)}</td>
        <td class="text-right">AED ${fmtN(data.transactions.minPsf)} – ${fmtN(data.transactions.maxPsf)}</td>
      </tr>`);
  }

  if (rows.length === 0) return "";

  return `
  <div class="section-title">Area Market Analysis</div>
  <table>
    <thead>
      <tr>
        <th>Data Source</th>
        <th class="text-right">Count</th>
        <th class="text-right">Median PSF</th>
        <th class="text-right">Mean PSF</th>
        <th class="text-right">Range (AED/sqft)</th>
      </tr>
    </thead>
    <tbody>${rows.join("")}</tbody>
  </table>`;
}

// ── Comparable Tables ────────────────────────────────────────────────────────

function buildListingsSection(
  data: ReportData,
  title: string,
  comps: typeof data.listingComps
): string {
  if (!comps || comps.length === 0) return "";

  const rows = comps
    .map(
      (c) => `
    <tr>
      <td>${escHtml(c.locationLabel ?? "—")}</td>
      <td class="text-center">${c.bedrooms ?? "—"}</td>
      <td class="text-right">${fmtAreaCell(c.areaSqft ?? 0)}</td>
      <td class="text-right">AED ${fmtN(c.askPrice ?? 0)}</td>
      <td class="text-right">${fmtPsfCell(c.askPsf ?? 0)}</td>
      <td>${escHtml(c.portal ?? "—")}</td>
    </tr>`
    )
    .join("");

  return `
  <div class="section-title">${title}</div>
  <table>
    <thead>
      <tr>
        <th>Location / Unit</th>
        <th class="text-center">BR</th>
        <th class="text-right">Area</th>
        <th class="text-right">Ask Price</th>
        <th class="text-right">PSF</th>
        <th>Portal</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildTransactionsSection(
  data: ReportData,
  title: string,
  comps: typeof data.transactionComps
): string {
  if (!comps || comps.length === 0) return "";

  const rows = comps
    .map(
      (c) => `
    <tr>
      <td>${c.transactionDate ? new Date(c.transactionDate).toLocaleDateString("en-AE") : "—"}</td>
      <td class="text-center">${c.bedrooms ?? "—"}</td>
      <td class="text-right">${fmtAreaCell(c.transactionAreaSqft ?? 0)}</td>
      <td class="text-right">AED ${fmtN(c.transactionPrice ?? 0)}</td>
      <td class="text-right">${fmtPsfCell(c.transactionPsf ?? 0)}</td>
    </tr>`
    )
    .join("");

  return `
  <div class="section-title">${title}</div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th class="text-center">BR</th>
        <th class="text-right">Area</th>
        <th class="text-right">Transaction Price</th>
        <th class="text-right">PSF</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildProjectCompsSection(data: ReportData): string {
  if (!data.projectValuation) return "";
  const pv = data.projectValuation;
  if (pv.listingComps.length === 0 && pv.transactionComps.length === 0) return "";

  return `
  <div class="section-title">Project-Level Comparables</div>
  ${buildListingsSection(data, "Project Listings", pv.listingComps)}
  ${buildTransactionsSection(data, "Project DLD Transactions", pv.transactionComps)}`;
}

// ── Explanations ──────────────────────────────────────────────────────────────

function buildExplanationsSection(data: ReportData): string {
  if (!data.explanations || data.explanations.length === 0) return "";
  const items = data.explanations.map((e) => `<li>${escHtml(e)}</li>`).join("");
  return `
  <div class="section-title">Analysis Notes</div>
  <ul class="explanations">${items}</ul>`;
}

// ── Footer ────────────────────────────────────────────────────────────────────

function buildFooter(branding: BrandingConfig): string {
  return `
  <div class="footer">
    <p>${escHtml(branding.disclaimer ?? "")}</p>
    <p style="margin-top:4px;">${escHtml(branding.companyName)} &nbsp;|&nbsp; Generated: ${new Date().toISOString()}</p>
  </div>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtN(n: number): string {
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 }).format(n);
}

function fmtAreaCell(sqft: number): string {
  const sqm = sqft / SQM_TO_SQFT;
  return `${fmtN(sqft)} sqft<br/><span style="font-size:7.5pt;color:#9ca3af;">${sqm.toLocaleString("en-AE", { maximumFractionDigits: 1 })} sqm</span>`;
}

function fmtPsfCell(psf: number): string {
  const ppsm = psf * SQM_TO_SQFT;
  return `AED ${fmtN(psf)}/sqft<br/><span style="font-size:7.5pt;color:#9ca3af;">AED ${fmtN(ppsm)}/sqm</span>`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
