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

  const safeName = lead.fullName.replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, "").replace(/\s+/g, "-");
  const dateStr = new Date().toISOString().slice(0, 10);

  try {
    // Dynamically import to avoid build-time issues with native modules
    const { renderReportHtml } = await import("@/pdf/renderHtml");
    const html = await renderReportHtml(lead.id);

    // Try PDF generation — fall back to HTML if Chrome is unavailable
    let pdfBuffer: Buffer | null = null;
    try {
      const { generatePdfFromHtml } = await import("@/pdf/generatePdf");
      const { buffer, checksum, size } = await generatePdfFromHtml(html);
      pdfBuffer = buffer;

      // Save PDF to DB + mark READY
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
    } catch (pdfErr) {
      console.warn("[report/POST] Chrome unavailable, falling back to HTML:", pdfErr);
      // Mark report as failed in DB but still return HTML to the user
      await prisma.report.update({
        where: { id: report.id },
        data: {
          status: "FAILED",
          errorMessage: pdfErr instanceof Error ? pdfErr.message : "Chrome unavailable",
        },
      });
    }

    if (pdfBuffer) {
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="valuation-report-${safeName}-${dateStr}.pdf"`,
          "Content-Length": String(pdfBuffer.length),
        },
      });
    }

    // HTML fallback — user can open in browser and print to PDF
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="valuation-report-${safeName}-${dateStr}.html"`,
      },
    });
  } catch (err) {
    console.error("[report/POST] Report generation failed:", err);

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
          message: err instanceof Error ? err.message : "Report generation failed",
        },
      },
      { status: 500 }
    );
  }
}
