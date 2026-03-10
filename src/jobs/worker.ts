import { Worker } from "bullmq";
import Redis from "ioredis";
import { processPdfJob } from "./processors/pdf.processor";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const CONCURRENCY = parseInt(process.env.PDF_QUEUE_CONCURRENCY ?? "2", 10);

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

connection.on("connect", () => console.log("[Worker] Redis connected"));
connection.on("error", (err) => console.error("[Worker] Redis error:", err.message));

const pdfWorker = new Worker("pdf-generation", processPdfJob, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connection: connection as any,
  concurrency: CONCURRENCY,
});

pdfWorker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

pdfWorker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

pdfWorker.on("error", (err) => {
  console.error("[Worker] Worker error:", err);
});

console.log(
  `[Worker] PDF Worker started. Concurrency: ${CONCURRENCY}. Waiting for jobs...`
);

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`[Worker] ${signal} received. Shutting down gracefully...`);
  await pdfWorker.close();
  await connection.quit();
  console.log("[Worker] Shutdown complete.");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
