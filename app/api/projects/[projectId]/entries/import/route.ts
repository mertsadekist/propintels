import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";
import { computePsf } from "@/valuation/engine";
import { logAudit } from "@/audit/logger";
import { z } from "zod";

const importRowSchema = z.object({
  sourceType: z.enum(["LISTING", "TRANSACTION"]),
  propertyType: z.enum([
    "APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "DUPLEX",
    "OFFICE", "RETAIL", "WAREHOUSE", "LAND", "OTHER",
  ]),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  areaSqft: z.number().positive().optional(),
  askPrice: z.number().positive().optional(),
  lowestPrice: z.number().positive().optional(),
  transactionAreaSqft: z.number().positive().optional(),
  transactionPrice: z.number().positive().optional(),
  transactionDate: z.string().optional(),
  portal: z.string().optional(),
  locationLabel: z.string().optional(),
  unitType: z.string().optional(),
  notes: z.string().optional(),
});

const importSchema = z.array(importRowSchema).min(1).max(500);

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const { session, error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const rows = parsed.data;

  const created = await prisma.$transaction(
    rows.map((row) => {
      const psf = computePsf(row);
      return prisma.entry.create({
        data: {
          projectId: params.projectId,
          sourceType: row.sourceType,
          propertyType: row.propertyType,
          bedrooms: row.bedrooms ?? null,
          bathrooms: row.bathrooms ?? null,
          areaSqft: row.areaSqft ?? null,
          askPrice: row.askPrice ?? null,
          lowestPrice: row.lowestPrice ?? null,
          transactionAreaSqft: row.transactionAreaSqft ?? null,
          transactionPrice: row.transactionPrice ?? null,
          transactionDate: row.transactionDate ? new Date(row.transactionDate) : null,
          portal: row.portal ?? null,
          locationLabel: row.locationLabel ?? null,
          unitType: row.unitType ?? null,
          notes: row.notes ?? null,
          askPsf: psf.askPsf,
          lowPsf: psf.lowPsf,
          transactionPsf: psf.transactionPsf,
        },
      });
    })
  );

  await logAudit({
    actorId: session.user.id,
    action: "ENTRY_BULK_IMPORT",
    entityType: "Entry",
    entityId: params.projectId,
    after: { count: created.length },
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json(
    { message: `${created.length} entries imported successfully`, count: created.length },
    { status: 201 }
  );
}
