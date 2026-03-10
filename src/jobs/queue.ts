import { Queue } from "bullmq";
import Redis from "ioredis";

let connection: Redis | null = null;
let queue: Queue | null = null;

/** Lazy Redis — only connects when first job is enqueued, never crashes the web server */
function getRedis(): Redis {
  if (!connection) {
    connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    connection.on("error", (err) => {
      // Log but never crash the web server process
      console.error("[Queue] Redis error:", err.message);
    });
  }
  return connection;
}

/** Lazy Queue — created on first use */
function getQueue(): Queue {
  if (!queue) {
    queue = new Queue("pdf-generation", {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      connection: getRedis() as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return queue;
}

export interface PdfJobPayload {
  leadId: string;
  reportId: string;
}

export async function enqueueReportGeneration(payload: PdfJobPayload): Promise<void> {
  try {
    await getQueue().add("generate-report", payload, {
      jobId: `pdf-${payload.reportId}`,
    });
  } catch (err) {
    // Non-fatal — lead is saved, PDF will just not be auto-queued
    console.error("[Queue] Failed to enqueue PDF job:", err instanceof Error ? err.message : err);
  }
}
