import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";
import { Prisma } from "@prisma/client";

// ─── GET /api/analytics/volume ────────────────────────────────────────────
// Returns transaction volume by month and by day (for calendar heatmap)
export async function GET(req: NextRequest) {
  const { error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  try {
    const sp = req.nextUrl.searchParams;
    const dateFrom = sp.get("dateFrom") ? new Date(sp.get("dateFrom")!) : null;
    const dateTo   = sp.get("dateTo")   ? new Date(sp.get("dateTo")!)   : null;
    const areasStr = sp.get("areas")    || "";
    const areas    = areasStr ? areasStr.split(",").filter(Boolean) : [];
    const unitType = sp.get("unitType") || "";

    const cond: Prisma.Sql[] = [
      Prisma.sql`e.sourceType = 'TRANSACTION'`,
      Prisma.sql`e.isActive = 1`,
      Prisma.sql`e.transactionDate IS NOT NULL`,
    ];
    if (dateFrom) cond.push(Prisma.sql`e.transactionDate >= ${dateFrom}`);
    if (dateTo)   cond.push(Prisma.sql`e.transactionDate <= ${dateTo}`);
    if (unitType === "ready")   cond.push(Prisma.sql`e.unitType = 'Existing'`);
    if (unitType === "offplan") cond.push(Prisma.sql`e.unitType = 'Off-Plan'`);
    if (areas.length) {
      const inList = Prisma.join(areas.map((a) => Prisma.sql`${a}`), ",");
      cond.push(Prisma.sql`p.location IN (${inList})`);
    }
    const where = Prisma.join(cond, " AND ");

    const toNum  = (v: unknown): number => (v == null ? 0 : Number(v));
    const toRound = (v: unknown): number => (v == null ? 0 : Math.round(Number(v)));

    // Monthly aggregates — use explicit expressions in GROUP BY
    interface MonthRow { yr: unknown; mo: unknown; txnCount: bigint; totalValue: unknown; medianPsf: unknown; }
    const monthly = await prisma.$queryRaw<MonthRow[]>(Prisma.sql`
      SELECT YEAR(e.transactionDate)  AS yr,
             MONTH(e.transactionDate) AS mo,
             COUNT(*)                 AS txnCount,
             SUM(e.transactionPrice)  AS totalValue,
             AVG(e.transactionPsf)    AS medianPsf
      FROM Entry e JOIN Project p ON e.projectId = p.id
      WHERE ${where}
      GROUP BY YEAR(e.transactionDate), MONTH(e.transactionDate)
      ORDER BY YEAR(e.transactionDate), MONTH(e.transactionDate)
    `);

    // Daily aggregates (calendar heatmap) — last 365 days or filter range
    const calFrom = dateFrom ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const calTo   = dateTo ?? new Date();
    interface DayRow { dt: unknown; txnCount: bigint; totalValue: unknown; }
    const daily = await prisma.$queryRaw<DayRow[]>(Prisma.sql`
      SELECT DATE(e.transactionDate) AS dt,
             COUNT(*)                AS txnCount,
             SUM(e.transactionPrice) AS totalValue
      FROM Entry e JOIN Project p ON e.projectId = p.id
      WHERE ${where}
        AND e.transactionDate >= ${calFrom}
        AND e.transactionDate <= ${calTo}
      GROUP BY DATE(e.transactionDate)
      ORDER BY DATE(e.transactionDate)
    `);

    // Top areas by month (last 12 months) — use explicit expressions in GROUP BY
    interface AreaMonthRow { area: string; yr: unknown; mo: unknown; txnCount: bigint; }
    const areaMonthly = await prisma.$queryRaw<AreaMonthRow[]>(Prisma.sql`
      SELECT p.location AS area,
             YEAR(e.transactionDate)  AS yr,
             MONTH(e.transactionDate) AS mo,
             COUNT(*) AS txnCount
      FROM Entry e JOIN Project p ON e.projectId = p.id
      WHERE ${where}
        AND e.transactionDate >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        AND p.location IS NOT NULL
      GROUP BY p.location, YEAR(e.transactionDate), MONTH(e.transactionDate)
      ORDER BY YEAR(e.transactionDate), MONTH(e.transactionDate), txnCount DESC
    `);

    return NextResponse.json({
      data: {
        monthly:     monthly.map((r) => ({
          yr:        Number(r.yr),
          mo:        Number(r.mo),
          txnCount:  Number(r.txnCount),
          totalValue: toNum(r.totalValue),
          medianPsf:  toRound(r.medianPsf),
        })),
        daily:       daily.map((r) => ({
          date:      r.dt instanceof Date
            ? r.dt.toISOString().slice(0, 10)
            : String(r.dt ?? "").slice(0, 10),
          txnCount:  Number(r.txnCount),
          totalValue: toNum(r.totalValue),
        })),
        areaMonthly: areaMonthly.map((r) => ({
          area:     String(r.area),
          yr:       Number(r.yr),
          mo:       Number(r.mo),
          txnCount: Number(r.txnCount),
        })),
      },
    });
  } catch (e) {
    console.error("[volume] error:", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : String(e) } },
      { status: 500 }
    );
  }
}
