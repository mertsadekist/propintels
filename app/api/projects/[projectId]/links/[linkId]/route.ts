import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";
import { updateLinkSchema } from "@/validation/link.schema";
import { logAudit } from "@/audit/logger";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string; linkId: string } }
) {
  const { session, error } = await withAuth(["ADMIN", "MANAGER", "AGENT"]);
  if (error) return error;

  const link = await prisma.valuationLink.findUnique({ where: { id: params.linkId } });
  if (!link || link.projectId !== params.projectId) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Link not found" } },
      { status: 404 }
    );
  }

  if (
    session.user.roles.includes("AGENT") &&
    !session.user.roles.includes("ADMIN") &&
    !session.user.roles.includes("MANAGER") &&
    link.agentId !== session.user.id
  ) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You can only edit your own links" } },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = updateLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const updated = await prisma.valuationLink.update({
    where: { id: params.linkId },
    data: {
      label: parsed.data.label,
      status: parsed.data.status,
      expiresAt:
        parsed.data.expiresAt !== undefined
          ? parsed.data.expiresAt
            ? new Date(parsed.data.expiresAt)
            : null
          : undefined,
      maxUses: parsed.data.maxUses !== undefined ? parsed.data.maxUses : undefined,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "LINK_UPDATE",
    entityType: "ValuationLink",
    entityId: params.linkId,
    before: link,
    after: updated,
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; linkId: string } }
) {
  const { session, error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const link = await prisma.valuationLink.findUnique({ where: { id: params.linkId } });
  if (!link || link.projectId !== params.projectId) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Link not found" } },
      { status: 404 }
    );
  }

  await prisma.valuationLink.update({
    where: { id: params.linkId },
    data: { status: "DISABLED" },
  });

  await logAudit({
    actorId: session.user.id,
    action: "LINK_DISABLE",
    entityType: "ValuationLink",
    entityId: params.linkId,
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json({ message: "Link disabled" });
}
