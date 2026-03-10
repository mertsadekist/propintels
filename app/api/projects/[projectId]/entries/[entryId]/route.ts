import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { entriesRepo } from "@/db/repositories/entries.repo";
import { updateEntrySchema } from "@/validation/entry.schema";
import { logAudit } from "@/audit/logger";
import { prisma } from "@/db/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: { projectId: string; entryId: string } }
) {
  const { session, error } = await withAuth(["ADMIN", "MANAGER", "AGENT"]);
  if (error) return error;

  const existing = await prisma.entry.findUnique({ where: { id: params.entryId } });
  if (!existing || existing.projectId !== params.projectId) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Entry not found" } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = updateEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const updated = await entriesRepo.update(params.entryId, parsed.data);

  await logAudit({
    actorId: session.user.id,
    action: "ENTRY_UPDATE",
    entityType: "Entry",
    entityId: params.entryId,
    before: existing,
    after: updated,
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; entryId: string } }
) {
  const { session, error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const existing = await prisma.entry.findUnique({ where: { id: params.entryId } });
  if (!existing || existing.projectId !== params.projectId) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Entry not found" } },
      { status: 404 }
    );
  }

  await entriesRepo.softDelete(params.entryId);

  await logAudit({
    actorId: session.user.id,
    action: "ENTRY_DELETE",
    entityType: "Entry",
    entityId: params.entryId,
    before: existing,
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json({ message: "Entry deleted" });
}
