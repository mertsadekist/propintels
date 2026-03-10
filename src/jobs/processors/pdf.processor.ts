import { Job } from "bullmq";
import { prisma } from "@/db/prisma";
import { renderReportHtml } from "@/pdf/renderHtml";
import { generatePdfFromHtml } from "@/pdf/generatePdf";
import { uploadPdf, buildStorageKey, getSignedDownloadUrl } from "@/pdf/storage";
import { sendMail } from "@/notifications/mail";
import { reportReadyEmail } from "@/notifications/templates/report-ready";
import type { PdfJobPayload } from "../queue";

const REPORT_DOWNLOAD_EXPIRY_SECONDS = 60 * 60 * 24; // 24 hours

export async function processPdfJob(job: Job<PdfJobPayload>): Promise<void> {
  const { leadId, reportId } = job.data;
  console.log(`[PDF Worker] Processing report ${reportId} for lead ${leadId}`);

  // Mark report as PROCESSING
  await prisma.report.update({
    where: { id: reportId },
    data: { status: "PROCESSING" },
  });

  try {
    // 1. Render HTML
    await job.updateProgress(10);
    const html = await renderReportHtml(leadId);

    // 2. Generate PDF via Puppeteer
    await job.updateProgress(40);
    const { buffer, checksum, size } = await generatePdfFromHtml(html);

    // 3. Upload to S3/R2
    await job.updateProgress(70);
    const storageKey = buildStorageKey(leadId, reportId);
    await uploadPdf(storageKey, buffer, checksum);

    // 4. Mark report as READY
    await job.updateProgress(90);
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "READY",
        storageKey,
        fileSize: size,
        checksumSha256: checksum,
        generatedAt: new Date(),
      },
    });

    // 5. Notify client by email if they provided one (non-blocking)
    notifyClientReportReady(leadId, storageKey).catch((err) => {
      console.error(`[PDF Worker] Failed to send report-ready email for lead ${leadId}:`, err);
    });

    await job.updateProgress(100);
    console.log(`[PDF Worker] Report ${reportId} generated successfully`);
  } catch (error) {
    console.error(`[PDF Worker] Failed to generate report ${reportId}:`, error);

    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "FAILED",
        errorMessage:
          error instanceof Error ? error.message : "Unknown error",
      },
    });

    throw error; // Let BullMQ handle retries
  }
}

async function notifyClientReportReady(leadId: string, storageKey: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      project: { select: { name: true } },
      valuationResult: { select: { verdict: true } },
    },
  });

  if (!lead?.email) return; // Client did not provide an email — skip

  const downloadUrl = await getSignedDownloadUrl(storageKey, REPORT_DOWNLOAD_EXPIRY_SECONDS);

  const { subject, html, text } = reportReadyEmail({
    clientName: lead.fullName,
    projectName: lead.project?.name ?? "Your Property",
    propertyType: lead.propertyType,
    downloadUrl,
    verdict: lead.valuationResult?.verdict ?? "INSUFFICIENT_DATA",
  });

  await sendMail({ to: lead.email, subject, html, text });
  console.log(`[PDF Worker] Report-ready email sent to ${lead.email}`);
}
