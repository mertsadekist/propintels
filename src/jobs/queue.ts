import { Queue } from "bullmq";
import Redis from "ioredis";

let connection: Redis | null = null;

function getRedis(): Redis {
  if (!connection) {
    connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

export const pdfQueue = new Queue("pdf-generation", {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connection: getRedis() as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export interface PdfJobPayload {
  leadId: string;
  reportId: string;
}

export async function enqueueReportGeneration(payload: PdfJobPayload): Promise<void> {
  await pdfQueue.add("generate-report", payload, {
    jobId: `pdf-${payload.reportId}`,
  });
}
