import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";
import { Prisma } from "@prisma/client";

// ─── GET /api/analytics/deal-segments ─────────────────────────────────────────
// Price tier (bracket) distribution, monthly bracket trend, bedroom×bracket grid,
// and quarterly luxury market share.
export async function GET(req: NextRequest) {
  const { error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  try {
    const sp = req.nextUrl.searchParams;
    const dateFrom     = sp.get("dateFrom")      ? new Date(sp.get("dateFrom")!)   : null;
    const dateTo       = sp.get("dateTo")        ? new Date(sp.get("dateTo")!)     : null;
    const areasStr     = sp.get("areas")         || "";
    const propTypesStr = sp.get("propertyTypes") || "";
    const unitType     = sp.get("unitType")      || "";
    const bedroomsStr  = sp.get("bedrooms")      || "";
    const category     = sp.get("category")      || "";

    const areas     = areasStr     ? areasStr.split(",").filter(Boolean)     : [];
    const propTypes = propTypesStr ? propTypesStr.split(",").filter(Boolean) : [];
    const bedrooms  = bedroomsStr  ? bedroomsStr.split(",").filter(Boolean)  : [];

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

    // Helper SQL fragment for price bracket CASE expression
    // NOTE: MySQL strict mode requires the full CASE repeated in GROUP BY — we inline it each time.

    // ── Q1: Price bracket counts ──────────────────────────────────────────
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
        END                      AS bracket,
        COUNT(*)                 AS txnCount,
        SUM(e.transactionPrice)  AS totalValue
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

    // ── Q2: Monthly bracket trend (last 18 months) ─────────────────────────
    interface MonthBracketRow { yr: unknown; mo: unknown; bracket: string; txnCount: bigint; }
    const monthlyBracketRaw = await prisma.$queryRaw<MonthBracketRow[]>(Prisma.sql`
      SELECT
        YEAR(e.transactionDate)  AS yr,
        MONTH(e.transactionDate) AS mo,
        CASE
          WHEN e.transactionPrice <  500000   THEN 'under500k'
          WHEN e.transactionPrice <  1000000  THEN '500k-1m'
          WHEN e.transactionPrice <  2000000  THEN '1m-2m'
          WHEN e.transactionPrice <  5000000  THEN '2m-5m'
          WHEN e.transactionPrice <  10000000 THEN '5m-10m'
          ELSE                                     '10m+'
        END                      AS bracket,
        COUNT(*)                 AS txnCount
      FROM Entry e
      JOIN Project p ON e.projectId = p.id
      WHERE ${where}
        AND e.transactionDate >= DATE_SUB(CURDATE(), INTERVAL 18 MONTH)
      GROUP BY
        YEAR(e.transactionDate),
        MONTH(e.transactionDate),
        CASE
          WHEN e.transactionPrice <  500000   THEN 'under500k'
          WHEN e.transactionPrice <  1000000  THEN '500k-1m'
          WHEN e.transactionPrice <  2000000  THEN '1m-2m'
          WHEN e.transactionPrice <  5000000  THEN '2m-5m'
          WHEN e.transactionPrice <  10000000 THEN '5m-10m'
          ELSE '10m+'
        END
      ORDER BY yr, mo, MIN(e.transactionPrice)
    `);

    // ── Q3: Bedroom × bracket grid ────────────────────────────────────────
    interface BrBracketRow { bedroomsGroup: unknown; bracket: string; txnCount: bigint; }
    const brBracketRaw = await prisma.$queryRaw<BrBracketRow[]>(Prisma.sql`
      SELECT
        CASE WHEN e.bedrooms >= 5 THEN 5 ELSE e.bedrooms END AS bedroomsGroup,
        CASE
          WHEN e.transactionPrice <  500000   THEN 'under500k'
          WHEN e.transactionPrice <  1000000  THEN '500k-1m'
          WHEN e.transactionPrice <  2000000  THEN '1m-2m'
          WHEN e.transactionPrice <  5000000  THEN '2m-5m'
          WHEN e.transactionPrice <  10000000 THEN '5m-10m'
          ELSE                                     '10m+'
        END                      AS bracket,
        COUNT(*)                 AS txnCount
      FROM Entry e
      JOIN Project p ON e.projectId = p.id
      WHERE ${where}
        AND e.bedrooms IS NOT NULL
      GROUP BY
        CASE WHEN e.bedrooms >= 5 THEN 5 ELSE e.bedrooms END,
        CASE
          WHEN e.transactionPrice <  500000   THEN 'under500k'
          WHEN e.transactionPrice <  1000000  THEN '500k-1m'
          WHEN e.transactionPrice <  2000000  THEN '1m-2m'
          WHEN e.transactionPrice <  5000000  THEN '2m-5m'
          WHEN e.transactionPrice <  10000000 THEN '5m-10m'
          ELSE '10m+'
        END
      ORDER BY bedroomsGroup, MIN(e.transactionPrice)
    `);

    // ── Q4: Quarterly luxury market share ─────────────────────────────────
    interface LuxuryQtrRow { yr: unknown; qtr: unknown; totalTxns: bigint; luxuryTxns: unknown; }
    const luxuryQuarterlyRaw = await prisma.$queryRaw<LuxuryQtrRow[]>(Prisma.sql`
      SELECT
        YEAR(e.transactionDate)    AS yr,
        QUARTER(e.transactionDate) AS qtr,
        COUNT(*)                   AS totalTxns,
        SUM(CASE WHEN e.transactionPrice >= 5000000 THEN 1 ELSE 0 END) AS luxuryTxns
      FROM Entry e
      JOIN Project p ON e.projectId = p.id
      WHERE ${where}
      GROUP BY YEAR(e.transactionDate), QUARTER(e.transactionDate)
      ORDER BY yr, qtr
    `);

    return NextResponse.json({
      data: {
        brackets: bracketsRaw.map((r) => ({
          bracket:    String(r.bracket),
          txnCount:   Number(r.txnCount),
          totalValue: toNum(r.totalValue),
        })),
        monthlyBracket: monthlyBracketRaw.map((r) => ({
          yr:       Number(r.yr),
          mo:       Number(r.mo),
          bracket:  String(r.bracket),
          txnCount: Number(r.txnCount),
        })),
        brBracket: brBracketRaw.map((r) => ({
          bedroomsGroup: Number(r.bedroomsGroup),
          bracket:       String(r.bracket),
          txnCount:      Number(r.txnCount),
        })),
        luxuryQuarterly: luxuryQuarterlyRaw.map((r) => ({
          yr:          Number(r.yr),
          qtr:         Number(r.qtr),
          totalTxns:   Number(r.totalTxns),
          luxuryTxns:  toNum(r.luxuryTxns),
        })),
      },
    });
  } catch (e) {
    console.error("[deal-segments] error:", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : String(e) } },
      { status: 500 }
    );
  }
}
