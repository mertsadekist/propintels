import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";
import { Prisma } from "@prisma/client";

// ─── GET /api/analytics/price-trends ──────────────────────────────────────────
// Absolute AED deal-value analytics: monthly median price, bracket distribution,
// area ranking, and quarterly median price table.
export async function GET(req: NextRequest) {
  const { error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  try {
    const sp = req.nextUrl.searchParams;
    const dateFrom       = sp.get("dateFrom")      ? new Date(sp.get("dateFrom")!)   : null;
    const dateTo         = sp.get("dateTo")        ? new Date(sp.get("dateTo")!)     : null;
    const areasStr       = sp.get("areas")         || "";
    const propTypesStr   = sp.get("propertyTypes") || "";
    const unitType       = sp.get("unitType")      || "";
    const bedroomsStr    = sp.get("bedrooms")      || "";
    const category       = sp.get("category")      || "";

    const areas      = areasStr     ? areasStr.split(",").filter(Boolean)     : [];
    const propTypes  = propTypesStr ? propTypesStr.split(",").filter(Boolean) : [];
    const bedrooms   = bedroomsStr  ? bedroomsStr.split(",").filter(Boolean)  : [];

    const cond: Prisma.Sql[] = [
      Prisma.sql`e.sourceType = 'TRANSACTION'`,
      Prisma.sql`e.isActive = 1`,
      Prisma.sql`e.transactionDate IS NOT NULL`,
      Prisma.sql`e.transactionPrice IS NOT NULL`,
      Prisma.sql`e.transactionPrice > 0`,
    ];
    if (dateFrom)      cond.push(Prisma.sql`e.transactionDate >= ${dateFrom}`);
    if (dateTo)        cond.push(Prisma.sql`e.transactionDate <= ${dateTo}`);
    if (unitType === "ready")   cond.push(Prisma.sql`e.unitType = 'Existing'`);
    if (unitType === "offplan") cond.push(Prisma.sql`e.unitType = 'Off-Plan'`);
    if (category)      cond.push(Prisma.sql`e.category = ${category}`);
    if (areas.length) {
      const inList = Prisma.join(areas.map((a) => Prisma.sql`${a}`), ",");
      cond.push(Prisma.sql`p.location IN (${inList})`);
    }
    if (propTypes.length) {
      const inList = Prisma.join(propTypes.map((t) => Prisma.sql`${t}`), ",");
      cond.push(Prisma.sql`e.propertyType IN (${inList})`);
    }
    if (bedrooms.length) {
      const bdInts = bedrooms.map(Number).filter((n) => !isNaN(n));
      if (bdInts.length) {
        const inList = Prisma.join(bdInts.map((b) => Prisma.sql`${b}`), ",");
        cond.push(Prisma.sql`e.bedrooms IN (${inList})`);
      }
    }
    const where = Prisma.join(cond, " AND ");

    const toNum = (v: unknown): number => (v == null ? 0 : Number(v));

    // ── Q1: Monthly median price by area (last 24 months) ──────────────────
    interface MonthlyAreaRow { area: string; yr: unknown; mo: unknown; medianPrice: unknown; txnCount: bigint; }
    const monthlyByAreaRaw = await prisma.$queryRaw<MonthlyAreaRow[]>(Prisma.sql`
      WITH ranked AS (
        SELECT p.location              AS area,
               YEAR(e.transactionDate) AS yr,
               MONTH(e.transactionDate) AS mo,
               e.transactionPrice,
               ROW_NUMBER() OVER (
                 PARTITION BY p.location, YEAR(e.transactionDate), MONTH(e.transactionDate)
                 ORDER BY e.transactionPrice
               ) AS rn,
               COUNT(*) OVER (
                 PARTITION BY p.location, YEAR(e.transactionDate), MONTH(e.transactionDate)
               ) AS total
        FROM Entry e
        JOIN Project p ON e.projectId = p.id
        WHERE ${where}
          AND p.location IS NOT NULL
          AND e.transactionDate >= DATE_SUB(CURDATE(), INTERVAL 24 MONTH)
      )
      SELECT area, yr, mo,
             AVG(transactionPrice) AS medianPrice,
             MAX(total)            AS txnCount
      FROM ranked
      WHERE rn IN (FLOOR((total+1)/2), CEIL((total+1)/2))
      GROUP BY area, yr, mo
      ORDER BY yr, mo, area
    `);

    // ── Q2: Price bracket distribution ────────────────────────────────────
    interface BracketRow { bracket: string; txnCount: bigint; totalValue: unknown; }
    const bracketsRaw = await prisma.$queryRaw<BracketRow[]>(Prisma.sql`
      SELECT
        CASE
          WHEN e.transactionPrice <  500000   THEN 'under500k'
          WHEN e.transactionPrice <  1000000  THEN '500k-1m'
          WHEN e.transactionPrice <  2000000  THEN '1m-2m'
          WHEN e.transactionPrice <  5000000  THEN '2m-5m'
          WHEN e.transactionPrice <  10000000 THEN '5m-10m'
          ELSE                                     '10m+'
        END                       AS bracket,
        COUNT(*)                  AS txnCount,
        SUM(e.transactionPrice)   AS totalValue
      FROM Entry e
      JOIN Project p ON e.projectId = p.id
      WHERE ${where}
      GROUP BY
        CASE
          WHEN e.transactionPrice <  500000   THEN 'under500k'
          WHEN e.transactionPrice <  1000000  THEN '500k-1m'
          WHEN e.transactionPrice <  2000000  THEN '1m-2m'
          WHEN e.transactionPrice <  5000000  THEN '2m-5m'
          WHEN e.transactionPrice <  10000000 THEN '5m-10m'
          ELSE '10m+'
        END
      ORDER BY MIN(e.transactionPrice)
    `);

    // ── Q3: Area ranking by median deal size (top 20) ─────────────────────
    interface AreaRankRow { area: string; medianPrice: unknown; maxPrice: unknown; minPrice: unknown; txnCount: bigint; }
    const areaRankingRaw = await prisma.$queryRaw<AreaRankRow[]>(Prisma.sql`
      WITH ranked AS (
        SELECT p.location AS area,
               e.transactionPrice,
               ROW_NUMBER() OVER (PARTITION BY p.location ORDER BY e.transactionPrice) AS rn,
               COUNT(*) OVER (PARTITION BY p.location) AS total
        FROM Entry e
        JOIN Project p ON e.projectId = p.id
        WHERE ${where}
          AND p.location IS NOT NULL
      )
      SELECT area,
             AVG(transactionPrice) AS medianPrice,
             MAX(transactionPrice) AS maxPrice,
             MIN(transactionPrice) AS minPrice,
             MAX(total)            AS txnCount
      FROM ranked
      WHERE rn IN (FLOOR((total+1)/2), CEIL((total+1)/2))
      GROUP BY area
      ORDER BY medianPrice DESC
      LIMIT 20
    `);

    // ── Q4: Quarterly median price by area (for heatmap table) ────────────
    interface QtrAreaRow { area: string; yr: unknown; qtr: unknown; medianPrice: unknown; txnCount: bigint; }
    const quarterlyTableRaw = await prisma.$queryRaw<QtrAreaRow[]>(Prisma.sql`
      WITH ranked AS (
        SELECT p.location               AS area,
               YEAR(e.transactionDate)  AS yr,
               QUARTER(e.transactionDate) AS qtr,
               e.transactionPrice,
               ROW_NUMBER() OVER (
                 PARTITION BY p.location, YEAR(e.transactionDate), QUARTER(e.transactionDate)
                 ORDER BY e.transactionPrice
               ) AS rn,
               COUNT(*) OVER (
                 PARTITION BY p.location, YEAR(e.transactionDate), QUARTER(e.transactionDate)
               ) AS total
        FROM Entry e
        JOIN Project p ON e.projectId = p.id
        WHERE ${where}
          AND p.location IS NOT NULL
      )
      SELECT area, yr, qtr,
             AVG(transactionPrice) AS medianPrice,
             MAX(total)            AS txnCount
      FROM ranked
      WHERE rn IN (FLOOR((total+1)/2), CEIL((total+1)/2))
      GROUP BY area, yr, qtr
      ORDER BY yr, qtr, area
    `);

    return NextResponse.json({
      data: {
        monthlyByArea: monthlyByAreaRaw.map((r) => ({
          area:        String(r.area),
          yr:          Number(r.yr),
          mo:          Number(r.mo),
          medianPrice: toNum(r.medianPrice),
          txnCount:    Number(r.txnCount),
        })),
        brackets: bracketsRaw.map((r) => ({
          bracket:    String(r.bracket),
          txnCount:   Number(r.txnCount),
          totalValue: toNum(r.totalValue),
        })),
        areaRanking: areaRankingRaw.map((r) => ({
          area:        String(r.area),
          medianPrice: toNum(r.medianPrice),
          maxPrice:    toNum(r.maxPrice),
          minPrice:    toNum(r.minPrice),
          txnCount:    Number(r.txnCount),
        })),
        quarterlyTable: quarterlyTableRaw.map((r) => ({
          area:        String(r.area),
          yr:          Number(r.yr),
          qtr:         Number(r.qtr),
          medianPrice: toNum(r.medianPrice),
          txnCount:    Number(r.txnCount),
        })),
      },
    });
  } catch (e) {
    console.error("[price-trends] error:", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : String(e) } },
      { status: 500 }
    );
  }
}
