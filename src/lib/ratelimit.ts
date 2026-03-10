interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Redis-based fixed-window rate limiter.
 * Falls back to in-memory if Redis is unavailable.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number = 5,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  try {
    // Dynamic import to avoid issues during build/SSG
    const { redis } = await import("@/lib/redis");

    const redisKey = `rl:${key}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const resetAt = new Date(Math.ceil(now / windowMs) * windowMs);

    // Increment the counter using pipeline
    const pipeline = redis.pipeline();
    pipeline.incr(redisKey);
    pipeline.pttl(redisKey);
    const results = await pipeline.exec();

    const count = (results?.[0]?.[1] as number) ?? 1;
    const ttlMs = (results?.[1]?.[1] as number) ?? -1;

    // Set expiry on first request in window
    if (ttlMs < 0) {
      await redis.pexpire(redisKey, windowMs);
    }

    const remaining = Math.max(0, maxRequests - count);
    const success = count <= maxRequests;

    return { success, remaining, resetAt };
  } catch {
    // Fallback to in-memory if Redis is unavailable
    return checkRateLimitInMemory(key, maxRequests, windowSeconds * 1000);
  }
}

// ── In-memory fallback ──────────────────────────────────────────────────────
const memStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimitInMemory(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const record = memStore.get(key);

  if (!record || record.resetAt < now) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      success: true,
      remaining: maxRequests - 1,
      resetAt: new Date(now + windowMs),
    };
  }

  if (record.count >= maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt: new Date(record.resetAt),
    };
  }

  record.count++;
  return {
    success: true,
    remaining: maxRequests - record.count,
    resetAt: new Date(record.resetAt),
  };
}

// Synchronous in-memory variant (for middleware or sync contexts)
export function checkRateLimitSync(
  key: string,
  maxRequests: number = 5,
  windowMs: number = 60_000
): RateLimitResult {
  return checkRateLimitInMemory(key, maxRequests, windowMs);
}
