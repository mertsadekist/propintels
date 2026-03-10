import nodemailer from "nodemailer";

interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function createTransport() {
  // Use Resend SMTP if API key is set
  if (process.env.EMAIL_API_KEY) {
    return nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: {
        user: "resend",
        pass: process.env.EMAIL_API_KEY,
      },
    });
  }

  // Fallback: generic SMTP (configure via env)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });
}

export async function sendMail(options: MailOptions): Promise<void> {
  const from = process.env.EMAIL_FROM ?? "noreply@ist-valuation.com";

  if (process.env.NODE_ENV === "development" && !process.env.EMAIL_API_KEY && !process.env.SMTP_HOST) {
    // In dev without email config, just log
    console.log("[Mail] Would send email:", {
      from,
      to: options.to,
      subject: options.subject,
    });
    return;
  }

  const transporter = createTransport();
  await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}
