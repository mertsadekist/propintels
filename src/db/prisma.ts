import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Always reuse the singleton across all environments.
// On shared/traditional Node.js hosting (non-serverless), creating multiple
// PrismaClient instances causes the Query Engine to panic ("timer has gone away")
// because each instance spawns its own engine process competing for resources.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    datasources: {
      db: {
        // Limit connection pool to 3 — safe for shared hosting environments.
        // Override with DATABASE_URL_POOL_LIMIT env var if needed.
        url: process.env.DATABASE_URL
          ? appendPoolParams(process.env.DATABASE_URL)
          : undefined,
      },
    },
  });

// Always cache the instance — prevents engine panics on traditional Node.js hosts
// where the module cache persists across requests (unlike serverless cold starts).
globalForPrisma.prisma = prisma;

/**
 * Appends ?connection_limit=3&pool_timeout=10 to a DATABASE_URL only if those
 * params are not already present. Safe to call with any MySQL / PostgreSQL URL.
 */
function appendPoolParams(url: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connection_limit")) {
      u.searchParams.set("connection_limit", "3");
    }
    if (!u.searchParams.has("pool_timeout")) {
      u.searchParams.set("pool_timeout", "10");
    }
    return u.toString();
  } catch {
    // If URL parsing fails, return as-is
    return url;
  }
}
