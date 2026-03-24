import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";
import { Prisma } from "@prisma/client";

// PSF → PSM conversion factor
const PSM_FACTOR = 10.7639;

interface RawTopRow {
  rowKey: string;
  total: bigint;
}

interface RawCell {
  rowKey: string;
  bedrooms: number | null;
  medianPsf: number;
  txnCount: bigint;
}

// ─── Build output helper ───────────────────────────────────────────────────
function buildOutput(top: RawTopRow[], cells: RawCell[], keys: string[]) {
  const bedroomSet = new Set<number>();
  const cellMap = new Map<string, Map<number, { psf: number; psm: number; count: number }>>();

  for (const c of cells) {
    if (!c.rowKey || c.bedrooms === null || c.bedrooms === undefined) continue;
    const br = Number(c.bedrooms);
    bedroomSet.add(br);
    if (!cellMap.has(c.rowKey)) cellMap.set(c.rowKey, new Map());
    const psf = Math.round(Number(c.medianPsf) * 100) / 100;
    cellMap.get(c.rowKey)!.set(br, {
      psf,
      psm: Math.round(psf * PSM_FACTOR * 100) / 100,
      count: Number(c.txnCount),
    });
  }

  const bedroomCols = Array.from(bedroomSet).sort((a, b) => a - b);

  const rows = keys
    .filter((k) => cellMap.has(k))
    .map((k) => ({
      name: k,
      total: Number(top.find((r) => r.rowKey === k)?.total ?? 0),
      cells: Object.fromEntries(
        bedroomCols.map((br) => [String(br), cellMap.get(k)?.get(br) ?? null])
      ),
    }));

  return { rows, bedroomCols };
}

