import puppeteer from "puppeteer";
import crypto from "crypto";
import { execSync } from "child_process";

export interface GeneratedPdf {
  buffer: Buffer;
  checksum: string;
  size: number;
}

/** Resolve Chrome/Chromium executable path across environments */
function resolveChromePath(): string | undefined {
  // 1. Explicit env override (highest priority)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  // 2. Common Linux paths (Render.com, Railway, VPS)
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
  // 3. Let Puppeteer use its bundled browser
  return undefined;
}

export async function generatePdfFromHtml(html: string): Promise<GeneratedPdf> {
  const executablePath = resolveChromePath();

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-extensions",
      "--run-all-compositor-stages-before-draw",
    ],
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
