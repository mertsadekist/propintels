import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";

export async function GET(_request: NextRequest) {
  const { error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalProjects,
    activeProjects,
    totalLeads,
    newLeadsThisMonth,
    totalEntries,
    totalLinks,
    leadsByStatus,
    recentLeads,
  ] = await Promise.all([
    prisma.project.count(),
    prisma.project.count({ where: { isActive: true } }),
    prisma.lead.count(),
    prisma.lead.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.entry.count({ where: { isActive: true } }),
    prisma.valuationLink.count({ where: { status: "ACTIVE" } }),
    prisma.lead.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.lead.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { name: true } },
        valuationResult: { select: { verdict: true } },
      },
    }),
  ]);

  const statusBreakdown = leadsByStatus.reduce(
    (acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    },
    {} as Record<string, number>
  );

  return NextResponse.json({
    data: {
      totalProjects,
      activeProjects,
      totalLeads,
      newLeadsThisMonth,
      totalEntries,
      totalActiveLinks: totalLinks,
      leadsByStatus: statusBreakdown,
      recentLeads,
    },
  });
}
