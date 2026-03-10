import { NextResponse } from "next/server";
import { prisma } from "@/db/prisma";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  checks.env = {
    ok: !!(process.env.DATABASE_URL && process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_URL),
    detail: [
      process.env.DATABASE_URL ? "✅ DATABASE_URL" : "❌ DATABASE_URL missing",
      process.env.NEXTAUTH_SECRET ? "✅ NEXTAUTH_SECRET" : "❌ NEXTAUTH_SECRET missing",
      process.env.NEXTAUTH_URL ? "✅ NEXTAUTH_URL" : "❌ NEXTAUTH_URL missing",
      process.env.REDIS_URL ? "✅ REDIS_URL" : "⚠️ REDIS_URL missing",
    ].join(" | "),
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true, detail: "Connected ✅" };
  } catch (e) {
    checks.database = { ok: false, detail: `Failed ❌: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (process.env.REDIS_URL) {
    try {
      const Redis = (await import("ioredis")).default;
      const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000, lazyConnect: true });
      await redis.connect();
      await redis.ping();
      await redis.quit();
      checks.redis = { ok: true, detail: "Connected ✅" };
    } catch (e) {
      checks.redis = { ok: false, detail: `Failed ❌: ${e instanceof Error ? e.message : String(e)}` };
    }
  } else {
    checks.redis = { ok: false, detail: "⚠️ REDIS_URL not set" };
  }

  // ── Chrome / Puppeteer detection ──────────────────────────────────────────
  try {
    const chromium = (await import("@sparticuz/chromium")).default;
    let sparticuzPath = "(error)";
    let sparticuzErr = "";
    try {
      sparticuzPath = await chromium.executablePath();
    } catch (e) {
      sparticuzErr = e instanceof Error ? e.message : String(e);
    }

    // Check which system binaries exist
    const systemPaths = [
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "/snap/bin/chromium",
    ];
    const found: string[] = [];
    for (const p of systemPaths) {
      try { execSync(`test -f ${p}`, { stdio: "ignore" }); found.push(p); } catch { /* not found */ }
    }

    // Try to get Chrome version if PUPPETEER_EXECUTABLE_PATH is set
    let chromeVersion = "";
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      try {
        chromeVersion = execSync(`${process.env.PUPPETEER_EXECUTABLE_PATH} --version`, { timeout: 5000 }).toString().trim();
      } catch (e) {
        chromeVersion = `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    checks.chrome = {
      ok: !!(sparticuzPath && sparticuzPath !== "(error)") || found.length > 0 || !!process.env.PUPPETEER_EXECUTABLE_PATH,
      detail: JSON.stringify({
        sparticuzPath,
        sparticuzErr: sparticuzErr || undefined,
        systemChrome: found.length > 0 ? found : "none",
        PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || "not set",
        chromeVersion: chromeVersion || undefined,
      }),
    };
  } catch (e) {
    checks.chrome = { ok: false, detail: `@sparticuz/chromium import failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  const allOk = checks.env.ok && checks.database.ok;
  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", timestamp: new Date().toISOString(), checks },
    { status: allOk ? 200 : 503 }
  );
}
