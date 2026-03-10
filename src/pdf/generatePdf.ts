import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import crypto from "crypto";
import { execSync } from "child_process";

export interface GeneratedPdf {
  buffer: Buffer;
  checksum: string;
  size: number;
}

/** Resolve Chrome/Chromium executable path across environments */
async function resolveChromePath(): Promise<string | undefined> {
  // 1. Explicit env override (highest priority — set in Hostinger panel)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // 2. @sparticuz/chromium bundled binary (works on restricted Linux hosts)
  try {
    const path = await chromium.executablePath();
    if (path) return path;
  } catch {
    // not available in this environment
  }

  // 3. Common Linux paths (VPS / dedicated server with Chrome installed)
  const linuxPaths = [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
  ];
  for (const p of linuxPaths) {
    try {
      execSync(`test -f ${p}`, { stdio: "ignore" });
      return p;
    } catch {
      // not found, continue
    }
  }

  return undefined;
}

export async function generatePdfFromHtml(html: string): Promise<GeneratedPdf> {
  const executablePath = await resolveChromePath();

  if (!executablePath) {
    throw new Error(
      "No Chrome/Chromium browser found. Set PUPPETEER_EXECUTABLE_PATH env var or install Chrome on the server."
    );
  }

  // @sparticuz/chromium provides hardened args for restricted environments
  const args = [
    ...chromium.args,
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-extensions",
    "--run-all-compositor-stages-before-draw",
  ];

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args,
    timeout: 60_000,
  });

  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    // Give styles time to render before printing
    await new Promise((resolve) => setTimeout(resolve, 500));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
      timeout: 60_000,
    });

    const buffer = Buffer.from(pdfBuffer);
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

    return {
      buffer,
      checksum,
      size: buffer.length,
    };
  } finally {
    await browser.close();
  }
}
