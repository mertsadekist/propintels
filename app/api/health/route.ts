import { NextResponse } from "next/server";
import { prisma } from "@/db/prisma";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface CheckResult {
  status: "ok" | "fail";
  latencyMs?: number;
  error?: string;
}

interface HealthStatus {
  status: "ok" | "degraded" | "down";
  timestamp: string;
  version: string;
  checks: {
    database: CheckResult;
    redis: CheckResult;
  };
  uptime: number;
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "fail",
      error: err instanceof Error ? err.message : "Unknown DB error",
    };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await redis.ping();
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "fail",
      error: err instanceof Error ? err.message : "Unknown Redis error",
    };
  }
}

export async function GET() {
  const [dbSettled, redisSettled] = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
  ]);

  const dbResult: CheckResult =
    dbSettled.status === "fulfilled"
      ? dbSettled.value
      : { status: "fail", error: "Promise rejected" };

  const redisResult: CheckResult =
    redisSettled.status === "fulfilled"
      ? redisSettled.value
      : { status: "fail", error: "Promise rejected" };

  const allOk = dbResult.status === "ok" && redisResult.status === "ok";
  const anyOk = dbResult.status === "ok" || redisResult.status === "ok";

  const overallStatus = allOk ? "ok" : anyOk ? "degraded" : "down";
  const httpStatus = allOk ? 200 : anyOk ? 207 : 503;

  const body: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION ?? "1.0.0",
    checks: {
      database: dbResult,
      redis: redisResult,
    },
    uptime: process.uptime(),
  };

  return NextResponse.json(body, { status: httpStatus });
}