// ─── GET /api/analytics/price-matrix ─────────────────────────────────────
export async function GET(req: NextRequest) {
  const { error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const sp = req.nextUrl.searchParams;
  const mode      = sp.get("mode") === "project" ? "project" : "area";
  const unitType  = sp.get("unitType") || "all";          // all | ready | offplan
  const dateFrom  = sp.get("dateFrom") ? new Date(sp.get("dateFrom")!) : null;
  const dateTo    = sp.get("dateTo")   ? new Date(sp.get("dateTo")!)   : null;
  const limit     = Math.min(parseInt(sp.get("limit") || "25"), 50);

  // New multi-value params (comma-separated)
  const areasStr      = sp.get("areas")         || "";
  const filterAreas   = areasStr ? areasStr.split(",").filter(Boolean) : [];
  const propTypesStr  = sp.get("propertyTypes") || sp.get("propertyType") || "";
  const filterPropTypes = propTypesStr ? propTypesStr.split(",").filter(Boolean) : [];
  const filterCategory = sp.get("category") || null;
  const priceMin   = sp.get("priceMin")    ? Number(sp.get("priceMin"))   : null;
  const priceMax   = sp.get("priceMax")    ? Number(sp.get("priceMax"))   : null;
  const sqftMin    = sp.get("areaSqftMin") ? Number(sp.get("areaSqftMin")): null;
  const sqftMax    = sp.get("areaSqftMax") ? Number(sp.get("areaSqftMax")): null;

  // ── Base conditions (apply to all modes) ──────────────────────────────
  const base: Prisma.Sql[] = [
    Prisma.sql`e.sourceType = 'TRANSACTION'`,
    Prisma.sql`e.transactionPsf > 0`,
    Prisma.sql`e.isActive = 1`,
    Prisma.sql`e.bedrooms IS NOT NULL`,
  ];

  if (unitType === "ready")   base.push(Prisma.sql`e.unitType = 'Existing'`);
  if (unitType === "offplan") base.push(Prisma.sql`e.unitType = 'Off-Plan'`);
  if (dateFrom) base.push(Prisma.sql`e.transactionDate >= ${dateFrom}`);
  if (dateTo)   base.push(Prisma.sql`e.transactionDate <= ${dateTo}`);
  if (filterPropTypes.length === 1) {
    base.push(Prisma.sql`e.propertyType = ${filterPropTypes[0]}`);
  } else if (filterPropTypes.length > 1) {
    const inList = Prisma.join(filterPropTypes.map((t) => Prisma.sql`${t}`), ",");
    base.push(Prisma.sql`e.propertyType IN (${inList})`);
  }
  if (filterCategory) base.push(Prisma.sql`e.category = ${filterCategory}`);
  if (priceMin !== null) base.push(Prisma.sql`e.transactionPrice >= ${priceMin}`);
  if (priceMax !== null) base.push(Prisma.sql`e.transactionPrice <= ${priceMax}`);
  if (sqftMin  !== null) base.push(Prisma.sql`e.areaSqft >= ${sqftMin}`);
  if (sqftMax  !== null) base.push(Prisma.sql`e.areaSqft <= ${sqftMax}`);

  // ── Project mode ──────────────────────────────────────────────────────
  if (mode === "project") {
    const cond = [...base];
    if (filterAreas.length === 1) {
      cond.push(Prisma.sql`p.location = ${filterAreas[0]}`);
    } else if (filterAreas.length > 1) {
      const areaIn = Prisma.join(filterAreas.map((a) => Prisma.sql`${a}`), ",");
      cond.push(Prisma.sql`p.location IN (${areaIn})`);
    }
    const where = Prisma.join(cond, " AND ");

    const top = await prisma.$queryRaw<RawTopRow[]>(Prisma.sql`
      SELECT p.name AS rowKey, COUNT(*) AS total
      FROM Entry e JOIN Project p ON e.projectId = p.id
      WHERE ${where} AND p.name IS NOT NULL AND p.name != ''
      GROUP BY p.name
      ORDER BY total DESC
      LIMIT ${limit}
    `);

    const keys = top.map((r) => r.rowKey).filter(Boolean);
    if (!keys.length) return NextResponse.json({ data: { rows: [], bedroomCols: [] } });

    const inList = Prisma.join(keys.map((k) => Prisma.sql`${k}`), ",");

    const cells = await prisma.$queryRaw<RawCell[]>(Prisma.sql`
      WITH ranked AS (
        SELECT
          p.name AS rowKey,
          CASE WHEN e.bedrooms >= 5 THEN 5 ELSE e.bedrooms END AS bedrooms,
          e.transactionPsf,
          ROW_NUMBER() OVER (
            PARTITION BY p.name, CASE WHEN e.bedrooms >= 5 THEN 5 ELSE e.bedrooms END
            ORDER BY e.transactionPsf
          ) AS rn,
          COUNT(*) OVER (
            PARTITION BY p.name, CASE WHEN e.bedrooms >= 5 THEN 5 ELSE e.bedrooms END
          ) AS total
        FROM Entry e JOIN Project p ON e.projectId = p.id
        WHERE ${where} AND p.name IN (${inList})
      )
      SELECT rowKey, bedrooms,
             AVG(transactionPsf) AS medianPsf,
             MAX(total)          AS txnCount
      FROM ranked
      WHERE rn IN (FLOOR((total + 1) / 2), CEIL((total + 1) / 2))
      GROUP BY rowKey, bedrooms
      ORDER BY rowKey, bedrooms
    `);

    return NextResponse.json({ data: buildOutput(top, cells, keys) });
  }

  // ── Area mode ─────────────────────────────────────────────────────────
  if (filterAreas.length === 1) {
    base.push(Prisma.sql`p.location = ${filterAreas[0]}`);
  } else if (filterAreas.length > 1) {
    const areaIn = Prisma.join(filterAreas.map((a) => Prisma.sql`${a}`), ",");
    base.push(Prisma.sql`p.location IN (${areaIn})`);
  }
  const where = Prisma.join(base, " AND ");

  const top = await prisma.$queryRaw<RawTopRow[]>(Prisma.sql`
    SELECT p.location AS rowKey, COUNT(*) AS total
    FROM Entry e JOIN Project p ON e.projectId = p.id
    WHERE ${where}
      AND p.location IS NOT NULL
      AND p.location != ''
    GROUP BY p.location
    ORDER BY total DESC
    LIMIT ${limit}
  `);

  const keys = top.map((r) => r.rowKey).filter(Boolean);
  if (!keys.length) return NextResponse.json({ data: { rows: [], bedroomCols: [] } });

  const inList = Prisma.join(keys.map((k) => Prisma.sql`${k}`), ",");

  const cells = await prisma.$queryRaw<RawCell[]>(Prisma.sql`
    WITH ranked AS (
      SELECT
        p.location AS rowKey,
        CASE WHEN e.bedrooms >= 5 THEN 5 ELSE e.bedrooms END AS bedrooms,
        e.transactionPsf,
        ROW_NUMBER() OVER (
          PARTITION BY p.location, CASE WHEN e.bedrooms >= 5 THEN 5 ELSE e.bedrooms END
          ORDER BY e.transactionPsf
        ) AS rn,
        COUNT(*) OVER (
          PARTITION BY p.location, CASE WHEN e.bedrooms >= 5 THEN 5 ELSE e.bedrooms END
        ) AS total
      FROM Entry e JOIN Project p ON e.projectId = p.id
      WHERE ${where} AND p.location IN (${inList})
    )
    SELECT rowKey, bedrooms,
           AVG(transactionPsf) AS medianPsf,
           MAX(total)          AS txnCount
    FROM ranked
    WHERE rn IN (FLOOR((total + 1) / 2), CEIL((total + 1) / 2))
    GROUP BY rowKey, bedrooms
    ORDER BY rowKey, bedrooms
  `);

  return NextResponse.json({ data: buildOutput(top, cells, keys) });
}
