interface ReportReadyData {
  clientName: string;
  projectName: string;
  propertyType: string;
  downloadUrl: string;
  verdict: string;
}

const VERDICT_LABELS: Record<string, string> = {
  ALIGNED: "Fair Market Value",
  BELOW_MARKET: "Below Market",
  SLIGHTLY_ABOVE: "Slightly Above Market",
  ABOVE_MARKET: "Above Market",
  INSUFFICIENT_DATA: "Insufficient Data",
};

export function reportReadyEmail(data: ReportReadyData): {
  subject: string;
  html: string;
  text: string;
} {
  const verdictLabel = VERDICT_LABELS[data.verdict] ?? data.verdict;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Valuation Report Is Ready</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#0B1F3B;padding:28px 40px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">
                IST Valuation Platform
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">
                Your Valuation Report Is Ready
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                The property valuation report for <strong>${escapeHtml(data.projectName)}</strong>
                (${escapeHtml(data.propertyType)}) has been completed.
              </p>
              <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
                <tr>
                  <td style="padding:16px 20px;font-size:13px;color:#374151;">
                    <strong>Client:</strong> ${escapeHtml(data.clientName)}<br/>
                    <strong>Project:</strong> ${escapeHtml(data.projectName)}<br/>
                    <strong>Verdict:</strong> ${escapeHtml(verdictLabel)}
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:6px;background:#0B1F3B;">
                    <a href="${data.downloadUrl}"
                       target="_blank"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;">
                      Download Report (PDF)
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#6b7280;">
                This download link will expire in 24 hours.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                © ${new Date().getFullYear()} IST Valuation Platform. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `
Your Valuation Report Is Ready — IST Valuation Platform

Client: ${data.clientName}
Project: ${data.projectName}
Verdict: ${verdictLabel}

Download your report here: ${data.downloadUrl}

This link expires in 24 hours.
`.trim();

  return {
    subject: `Valuation Report Ready — ${data.projectName}`,
    html,
    text,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
