import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/prisma";
import { getSignedDownloadUrl } from "@/pdf/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: { leadId: string } }
) {
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

  if (report.status !== "READY" || !report.storageKey) {
    return NextResponse.json({
      data: { status: report.status, downloadUrl: null },
    });
  }

  const downloadUrl = await getSignedDownloadUrl(report.storageKey);

  return NextResponse.json({
    data: { status: "READY", downloadUrl },
  });
}
