import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";
import { logAudit } from "@/audit/logger";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

// ── Validation schema ─────────────────────────────────────────────────────────

const dldRowSchema = z.object({
  transactionId:    z.string(),
  transGroup:       z.string(),
  propertyTypeEn:   z.string(),
  propertySubTypeEn: z.string().nullable().optional(),
  propertyUsageEn:  z.string().nullable().optional(),
  regTypeEn:        z.string().nullable().optional(),
  areaNameEn:       z.string(),
  buildingNameEn:   z.string().nullable().optional(),
  projectNameEn:    z.string().nullable().optional(),
  roomsEn:          z.string().nullable().optional(),
  procedureAreaSqm: z.number().nullable().optional(),
  actualWorth:      z.number().nullable().optional(),
  transactionDate:  z.string().nullable().optional(),
});

const batchSchema = z.object({
  rows: z.array(dldRowSchema).min(1).max(500),
});

// ── Property type mapping ─────────────────────────────────────────────────────

const SUB_TYPE_MAP: Record<string, string> = {
  flat:              "APARTMENT",
  villa:             "VILLA",
  office:            "OFFICE",
  shop:              "RETAIL",
  "show rooms":      "RETAIL",
  warehouse:         "WAREHOUSE",
  "hotel apartment": "OTHER",
  "hotel rooms":     "OTHER",
  hotel:             "OTHER",
  building:          "OTHER",
  "sized partition": "OTHER",
  gymnasium:         "OTHER",
  clinic:            "OTHER",
};

function mapPropertyType(
  typeEn: string,
  subTypeEn?: string | null,
  roomsEn?: string | null
): string {
  const t = typeEn.toLowerCase();
  if (t === "land")     return "LAND";
  if (t === "villa")    return "VILLA";
  if (t === "building") return "OTHER";
  // Unit — check rooms override first
  if (roomsEn?.toUpperCase() === "PENTHOUSE") return "PENTHOUSE";
  if (subTypeEn) return SUB_TYPE_MAP[subTypeEn.toLowerCase()] ?? "APARTMENT";
  return "APARTMENT";
}

function mapBedrooms(roomsEn?: string | null): number | null {
  if (!roomsEn) return null;
  if (roomsEn.toLowerCase() === "studio") return 0;
  const m = roomsEn.match(/^(\d+)\s*b\/r$/i);
  return m ? parseInt(m[1]) : null;
}

function mapCategory(usageEn?: string | null): "RESIDENTIAL" | "COMMERCIAL" {
  return usageEn?.toLowerCase() === "residential" ? "RESIDENTIAL" : "COMMERCIAL";
}

function mapPortal(transGroup: string): string {
  if (transGroup === "Mortgages") return "DLD Mortgage";
  if (transGroup === "Gifts")     return "DLD Gift";
  return "DLD";
}

/** Convert square metres → square feet, rounded to 2 dp */
function sqmToSqft(sqm?: number | null): number | null {
  if (!sqm || sqm <= 0) return null;
  return Math.round(sqm * 10.7639 * 100) / 100;
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { session, error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const body = await request.json();
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const { rows } = parsed.data;

  // ── Project resolution ────────────────────────────────────────────────────
  // Each row's project key: project_name_en (if present) else area_name_en
  const projectKeyFor = (r: typeof rows[0]) =>
    (r.projectNameEn?.trim() || r.areaNameEn.trim());

  const uniqueKeys = Array.from(new Set(rows.map(projectKeyFor)));

  // Batch-lookup existing projects (case-insensitive)
  const existing = await prisma.project.findMany({
    where: { name: { in: uniqueKeys } },
    select: { id: true, name: true },
  });

  // name.toLowerCase() → id
  const projectMap = new Map<string, string>(
    existing.map((p) => [p.name.toLowerCase(), p.id])
  );

  // Build area fallback map (projectKey → areaNameEn)
  const areaForKey = new Map<string, string>();
  for (const r of rows) {
    const k = projectKeyFor(r);
    if (!areaForKey.has(k)) areaForKey.set(k, r.areaNameEn);
  }

  // Create projects that don't exist yet
  let projectsCreated = 0;
  const missing = uniqueKeys.filter((k) => !projectMap.has(k.toLowerCase()));

  for (const name of missing) {
    const proj = await prisma.project.create({
      data: {
        name,
        location: areaForKey.get(name) ?? "",
        ownerId:  session.user.id,
        isActive: true,
        currency: "AED",
      },
      select: { id: true },
    });
    projectMap.set(name.toLowerCase(), proj.id);
    projectsCreated++;
  }

  // ── Build entry payload ────────────────────────────────────────────────────
  const entries: Prisma.EntryCreateManyInput[] = [];
  let skipped = 0;

  for (const row of rows) {
    const projectId = projectMap.get(projectKeyFor(row).toLowerCase());
    if (!projectId) { skipped++; continue; }

    const areaSqft    = sqmToSqft(row.procedureAreaSqm);
    const price       = row.actualWorth && row.actualWorth > 0 ? row.actualWorth : null;
    const propertyType = mapPropertyType(
      row.propertyTypeEn, row.propertySubTypeEn, row.roomsEn
    ) as Parameters<typeof prisma.entry.create>[0]["data"]["propertyType"];
    const transactionPsf =
      areaSqft && price
        ? Math.round((price / areaSqft) * 1_000_000) / 1_000_000
        : null;

    let transactionDate: Date | null = null;
    if (row.transactionDate) {
      const d = new Date(row.transactionDate);
      if (!isNaN(d.getTime())) transactionDate = d;
    }

    const locationLabel = [row.buildingNameEn, row.areaNameEn]
      .filter(Boolean)
      .join(" — ");

    entries.push({
      projectId,
      sourceType:          "TRANSACTION",
      category:            mapCategory(row.propertyUsageEn),
      propertyType,
      bedrooms:            mapBedrooms(row.roomsEn),
      transactionAreaSqft: areaSqft,
      transactionPrice:    price,
      transactionDate,
      transactionPsf,
      portal:              mapPortal(row.transGroup),
      locationLabel:       locationLabel || row.areaNameEn,
      unitType:            row.regTypeEn ?? null,   // Off-Plan / Existing
      notes:               row.transactionId,        // DLD reference for dedup
      isActive:            true,
    });
  }

  // ── Bulk insert ────────────────────────────────────────────────────────────
  const result = await prisma.entry.createMany({ data: entries });

  await logAudit({
    actorId:    session.user.id,
    action:     "ENTRY_BULK_IMPORT",
    entityType: "Entry",
    entityId:   "dld-2025-import",
    after:      { count: result.count, projectsCreated, skipped, source: "DLD 2025" },
    ipAddress:  request.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json({ imported: result.count, projectsCreated, skipped });
}
