import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";
import { Prisma } from "@prisma/client";

interface AreaRow {
  area: string;
  medianPsf: number;
  txnCount: bigint;
  minPsf: number;
  maxPsf: number;
}

interface WeekRow {
  yr: number;
  wk: number;
  txnCount: bigint;
  avgPsf: number;
  medianPsf: number;
  minPsf: number;
  maxPsf: number;
}

interface ListingRow {
  area: string;
  listingCount: bigint;
  avgAskPsf: number;
}

interface SummaryRow {
  totalTxn: bigint;
  overallMedian: number;
  avgDealSize: number;
}

export async function GET(request: NextRequest) {
  const { error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const sp = request.nextUrl.searchParams;
  const area = sp.get("area") || null;
  const propertyType = sp.get("propertyType") || null;
  const bedroomsParam = sp.get("bedrooms");
  const bedrooms = bedroomsParam !== null && bedroomsParam !== "" ? parseInt(bedroomsParam) : null;
  const dateFrom = sp.get("dateFrom") ? new Date(sp.get("dateFrom")!) : null;
  const dateTo = sp.get("dateTo") ? new Date(sp.get("dateTo")!) : null;
  const category = sp.get("category") || null;
  const projectId = sp.get("projectId") || null;

  // Base txn conditions
  const txnConditions: Prisma.Sql[] = [
    Prisma.sql`e.sourceType = 'TRANSACTION'`,
    Prisma.sql`e.transactionPsf > 0`,
    Prisma.sql`e.isActive = 1`,
  ];
  if (area) txnConditions.push(Prisma.sql`p.location = ${area}`);
  if (propertyType) txnConditions.push(Prisma.sql`e.propertyType = ${propertyType}`);
  if (bedrooms !== null && !isNaN(bedrooms)) txnConditions.push(Prisma.sql`e.bedrooms = ${bedrooms}`);
  if (dateFrom) txnConditions.push(Prisma.sql`e.transactionDate >= ${dateFrom}`);
  if (dateTo) txnConditions.push(Prisma.sql`e.transactionDate <= ${dateTo}`);
  if (category) txnConditions.push(Prisma.sql`e.category = ${category}`);
  const txnWhere = Prisma.join(txnConditions, " AND ");

  // Weekly trend conditions (adds projectId filter for drill-down)
  const wtConditions: Prisma.Sql[] = [
    Prisma.sql`e.sourceType = 'TRANSACTION'`,
    Prisma.sql`e.transactionPsf > 0`,
    Prisma.sql`e.transactionDate IS NOT NULL`,
    Prisma.sql`e.isActive = 1`,
  ];
  if (area) wtConditions.push(Prisma.sql`p.location = ${area}`);
  if (propertyType) wtConditions.push(Prisma.sql`e.propertyType = ${propertyType}`);
  if (bedrooms !== null && !isNaN(bedrooms)) wtConditions.push(Prisma.sql`e.bedrooms = ${bedrooms}`);
  if (dateFrom) wtConditions.push(Prisma.sql`e.transactionDate >= ${dateFrom}`);
  if (dateTo) wtConditions.push(Prisma.sql`e.transactionDate <= ${dateTo}`);
  if (category) wtConditions.push(Prisma.sql`e.category = ${category}`);
  if (projectId) wtConditions.push(Prisma.sql`e.projectId = ${projectId}`);
  const wtWhere = Prisma.join(wtConditions, " AND ");

  // Listing conditions
  const listingConditions: Prisma.Sql[] = [
    Prisma.sql`e.sourceType = 'LISTING'`,
    Prisma.sql`e.askPsf > 0`,
    Prisma.sql`e.isActive = 1`,
  ];
  if (area) listingConditions.push(Prisma.sql`p.location = ${area}`);
  if (propertyType) listingConditions.push(Prisma.sql`e.propertyType = ${propertyType}`);
  if (bedrooms !== null && !isNaN(bedrooms)) listingConditions.push(Prisma.sql`e.bedrooms = ${bedrooms}`);
  if (category) listingConditions.push(Prisma.sql`e.category = ${category}`);
  const listingWhere = Prisma.join(listingConditions, " AND ");

  const [topAreaMedians, listingStats, weeklyRaw, summaryRaw] = await Promise.all([
    // Top 10 areas by transaction volume (for Market Intelligence widget)
    prisma.$queryRaw<AreaRow[]>(Prisma.sql`
      WITH ranked AS (
        SELECT p.location AS area, e.transactionPsf,
          ROW_NUMBER() OVER (PARTITION BY p.location ORDER BY e.transactionPsf) AS rn,
          COUNT(*) OVER (PARTITION BY p.location) AS total
        FROM Entry e JOIN Project p ON e.projectId = p.id
        WHERE ${txnWhere}
      )
      SELECT area, AVG(transactionPsf) AS medianPsf, MAX(total) AS txnCount,
        MIN(transactionPsf) AS minPsf, MAX(transactionPsf) AS maxPsf
      FROM ranked
      WHERE rn IN (FLOOR((total+1)/2), CEIL((total+1)/2))
      GROUP BY area
      ORDER BY MAX(total) DESC
      LIMIT 10
    `),

    // Listing average PSF per area
    prisma.$queryRaw<ListingRow[]>(Prisma.sql`
      SELECT p.location AS area, COUNT(*) AS listingCount, AVG(e.askPsf) AS avgAskPsf
      FROM Entry e JOIN Project p ON e.projectId = p.id
      WHERE ${listingWhere}
      GROUP BY p.location
    `),

    // Weekly trends with median using window functions
    prisma.$queryRaw<WeekRow[]>(Prisma.sql`
      WITH wranked AS (
        SELECT YEAR(e.transactionDate) AS yr, WEEK(e.transactionDate, 1) AS wk,
          e.transactionPsf,
          ROW_NUMBER() OVER (PARTITION BY YEAR(e.transactionDate), WEEK(e.transactionDate, 1) ORDER BY e.transactionPsf) AS rn,
          COUNT(*) OVER (PARTITION BY YEAR(e.transactionDate), WEEK(e.transactionDate, 1)) AS total
        FROM Entry e JOIN Project p ON e.projectId = p.id
        WHERE ${wtWhere}
      )
      SELECT yr, wk, MAX(total) AS txnCount,
        AVG(transactionPsf) AS medianPsf,
        AVG(transactionPsf) AS avgPsf,
        MIN(transactionPsf) AS minPsf,
        MAX(transactionPsf) AS maxPsf
      FROM wranked
      WHERE rn IN (FLOOR((total+1)/2), CEIL((total+1)/2))
      GROUP BY yr, wk
      ORDER BY yr, wk
    `),

    // Overall summary
    prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
      WITH ranked AS (
        SELECT e.transactionPsf, e.transactionPrice,
          ROW_NUMBER() OVER (ORDER BY e.transactionPsf) AS rn,
          COUNT(*) OVER () AS total
        FROM Entry e JOIN Project p ON e.projectId = p.id
        WHERE ${txnWhere}
      )
      SELECT MAX(total) AS totalTxn,
        AVG(transactionPsf) AS overallMedian,
        AVG(transactionPrice) AS avgDealSize
      FROM ranked
      WHERE rn IN (FLOOR((total+1)/2), CEIL((total+1)/2))
    `),
  ]);

  // Build listing lookup map
  const listingMap = new Map<string, ListingRow>();
  for (const row of listingStats) {
    if (row.area) listingMap.set(row.area, row);
  }

  // Build top areas with listing diff data
  const topAreas = topAreaMedians
    .filter((r) => r.area)
    .map((r) => {
      const listing = listingMap.get(r.area);
      const txnMedian = Number(r.medianPsf);
      const listingAvg = listing ? Number(listing.avgAskPsf) : 0;
      const diffPct =
        listing && listingAvg > 0 && txnMedian > 0
          ? ((listingAvg - txnMedian) / txnMedian) * 100
          : null;
      return {
        area: r.area,
        txnCount: Number(r.txnCount),
        txnMedianPsf: Math.round(txnMedian),
        listingCount: listing ? Number(listing.listingCount) : 0,
        listingAvgPsf: Math.round(listingAvg),
        diffPct: diffPct !== null ? Math.round(diffPct * 10) / 10 : null,
      };
    });

  // Build weekly trends with WoW%
  const weeklyTrends = weeklyRaw.map((row, i) => {
    const prev = i > 0 ? weeklyRaw[i - 1] : null;
    const curMedian = Number(row.medianPsf);
    const prevMedian = prev ? Number(prev.medianPsf) : null;
    const wowPct =
      prevMedian !== null && prevMedian > 0
        ? ((curMedian - prevMedian) / prevMedian) * 100
        : null;
    const yr = Number(row.yr);
    const wk = Number(row.wk);
    return {
      yr,
      wk,
      label: `W${String(wk).padStart(2, "0")} '${String(yr).slice(-2)}`,
      txnCount: Number(row.txnCount),
      txnMedianPsf: Math.round(curMedian),
      txnAvgPsf: Math.round(Number(row.avgPsf)),
      txnMinPsf: Math.round(Number(row.minPsf)),
      txnMaxPsf: Math.round(Number(row.maxPsf)),
      changePct: wowPct !== null ? Math.round(wowPct * 10) / 10 : null,
      // Legacy alias kept for backward compat (PDF report)
      qoqPct: wowPct !== null ? Math.round(wowPct * 10) / 10 : null,
    };
  });

  const summaryRow = summaryRaw[0];
  const latestTrend = weeklyTrends[weeklyTrends.length - 1];
  const totalListings = listingStats.reduce((sum, r) => sum + Number(r.listingCount), 0);

  return NextResponse.json({
    data: {
      summary: {
        totalTransactions: summaryRow ? Number(summaryRow.totalTxn) : 0,
        totalListings,
        overallMedianPsf: summaryRow ? Math.round(Number(summaryRow.overallMedian)) : 0,
        overallAvgDealSize: summaryRow ? Math.round(Number(summaryRow.avgDealSize)) : 0,
        periodsCount: weeklyTrends.length,
        wowChange: latestTrend?.changePct ?? null,
        // Legacy alias for backward compat
        qoqChange: latestTrend?.changePct ?? null,
      },
      weeklyTrends,
      topAreas,
      // Legacy alias: keep areaBreakdown as topAreas slice for any existing PDF report usage
      areaBreakdown: topAreas,
      // Legacy alias: keep quarterlyTrends for PDF report
      quarterlyTrends: weeklyTrends,
    },
  });
}
