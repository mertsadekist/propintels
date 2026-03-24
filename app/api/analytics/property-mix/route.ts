import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";
import { Prisma } from "@prisma/client";

// ─── GET /api/analytics/property-mix ─────────────────────────────────────
// Returns transaction breakdown by propertyType, unitType, and category
export async function GET(req: NextRequest) {
  const { error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  try {
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
    interface TypeRow { propertyType: string; txnCount: bigint; medianPsf: unknown; totalValue: unknown; }
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
    interface UnitRow { unitType: string | null; txnCount: bigint; medianPsf: unknown; }
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
    interface CatRow { category: string; txnCount: bigint; medianPsf: unknown; }
    const byCategory = await prisma.$queryRaw<CatRow[]>(Prisma.sql`
      SELECT e.category, COUNT(*) AS txnCount,
             AVG(e.transactionPsf) AS medianPsf
      FROM Entry e JOIN Project p ON e.projectId = p.id
      WHERE ${where}
      GROUP BY e.category
      ORDER BY txnCount DESC
    `);

    // 4. Monthly breakdown (Ready vs Off-Plan) — last 24 months
    // Use explicit expressions in GROUP BY to avoid MySQL strict-mode issues with aliases
    interface MonthRow { yr: number; mo: number; unitType: string | null; txnCount: bigint; medianPsf: unknown; }
    const monthly = await prisma.$queryRaw<MonthRow[]>(Prisma.sql`
      SELECT YEAR(e.transactionDate)  AS yr,
             MONTH(e.transactionDate) AS mo,
             COALESCE(e.unitType, 'Unknown') AS unitType,
             COUNT(*) AS txnCount,
             AVG(e.transactionPsf) AS medianPsf
      FROM Entry e JOIN Project p ON e.projectId = p.id
      WHERE ${where}
        AND e.transactionDate >= DATE_SUB(CURDATE(), INTERVAL 24 MONTH)
      GROUP BY YEAR(e.transactionDate), MONTH(e.transactionDate), e.unitType
      ORDER BY YEAR(e.transactionDate), MONTH(e.transactionDate)
    `);

    // 5. Property type × bedroom breakdown
    // Use explicit CASE expression in GROUP BY to avoid alias ambiguity
    interface TypeBrRow { propertyType: string; bedrooms: number | null; txnCount: bigint; medianPsf: unknown; }
    const byTypeBedroom = await prisma.$queryRaw<TypeBrRow[]>(Prisma.sql`
      SELECT e.propertyType,
             CASE WHEN e.bedrooms >= 5 THEN 5 ELSE e.bedrooms END AS bedrooms,
             COUNT(*) AS txnCount,
             AVG(e.transactionPsf) AS medianPsf
      FROM Entry e JOIN Project p ON e.projectId = p.id
      WHERE ${where} AND e.bedrooms IS NOT NULL
      GROUP BY e.propertyType, CASE WHEN e.bedrooms >= 5 THEN 5 ELSE e.bedrooms END
      ORDER BY e.propertyType, CASE WHEN e.bedrooms >= 5 THEN 5 ELSE e.bedrooms END
    `);

    // Safely convert unknown Prisma Decimal / bigint values to plain JS numbers
    const toNum  = (v: unknown): number => (v == null ? 0 : Math.round(Number(v)));
    const toNumF = (v: unknown): number => (v == null ? 0 : Number(v));

    return NextResponse.json({
      data: {
        byType:        byType.map((r) => ({
          propertyType: String(r.propertyType),
          txnCount:     Number(r.txnCount),
          medianPsf:    toNum(r.medianPsf),
          totalValue:   toNumF(r.totalValue),
        })),
        byUnitType:    byUnitType.map((r) => ({
          unitType:  r.unitType ?? "Unknown",
          txnCount:  Number(r.txnCount),
          medianPsf: toNum(r.medianPsf),
        })),
        byCategory:    byCategory.map((r) => ({
          category:  String(r.category),
          txnCount:  Number(r.txnCount),
          medianPsf: toNum(r.medianPsf),
        })),
        monthly:       monthly.map((r) => ({
          yr:        Number(r.yr),
          mo:        Number(r.mo),
          unitType:  r.unitType ?? "Unknown",
          txnCount:  Number(r.txnCount),
          medianPsf: toNum(r.medianPsf),
        })),
        byTypeBedroom: byTypeBedroom.map((r) => ({
          propertyType: String(r.propertyType),
          bedrooms:     r.bedrooms == null ? null : Number(r.bedrooms),
          txnCount:     Number(r.txnCount),
          medianPsf:    toNum(r.medianPsf),
        })),
      },
    });
  } catch (e) {
    console.error("[property-mix] error:", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : String(e) } },
      { status: 500 }
    );
  }
}
