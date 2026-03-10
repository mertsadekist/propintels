import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";
import { assignLeadSchema } from "@/validation/lead.schema";
import { logAudit } from "@/audit/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const { session, error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const body = await request.json();
  const parsed = assignLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const agent = await prisma.user.findUnique({
    where: { id: parsed.data.agentId, status: "ACTIVE" },
  });
  if (!agent) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Agent not found" } },
      { status: 404 }
    );
  }

  const lead = await prisma.lead.findUnique({ where: { id: params.leadId } });
  if (!lead) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Lead not found" } },
      { status: 404 }
    );
  }

  const updated = await prisma.lead.update({
    where: { id: params.leadId },
    data: { assignedAgentId: parsed.data.agentId },
  });

  await logAudit({
    actorId: session.user.id,
    action: "LEAD_ASSIGN",
    entityType: "Lead",
    entityId: params.leadId,
    before: { assignedAgentId: lead.assignedAgentId },
    after: { assignedAgentId: parsed.data.agentId },
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json({ data: updated });
}
