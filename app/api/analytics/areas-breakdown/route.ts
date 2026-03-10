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

interface ListingRow {
  area: string;
  listingCount: bigint;
  avgAskPsf: number;
}

interface CountRow {
  total: bigint;
}

type SortBy = "txnCount" | "txnMedianPsf" | "listingAvgPsf" | "diffPct" | "area";
type SortDir = "asc" | "desc";

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
  const page = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const pageSize = Math.min(Math.max(1, parseInt(sp.get("pageSize") ?? "20")), 100);
  const sortBy: SortBy = (sp.get("sortBy") as SortBy) || "txnCount";
  const sortDir: SortDir = sp.get("sortDir") === "asc" ? "asc" : "desc";
  const skip = (page - 1) * pageSize;

  // Build txn WHERE conditions
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

  const [allAreaMedians, listingStats, countRaw] = await Promise.all([
    // All areas — no LIMIT, will paginate in JS after merging
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
    `),

    // Listing data per area
    prisma.$queryRaw<ListingRow[]>(Prisma.sql`
      SELECT p.location AS area, COUNT(*) AS listingCount, AVG(e.askPsf) AS avgAskPsf
      FROM Entry e JOIN Project p ON e.projectId = p.id
      WHERE ${listingWhere}
      GROUP BY p.location
    `),

    // Total distinct area count
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(DISTINCT p.location) AS total
      FROM Entry e JOIN Project p ON e.projectId = p.id
      WHERE ${txnWhere}
    `),
  ]);

  // Build listing lookup map
  const listingMap = new Map<string, ListingRow>();
  for (const row of listingStats) {
    if (row.area) listingMap.set(row.area, row);
  }

  // Merge and compute derived fields
  const merged = allAreaMedians
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
        txnMinPsf: Math.round(Number(r.minPsf)),
        txnMaxPsf: Math.round(Number(r.maxPsf)),
        listingCount: listing ? Number(listing.listingCount) : 0,
        listingAvgPsf: Math.round(listingAvg),
        diffPct: diffPct !== null ? Math.round(diffPct * 10) / 10 : null,
      };
    });

  // Sort by requested field
  const sorted = [...merged].sort((a, b) => {
    let av: number | string | null;
    let bv: number | string | null;
    switch (sortBy) {
      case "area":          av = a.area;          bv = b.area;          break;
      case "txnMedianPsf":  av = a.txnMedianPsf;  bv = b.txnMedianPsf;  break;
      case "listingAvgPsf": av = a.listingAvgPsf;  bv = b.listingAvgPsf; break;
      case "diffPct":       av = a.diffPct;         bv = b.diffPct;       break;
      default:              av = a.txnCount;        bv = b.txnCount;
    }
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Paginate
  const paginated = sorted.slice(skip, skip + pageSize);
  const total = Number(countRaw[0]?.total ?? sorted.length);

  return NextResponse.json({
    data: paginated,
    meta: { total, page, pageSize },
  });
}
