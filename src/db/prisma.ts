import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Singleton pattern applied in ALL environments (including production).
// On traditional shared Node.js hosting, each new PrismaClient spawns a native
// Query Engine process. Without this guard, multiple engines compete for the
// same resources → "PANIC: timer has gone away".
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
