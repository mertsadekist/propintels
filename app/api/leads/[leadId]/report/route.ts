import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";

export const dynamic = "force-dynamic";

// ─── GET — fetch latest report status ───────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const { error } = await withAuth(["ADMIN", "MANAGER", "AGENT"]);
  if (error) return error;

  const report = await prisma.report.findFirst({
    where: { leadId: params.leadId },
    orderBy: { createdAt: "desc" },
  });

  if (!report) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No report found for this lead" } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: {
      reportId: report.id,
      status: report.status,
      downloadUrl: null,
      generatedAt: report.generatedAt,
    },
  });
}

// ─── POST — generate PDF directly (no queue, no S3 required) ─────────────────
export async function POST(
  _request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const { error } = await withAuth(["ADMIN", "MANAGER", "AGENT"]);
  if (error) return error;

  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    select: { id: true, fullName: true },
  });

  if (!lead) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Lead not found" } },
      { status: 404 }
    );
  }

  // Create or reset the report record
  const existingReport = await prisma.report.findFirst({
    where: { leadId: lead.id },
    orderBy: { createdAt: "desc" },
  });

  const report = existingReport
    ? await prisma.report.update({
        where: { id: existingReport.id },
        data: { status: "PROCESSING", errorMessage: null, generatedAt: null },
      })
    : await prisma.report.create({
        data: {
          leadId: lead.id,
          status: "PROCESSING",
          fileName: `valuation-report-${lead.id}.pdf`,
        },
      });

  try {
    // Dynamically import to avoid build-time issues with native modules
    const { renderReportHtml } = await import("@/pdf/renderHtml");
    const { generatePdfFromHtml } = await import("@/pdf/generatePdf");

    const html = await renderReportHtml(lead.id);
    const { buffer, checksum, size } = await generatePdfFromHtml(html);

    // Save PDF to DB + mark READY (no S3 needed)
    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: "READY",
        pdfData: new Uint8Array(buffer),
        fileSize: size,
        checksumSha256: checksum,
        generatedAt: new Date(),
      },
    });

    const safeName = lead.fullName.replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, "").replace(/\s+/g, "-");
    const fileName = `valuation-report-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    console.error("[report/POST] PDF generation failed:", err);

    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      },
    });

    return NextResponse.json(
      {
        error: {
          code: "GENERATION_FAILED",
          message: err instanceof Error ? err.message : "PDF generation failed",
        },
      },
      { status: 500 }
    );
  }
}
