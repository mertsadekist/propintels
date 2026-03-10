import { NextResponse } from "next/server";
import { prisma } from "@/db/prisma";

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

  const allOk = checks.env.ok && checks.database.ok;
  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", timestamp: new Date().toISOString(), checks },
    { status: allOk ? 200 : 503 }
  );
}
