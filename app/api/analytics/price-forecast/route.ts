import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";
import { Prisma } from "@prisma/client";

const PSM_FACTOR = 10.7639;

// ─── Linear Regression ────────────────────────────────────────────────────────
function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return null;
  const sumX  = points.reduce((s, p) => s + p.x, 0);
  const sumY  = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const yMean = sumY / n;
  const ssTot = points.reduce((s, p) => s + (p.y - yMean) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.y - (intercept + slope * p.x)) ** 2, 0);
  const r2    = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  const stdDev = Math.sqrt(ssRes / Math.max(n - 2, 1));
  return { slope, intercept, r2, stdDev };
}

function qtrLabel(yr: number, qtr: number) { return `Q${qtr} ${yr}`; }
function nextQtr(yr: number, qtr: number): { yr: number; qtr: number } {
  return qtr === 4 ? { yr: yr + 1, qtr: 1 } : { yr, qtr: qtr + 1 };
}

// ─── GET /api/analytics/price-forecast ────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  try {
    const sp           = req.nextUrl.searchParams;
    const mode         = sp.get("mode") || "area"; // "area" | "project"
    const target       = sp.get("target") || "";
    const dateFrom     = sp.get("dateFrom") ? new Date(sp.get("dateFrom")!) : null;
    const dateTo       = sp.get("dateTo")   ? new Date(sp.get("dateTo")!)   : null;
    const propTypesStr = sp.get("propertyTypes") || "";
    const bedroomsStr  = sp.get("bedrooms")      || "";
    const unitType     = sp.get("unitType")      || "";
    const category     = sp.get("category")      || "";

    const propTypes = propTypesStr ? propTypesStr.split(",").filter(Boolean) : [];
    const bedrooms  = bedroomsStr  ? bedroomsStr.split(",").filter(Boolean)  : [];

    // ── Build WHERE ──────────────────────────────────────────────────────────
    const cond: Prisma.Sql[] = [
      Prisma.sql`e.sourceType = 'TRANSACTION'`,
      Prisma.sql`e.isActive = 1`,
      Prisma.sql`e.transactionDate IS NOT NULL`,
      Prisma.sql`e.transactionPsf IS NOT NULL`,
      Prisma.sql`e.transactionPsf > 0`,
    ];

    if (dateFrom) cond.push(Prisma.sql`e.transactionDate >= ${dateFrom}`);
    if (dateTo)   cond.push(Prisma.sql`e.transactionDate <= ${dateTo}`);
    if (unitType === "ready")   cond.push(Prisma.sql`e.unitType = 'Existing'`);
    if (unitType === "offplan") cond.push(Prisma.sql`e.unitType = 'Off-Plan'`);
    if (category) cond.push(Prisma.sql`e.category = ${category}`);

    if (mode === "area" && target) {
      cond.push(Prisma.sql`p.location = ${target}`);
    } else if (mode === "project" && target) {
      cond.push(Prisma.sql`p.name = ${target}`);
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

    // ── Quarterly median PSF query ───────────────────────────────────────────
    interface QtrRow {
      yr: unknown; qtr: unknown; medianPsf: unknown; txCount: bigint;
    }
    const rows = await prisma.$queryRaw<QtrRow[]>(Prisma.sql`
      WITH ranked AS (
        SELECT
          YEAR(e.transactionDate)    AS yr,
          QUARTER(e.transactionDate) AS qtr,
          e.transactionPsf,
          ROW_NUMBER() OVER (
            PARTITION BY YEAR(e.transactionDate), QUARTER(e.transactionDate)
            ORDER BY e.transactionPsf
          ) AS rn,
          COUNT(*) OVER (
            PARTITION BY YEAR(e.transactionDate), QUARTER(e.transactionDate)
          ) AS total
        FROM Entry e
        JOIN Project p ON e.projectId = p.id
        WHERE ${where}
      )
      SELECT yr, qtr,
             AVG(transactionPsf) AS medianPsf,
             MAX(total)          AS txCount
      FROM ranked
      WHERE rn IN (FLOOR((total+1)/2), CEIL((total+1)/2))
      GROUP BY yr, qtr
      ORDER BY yr, qtr
    `);

    const toNum = (v: unknown) => (v == null ? 0 : Number(v));

    // ── Build historical points ──────────────────────────────────────────────
    const historical = rows.map((r, i) => {
      const psf = toNum(r.medianPsf);
      const prevPsf = i > 0 ? toNum(rows[i - 1].medianPsf) : null;
      const changePct = prevPsf && prevPsf > 0 ? ((psf - prevPsf) / prevPsf) * 100 : null;
      return {
        label:         qtrLabel(Number(r.yr), Number(r.qtr)),
        yr:            Number(r.yr),
        qtr:           Number(r.qtr),
        medianPsf:     psf,
        medianPsm:     psf * PSM_FACTOR,
        txCount:       Number(r.txCount),
        changeVsPrev:  changePct,
      };
    });

    // ── Regression + forecast ────────────────────────────────────────────────
    const regressionInput = historical.map((h, i) => ({ x: i, y: h.medianPsf }));
    const reg = linearRegression(regressionInput);

    let forecast: {
      label: string; yr: number; qtr: number;
      medianPsf: number; medianPsm: number;
      low: number; high: number; isForecast: true;
    }[] = [];

    if (reg && historical.length >= 2) {
      const lastRow = historical[historical.length - 1];
      let cur = { yr: lastRow.yr, qtr: lastRow.qtr };

      for (let i = 0; i < 2; i++) {
        cur = nextQtr(cur.yr, cur.qtr);
        const xNext = historical.length + i;
        const predicted = reg.intercept + reg.slope * xNext;
        const psf = Math.max(0, predicted);
        forecast.push({
          label:     `${qtrLabel(cur.yr, cur.qtr)} (forecast)`,
          yr:        cur.yr,
          qtr:       cur.qtr,
          medianPsf: psf,
          medianPsm: psf * PSM_FACTOR,
          low:       Math.max(0, psf - reg.stdDev),
          high:      psf + reg.stdDev,
          isForecast: true,
        });
      }
    }

    const trend: "UP" | "DOWN" | "FLAT" =
      !reg ? "FLAT" : reg.slope > 1 ? "UP" : reg.slope < -1 ? "DOWN" : "FLAT";

    const totalTransactions = historical.reduce((s, h) => s + h.txCount, 0);

    // ── Distinct targets list (for search dropdown) ───────────────────────────
    let targets: string[] = [];
    if (!target) {
      if (mode === "area") {
        interface LocRow { location: string }
        const locs = await prisma.$queryRaw<LocRow[]>(Prisma.sql`
          SELECT DISTINCT p.location
          FROM Project p
          WHERE p.location IS NOT NULL AND p.isActive = 1
          ORDER BY p.location
        `);
        targets = locs.map((r) => r.location).filter(Boolean);
      } else {
        interface NameRow { name: string }
        const names = await prisma.$queryRaw<NameRow[]>(Prisma.sql`
          SELECT DISTINCT p.name
          FROM Project p
          WHERE p.name IS NOT NULL AND p.isActive = 1
          ORDER BY p.name
        `);
        targets = names.map((r) => r.name).filter(Boolean);
      }
    }

    return NextResponse.json({
      historical,
      forecast,
      regression: reg
        ? { slope: reg.slope, r2: reg.r2, trend }
        : { slope: 0, r2: 0, trend: "FLAT" as const },
      target,
      mode,
      totalTransactions,
      targets,
    });
  } catch (e) {
    console.error("[price-forecast] error:", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : String(e) } },
      { status: 500 }
    );
  }
}
