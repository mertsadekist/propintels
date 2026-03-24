import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";
import { Prisma } from "@prisma/client";

// ─── GET /api/analytics/property-mix ─────────────────────────────────────
// Returns transaction breakdown by propertyType, unitType, and category
export async function GET(req: NextRequest) {
  const { error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const sp = req.nextUrl.searchParams;
  const dateFrom  = sp.get("dateFrom") ? new Date(sp.get("dateFrom")!) : null;
  const dateTo    = sp.get("dateTo")   ? new Date(sp.get("dateTo")!)   : null;
  const areasStr  = sp.get("areas")    || "";
  const areas     = areasStr ? areasStr.split(",").filter(Boolean) : [];
  const unitType  = sp.get("unitType") || "";

  // Base conditions
  const cond: Prisma.Sql[] = [
    Prisma.sql`e.sourceType = 'TRANSACTION'`,
    Prisma.sql`e.isActive = 1`,
    Prisma.sql`e.transactionPsf > 0`,
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

  // 1. By property type
  interface TypeRow { propertyType: string; txnCount: bigint; medianPsf: number; totalValue: number; }
  const byType = await prisma.$queryRaw<TypeRow[]>(Prisma.sql`
    SELECT e.propertyType, COUNT(*) AS txnCount,
           AVG(e.transactionPsf)   AS medianPsf,
           SUM(e.transactionPrice) AS totalValue
    FROM Entry e JOIN Project p ON e.projectId = p.id
    WHERE ${where}
    GROUP BY e.propertyType
    ORDER BY txnCount DESC
  `);

  // 2. By unitType (Ready vs Off-Plan)
  interface UnitRow { unitType: string | null; txnCount: bigint; medianPsf: number; }
  const byUnitType = await prisma.$queryRaw<UnitRow[]>(Prisma.sql`
    SELECT COALESCE(e.unitType, 'Unknown') AS unitType,
           COUNT(*) AS txnCount,
           AVG(e.transactionPsf) AS medianPsf
    FROM Entry e JOIN Project p ON e.projectId = p.id
    WHERE ${where}
    GROUP BY e.unitType
    ORDER BY txnCount DESC
  `);

  // 3. By category (Residential vs Commercial)
  interface CatRow { category: string; txnCount: bigint; medianPsf: number; }
  const byCategory = await prisma.$queryRaw<CatRow[]>(Prisma.sql`
    SELECT e.category, COUNT(*) AS txnCount,
           AVG(e.transactionPsf) AS medianPsf
    FROM Entry e JOIN Project p ON e.projectId = p.id
    WHERE ${where}
    GROUP BY e.category
    ORDER BY txnCount DESC
  `);

  // 4. Monthly breakdown (Ready vs Off-Plan) — last 24 months
  interface MonthRow { yr: number; mo: number; unitType: string | null; txnCount: bigint; medianPsf: number; }
  const monthly = await prisma.$queryRaw<MonthRow[]>(Prisma.sql`
    SELECT YEAR(e.transactionDate)  AS yr,
           MONTH(e.transactionDate) AS mo,
           COALESCE(e.unitType, 'Unknown') AS unitType,
           COUNT(*) AS txnCount,
           AVG(e.transactionPsf) AS medianPsf
    FROM Entry e JOIN Project p ON e.projectId = p.id
    WHERE ${where}
      AND e.transactionDate >= DATE_SUB(CURDATE(), INTERVAL 24 MONTH)
    GROUP BY yr, mo, e.unitType
    ORDER BY yr, mo
  `);

  // 5. Property type × bedroom breakdown
  interface TypeBrRow { propertyType: string; bedrooms: number | null; txnCount: bigint; medianPsf: number; }
  const byTypeBedroom = await prisma.$queryRaw<TypeBrRow[]>(Prisma.sql`
    SELECT e.propertyType,
           CASE WHEN e.bedrooms >= 5 THEN 5 ELSE e.bedrooms END AS bedrooms,
           COUNT(*) AS txnCount,
           AVG(e.transactionPsf) AS medianPsf
    FROM Entry e JOIN Project p ON e.projectId = p.id
    WHERE ${where} AND e.bedrooms IS NOT NULL
    GROUP BY e.propertyType, bedrooms
    ORDER BY e.propertyType, bedrooms
  `);

  const serialize = (v: unknown): unknown =>
    typeof v === "bigint" ? Number(v) : v;

  return NextResponse.json({
    data: {
      byType:        byType.map((r) => ({ ...r, txnCount: Number(r.txnCount), medianPsf: Math.round(Number(r.medianPsf)), totalValue: Number(r.totalValue) })),
      byUnitType:    byUnitType.map((r) => ({ ...r, txnCount: Number(r.txnCount), medianPsf: Math.round(Number(r.medianPsf)) })),
      byCategory:    byCategory.map((r) => ({ ...r, txnCount: Number(r.txnCount), medianPsf: Math.round(Number(r.medianPsf)) })),
      monthly:       monthly.map((r) => ({ ...r, txnCount: Number(r.txnCount), medianPsf: Math.round(Number(r.medianPsf)) })),
      byTypeBedroom: byTypeBedroom.map((r) => ({ ...r, txnCount: Number(r.txnCount), medianPsf: Math.round(Number(r.medianPsf)) })),
    },
  });
}
