import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/prisma";
import { checkRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/v/report/[leadId]
 *
 * Public endpoint — no auth required (accessed via client-facing link).
 * Streams the PDF directly from the database (no S3/R2 needed).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  // Rate limit: 20 downloads per IP per minute to prevent enumeration/abuse
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const rateLimit = await checkRateLimit(`report-dl:${ip}`, 20, 60);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests. Please wait before trying again." } },
      { status: 429 }
    );
  }

  const report = await prisma.report.findFirst({
    where: { leadId: params.leadId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      pdfData: true,
      fileName: true,
      fileSize: true,
    },
  });

  if (!report) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No report found for this lead" } },
      { status: 404 }
    );
  }

  // Report not ready yet
  if (report.status !== "READY") {
    return NextResponse.json({
      data: { status: report.status, downloadUrl: null },
    });
  }

  // PDF stored in DB
  if (report.pdfData) {
    const buffer = Buffer.from(report.pdfData);
    const fileName = report.fileName ?? `valuation-report-${params.leadId}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  // Fallback: no PDF data available
  return NextResponse.json(
    { error: { code: "NO_DATA", message: "PDF data not available" } },
    { status: 404 }
  );
}
