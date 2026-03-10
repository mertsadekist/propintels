import type { BrandingConfig, ReportData } from "./types";

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
      padding: 0;
      margin: 0;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm 18mm;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 3px solid ${branding.primaryColor};
      margin-bottom: 20px;
    }
    .header-company { font-size: 20pt; font-weight: 700; color: ${branding.primaryColor}; }
    .header-meta { text-align: right; font-size: 9pt; color: #666; }
    .header-meta .report-date { font-weight: 600; color: #333; }
    .section-title {
      font-size: 13pt;
      font-weight: 700;
      color: ${branding.primaryColor};
      border-left: 4px solid ${branding.accentColor ?? branding.primaryColor};
      padding-left: 10px;
      margin: 20px 0 12px;
    }
    .summary-box {
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
    }
    .summary-item { text-align: center; }
    .summary-item .label { font-size: 8pt; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-item .value { font-size: 14pt; font-weight: 700; color: ${branding.primaryColor}; }
    .verdict-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 16px;
      background: #f0f4ff;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .verdict-badge {
      font-size: 16pt;
      font-weight: 800;
      padding: 8px 20px;
      border-radius: 6px;
      color: #fff;
    }
    .verdict-ALIGNED { background: #22c55e; }
    .verdict-BELOW_MARKET { background: #3b82f6; }
    .verdict-SLIGHTLY_ABOVE { background: #f59e0b; }
    .verdict-ABOVE_MARKET { background: #ef4444; }
    .verdict-INSUFFICIENT_DATA { background: #9ca3af; }
    .confidence-label { font-size: 10pt; color: #555; }
    .confidence-score { font-size: 18pt; font-weight: 700; color: ${branding.primaryColor}; }
    .price-range {
      padding: 12px 16px;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .price-range-title { font-size: 9pt; color: #666; margin-bottom: 8px; }
    .price-range-values {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .price-low, .price-high { font-size: 10pt; color: #666; }
    .price-mid { font-size: 16pt; font-weight: 700; color: ${branding.primaryColor}; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 16px; }
    th {
      background: ${branding.primaryColor};
      color: #fff;
      padding: 7px 10px;
      text-align: left;
      font-weight: 600;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; }
    tr:nth-child(even) td { background: #fafafa; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .highlight-row td { background: #e8f0fe !important; font-weight: 600; }
    .explanations { list-style: none; padding: 0; }
    .explanations li {
      padding: 6px 0;
      padding-left: 18px;
      position: relative;
      font-size: 10pt;
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
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #ddd;
      font-size: 7.5pt;
      color: #888;
      text-align: center;
    }
    .page-break { page-break-after: always; }
  </style>
</head>
<body>
<div class="page">
  ${buildHeader(data, branding)}
  ${buildVerdictSection(data, branding)}
  ${buildSubjectPropertySection(data)}
  ${buildAnalysisSection(data)}
  ${buildListingsSection(data)}
  ${buildTransactionsSection(data)}
  ${buildExplanationsSection(data)}
  ${buildFooter(branding)}
</div>
</body>
</html>`;
}

function buildHeader(data: ReportData, branding: BrandingConfig): string {
  return `
  <div class="header">
    <div>
      <div class="header-company">${escHtml(branding.companyName)}</div>
      <div style="font-size: 9pt; color: #666; margin-top: 2px;">Property Valuation Report</div>
    </div>
    <div class="header-meta">
      <div class="report-date">${new Date().toLocaleDateString("en-AE", { year: "numeric", month: "long", day: "numeric" })}</div>
      <div>Report ID: ${data.leadId}</div>
      <div>Project: ${escHtml(data.projectName)}</div>
    </div>
  </div>`;
}

function buildVerdictSection(data: ReportData, _branding: BrandingConfig): string {
  const verdictLabels: Record<string, string> = {
    ALIGNED: "Fair Market Value",
    BELOW_MARKET: "Below Market",
    SLIGHTLY_ABOVE: "Slightly Above Market",
    ABOVE_MARKET: "Above Market",
    INSUFFICIENT_DATA: "Insufficient Data",
  };
  const verdictText = verdictLabels[data.verdict] ?? data.verdict;

  return `
  <div class="verdict-row">
    <div>
      <div class="label" style="font-size: 8pt; color: #666; text-align: center; margin-bottom: 4px;">VALUATION VERDICT</div>
      <div class="verdict-badge verdict-${data.verdict}">${verdictText}</div>
    </div>
    <div style="text-align: center;">
      <div class="confidence-label">Confidence Score</div>
      <div class="confidence-score">${data.confidence}%</div>
    </div>
    ${
      data.ratioToMarket !== null && data.ratioToMarket !== undefined
        ? `<div style="text-align: center;">
             <div class="confidence-label">vs. Market</div>
             <div class="confidence-score">${((data.ratioToMarket * 100) - 100).toFixed(1)}%</div>
           </div>`
        : ""
    }
  </div>
  ${
    data.recommendedMid !== null && data.recommendedMid !== undefined
      ? `<div class="price-range">
           <div class="price-range-title">RECOMMENDED PRICE RANGE</div>
           <div class="price-range-values">
             <div class="price-low">Low: AED ${fmtN(data.recommendedLow ?? 0)}</div>
             <div class="price-mid">AED ${fmtN(data.recommendedMid)}</div>
             <div class="price-high">High: AED ${fmtN(data.recommendedHigh ?? 0)}</div>
           </div>
         </div>`
      : ""
  }`;
}

function buildSubjectPropertySection(data: ReportData): string {
  return `
  <div class="section-title">Subject Property</div>
  <div class="summary-box">
    <div class="summary-grid">
      <div class="summary-item">
        <div class="label">Property Type</div>
        <div class="value" style="font-size: 11pt;">${data.propertyType}</div>
      </div>
      <div class="summary-item">
        <div class="label">Bedrooms</div>
        <div class="value">${data.bedrooms ?? "N/A"}</div>
      </div>
      <div class="summary-item">
        <div class="label">Area (sqft)</div>
        <div class="value">${fmtN(data.areaSqft)}</div>
      </div>
      <div class="summary-item">
        <div class="label">Asking Price</div>
        <div class="value" style="font-size: 11pt;">AED ${fmtN(data.clientPrice)}</div>
      </div>
      <div class="summary-item">
        <div class="label">Client PSF</div>
        <div class="value" style="font-size: 11pt;">AED ${fmtN(data.clientPsf)}</div>
      </div>
      <div class="summary-item">
        <div class="label">Client</div>
        <div class="value" style="font-size: 10pt;">${escHtml(data.clientName)}</div>
      </div>
    </div>
  </div>`;
}

function buildAnalysisSection(data: ReportData): string {
  const rows = [];

  if (data.listings) {
    rows.push(`
      <tr>
        <td>Market Listings</td>
        <td class="text-right">${data.listings.count}</td>
        <td class="text-right">AED ${fmtN(data.listings.medianPsf)}/sqft<br/><span style="font-size:10px;color:#6b7280;">AED ${fmtN(data.listings.medianPsf * SQM_TO_SQFT)}/sqm</span></td>
        <td class="text-right">AED ${fmtN(data.listings.meanPsf)}/sqft<br/><span style="font-size:10px;color:#6b7280;">AED ${fmtN(data.listings.meanPsf * SQM_TO_SQFT)}/sqm</span></td>
        <td class="text-right">AED ${fmtN(data.listings.minPsf)} – ${fmtN(data.listings.maxPsf)}</td>
      </tr>`);
  }

  if (data.transactions) {
    rows.push(`
      <tr class="highlight-row">
        <td>DLD Transactions ★</td>
        <td class="text-right">${data.transactions.count}</td>
        <td class="text-right">AED ${fmtN(data.transactions.medianPsf)}/sqft<br/><span style="font-size:10px;color:#6b7280;">AED ${fmtN(data.transactions.medianPsf * SQM_TO_SQFT)}/sqm</span></td>
        <td class="text-right">AED ${fmtN(data.transactions.meanPsf)}/sqft<br/><span style="font-size:10px;color:#6b7280;">AED ${fmtN(data.transactions.meanPsf * SQM_TO_SQFT)}/sqm</span></td>
        <td class="text-right">AED ${fmtN(data.transactions.minPsf)} – ${fmtN(data.transactions.maxPsf)}</td>
      </tr>`);
  }

  if (rows.length === 0) return "";

  return `
  <div class="section-title">Market Analysis Summary</div>
  <table>
    <thead>
      <tr>
        <th>Data Source</th>
        <th class="text-right">Count</th>
        <th class="text-right">Median (AED/sqft – AED/sqm)</th>
        <th class="text-right">Mean (AED/sqft – AED/sqm)</th>
        <th class="text-right">Range (AED/sqft)</th>
      </tr>
    </thead>
    <tbody>${rows.join("")}</tbody>
  </table>`;
}

const SQM_TO_SQFT = 10.7639;

function fmtArea(sqft: number): string {
  const sqm = sqft / SQM_TO_SQFT;
  return `${fmtN(sqft)} sqft<br/><span style="font-size:10px;color:#6b7280;">${sqm.toLocaleString("en-AE", { maximumFractionDigits: 1 })} sqm</span>`;
}

function fmtPsf(psf: number): string {
  const ppsm = psf * SQM_TO_SQFT;
  return `AED ${fmtN(psf)}/sqft<br/><span style="font-size:10px;color:#6b7280;">AED ${fmtN(ppsm)}/sqm</span>`;
}

function buildListingsSection(data: ReportData): string {
  if (!data.listingComps || data.listingComps.length === 0) return "";

  const rows = data.listingComps
    .map(
      (c) => `
    <tr>
      <td>${escHtml(c.locationLabel ?? "—")}</td>
      <td class="text-center">${c.bedrooms ?? "—"}</td>
      <td class="text-right">${fmtArea(c.areaSqft ?? 0)}</td>
      <td class="text-right">AED ${fmtN(c.askPrice ?? 0)}</td>
      <td class="text-right">${fmtPsf(c.askPsf ?? 0)}</td>
      <td>${escHtml(c.portal ?? "—")}</td>
    </tr>`
    )
    .join("");

  return `
  <div class="section-title">Comparable Listings</div>
  <table>
    <thead>
      <tr>
        <th>Location</th>
        <th class="text-center">BR</th>
        <th class="text-right">Area</th>
        <th class="text-right">Ask Price</th>
        <th class="text-right">Ask Price / Area</th>
        <th>Portal</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildTransactionsSection(data: ReportData): string {
  if (!data.transactionComps || data.transactionComps.length === 0) return "";

  const rows = data.transactionComps
    .map(
      (c) => `
    <tr>
      <td>${c.transactionDate ? new Date(c.transactionDate).toLocaleDateString("en-AE") : "—"}</td>
      <td class="text-center">${c.bedrooms ?? "—"}</td>
      <td class="text-right">${fmtArea(c.transactionAreaSqft ?? 0)}</td>
      <td class="text-right">AED ${fmtN(c.transactionPrice ?? 0)}</td>
      <td class="text-right">${fmtPsf(c.transactionPsf ?? 0)}</td>
    </tr>`
    )
    .join("");

  return `
  <div class="section-title">DLD Transactions</div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th class="text-center">BR</th>
        <th class="text-right">Area</th>
        <th class="text-right">Transaction Price</th>
        <th class="text-right">Price / Area</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildExplanationsSection(data: ReportData): string {
  if (!data.explanations || data.explanations.length === 0) return "";
  const items = data.explanations.map((e) => `<li>${escHtml(e)}</li>`).join("");
  return `
  <div class="section-title">Analysis Notes</div>
  <ul class="explanations">${items}</ul>`;
}

function buildFooter(branding: BrandingConfig): string {
  return `
  <div class="footer">
    <p>${escHtml(branding.disclaimer ?? "")}</p>
    <p style="margin-top: 6px;">${escHtml(branding.companyName)} | Generated: ${new Date().toISOString()}</p>
  </div>`;
}

function fmtN(n: number): string {
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 }).format(n);
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
