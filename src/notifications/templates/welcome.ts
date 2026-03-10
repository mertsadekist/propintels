interface WelcomeData {
  userName: string;
  userEmail: string;
  temporaryPassword: string;
  loginUrl: string;
}

export function welcomeEmail(data: WelcomeData): {
  subject: string;
  html: string;
  text: string;
} {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to IST Valuation Platform</title>
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
                Welcome to the Platform
              </h1>
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
                Hello ${escapeHtml(data.userName)},
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                An account has been created for you on the IST Valuation Platform.
                Use the credentials below to sign in and change your password.
              </p>
              <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
                <tr>
                  <td style="padding:16px 20px;font-size:14px;color:#374151;">
                    <strong>Email:</strong> ${escapeHtml(data.userEmail)}<br/>
                    <strong>Temporary Password:</strong>
                    <code style="background:#e5e7eb;padding:2px 6px;border-radius:3px;font-size:13px;">${escapeHtml(data.temporaryPassword)}</code>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:6px;background:#0B1F3B;">
                    <a href="${data.loginUrl}"
                       target="_blank"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;">
                      Sign In Now
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
                Please change your password after your first login.
                If you have any questions, contact your administrator.
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
Welcome to IST Valuation Platform

Hello ${data.userName},

An account has been created for you.

Email: ${data.userEmail}
Temporary Password: ${data.temporaryPassword}

Sign in here: ${data.loginUrl}

Please change your password after your first login.
`.trim();

  return {
    subject: "Welcome to IST Valuation Platform — Your Account Details",
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
