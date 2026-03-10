import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";
import { updateLeadStatusSchema } from "@/validation/lead.schema";
import { logAudit } from "@/audit/logger";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const { session, error } = await withAuth(["ADMIN", "MANAGER", "AGENT"]);
  if (error) return error;

  const lead = await prisma.lead.findUnique({ where: { id: params.leadId } });
  if (!lead) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Lead not found" } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = updateLeadStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const updated = await prisma.lead.update({
    where: { id: params.leadId },
    data: {
      status: parsed.data.status,
      notes: parsed.data.notes !== undefined ? parsed.data.notes : undefined,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "LEAD_STATUS_UPDATE",
    entityType: "Lead",
    entityId: params.leadId,
    before: { status: lead.status },
    after: { status: updated.status },
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json({ data: updated });
}
