import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";

export async function GET(request: NextRequest) {
  const { error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") ?? "20"), 100);

  const where = {
    ...(status ? { status: status as "QUEUED" | "PROCESSING" | "READY" | "FAILED" } : {}),
    ...(search
      ? { lead: { fullName: { contains: search } } }
      : {}),
  };

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            project: { select: { name: true } },
            valuationResult: { select: { verdict: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.report.count({ where }),
  ]);

  return NextResponse.json({
    data: reports,
    meta: { total, page, pageSize },
  });
}
