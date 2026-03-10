import puppeteer from "puppeteer";
import crypto from "crypto";

export interface GeneratedPdf {
  buffer: Buffer;
  checksum: string;
  size: number;
}

export async function generatePdfFromHtml(html: string): Promise<GeneratedPdf> {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: executablePath || undefined,
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
