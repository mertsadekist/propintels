import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";

// ─── GET /api/analytics/valuations ────────────────────────────────────────
// Returns lead pipeline + valuation verdict stats
export async function GET(req: NextRequest) {
  const { error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const sp = req.nextUrl.searchParams;
  const dateFrom = sp.get("dateFrom") ? new Date(sp.get("dateFrom")!) : null;
  const dateTo   = sp.get("dateTo")   ? new Date(sp.get("dateTo")!)   : null;

  // Lead status funnel
  const leadsByStatus = await prisma.lead.groupBy({
    by:     ["status"],
    _count: { _all: true },
    where:  {
      ...(dateFrom && { createdAt: { gte: dateFrom } }),
      ...(dateTo   && { createdAt: { lte: dateTo   } }),
    },
  });

  // Verdict distribution
  const byVerdict = await prisma.valuationResult.groupBy({
    by:     ["verdict"],
    _count: { _all: true },
    where:  dateFrom || dateTo
      ? { lead: { createdAt: { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) } } }
      : undefined,
  });

  // Confidence distribution (buckets: 0-20, 21-40, 41-60, 61-80, 81-100)
  const confBuckets = await prisma.$queryRaw<{ bucket: string; cnt: bigint }[]>`
    SELECT CASE
      WHEN confidence BETWEEN 0  AND 20  THEN '0-20'
      WHEN confidence BETWEEN 21 AND 40  THEN '21-40'
      WHEN confidence BETWEEN 41 AND 60  THEN '41-60'
      WHEN confidence BETWEEN 61 AND 80  THEN '61-80'
      WHEN confidence BETWEEN 81 AND 100 THEN '81-100'
      ELSE 'Unknown'
    END AS bucket,
    COUNT(*) AS cnt
    FROM ValuationResult
    GROUP BY bucket
    ORDER BY bucket
  `;

  // Summary stats
  const totalLeads    = await prisma.lead.count({
    where: { ...(dateFrom && { createdAt: { gte: dateFrom } }), ...(dateTo && { createdAt: { lte: dateTo } }) },
  });
  const totalResults  = await prisma.valuationResult.count();
  const avgConfidence = await prisma.valuationResult.aggregate({ _avg: { confidence: true } });
  const specialistCount = await prisma.specialistAssessment.count();

  // Client PSF vs market PSF (for scatter) — sample 200
  const scatter = await prisma.valuationResult.findMany({
    take: 200,
    select: {
      clientPsf:             true,
      transactionMedianPsf:  true,
      verdict:               true,
      ratioToMarket:         true,
    },
    where: {
      transactionMedianPsf: { not: null },
      clientPsf:            { gt: 0 },
    },
    orderBy: { createdAt: "desc" },
  });

  // Monthly leads trend
  interface MonthRow { yr: number; mo: number; cnt: bigint; }
  const monthlyLeads = await prisma.$queryRaw<MonthRow[]>`
    SELECT YEAR(createdAt)  AS yr,
           MONTH(createdAt) AS mo,
           COUNT(*) AS cnt
    FROM Lead
    GROUP BY yr, mo
    ORDER BY yr, mo
  `;

  return NextResponse.json({
    data: {
      leadsByStatus: leadsByStatus.map((r) => ({ status: r.status, count: r._count._all })),
      byVerdict:     byVerdict.map((r) => ({ verdict: r.verdict, count: r._count._all })),
      confBuckets:   confBuckets.map((r) => ({ bucket: r.bucket, count: Number(r.cnt) })),
      monthlyLeads:  monthlyLeads.map((r) => ({ yr: Number(r.yr), mo: Number(r.mo), count: Number(r.cnt) })),
      scatter:       scatter.map((r) => ({
        clientPsf:    Number(r.clientPsf),
        marketPsf:    Number(r.transactionMedianPsf),
        verdict:      r.verdict,
        ratio:        r.ratioToMarket ? Number(r.ratioToMarket) : null,
      })),
      summary: {
        totalLeads,
        totalResults,
        avgConfidence: Math.round(Number(avgConfidence._avg.confidence) || 0),
        specialistCount,
      },
    },
  });
}
