import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";
import { Prisma } from "@prisma/client";

// ─── GET /api/analytics/price-change ──────────────────────────────────────────
// Quarterly median transaction price by area and by project.
// YoY/QoQ/appreciation-index calculations are done in the client component.
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

    // ── Q1: Area quarterly median price ───────────────────────────────────
    interface AreaQtrRow { area: string; yr: unknown; qtr: unknown; medianPrice: unknown; txnCount: bigint; }
    const areaQuarterlyRaw = await prisma.$queryRaw<AreaQtrRow[]>(Prisma.sql`
      WITH ranked AS (
        SELECT p.location                 AS area,
               YEAR(e.transactionDate)    AS yr,
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
      ORDER BY area, yr, qtr
    `);

    // ── Q2: Project quarterly median price ────────────────────────────────
    interface ProjectQtrRow { projectName: string; area: string; yr: unknown; qtr: unknown; medianPrice: unknown; txnCount: bigint; }
    const projectQuarterlyRaw = await prisma.$queryRaw<ProjectQtrRow[]>(Prisma.sql`
      WITH ranked AS (
        SELECT p.name                     AS projectName,
               p.location                 AS area,
               YEAR(e.transactionDate)    AS yr,
               QUARTER(e.transactionDate) AS qtr,
               e.transactionPrice,
               ROW_NUMBER() OVER (
                 PARTITION BY p.name, YEAR(e.transactionDate), QUARTER(e.transactionDate)
                 ORDER BY e.transactionPrice
               ) AS rn,
               COUNT(*) OVER (
                 PARTITION BY p.name, YEAR(e.transactionDate), QUARTER(e.transactionDate)
               ) AS total
        FROM Entry e
        JOIN Project p ON e.projectId = p.id
        WHERE ${where}
          AND p.name IS NOT NULL
      )
      SELECT projectName, area, yr, qtr,
             AVG(transactionPrice) AS medianPrice,
             MAX(total)            AS txnCount
      FROM ranked
      WHERE rn IN (FLOOR((total+1)/2), CEIL((total+1)/2))
      GROUP BY projectName, area, yr, qtr
      ORDER BY projectName, yr, qtr
    `);

    return NextResponse.json({
      data: {
        areaQuarterly: areaQuarterlyRaw.map((r) => ({
          area:        String(r.area),
          yr:          Number(r.yr),
          qtr:         Number(r.qtr),
          medianPrice: toNum(r.medianPrice),
          txnCount:    Number(r.txnCount),
        })),
        projectQuarterly: projectQuarterlyRaw.map((r) => ({
          projectName: String(r.projectName),
          area:        String(r.area || ""),
          yr:          Number(r.yr),
          qtr:         Number(r.qtr),
          medianPrice: toNum(r.medianPrice),
          txnCount:    Number(r.txnCount),
        })),
      },
    });
  } catch (e) {
    console.error("[price-change] error:", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : String(e) } },
      { status: 500 }
    );
  }
}
