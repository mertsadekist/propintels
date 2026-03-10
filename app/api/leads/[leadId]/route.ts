import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { leadsRepo } from "@/db/repositories/leads.repo";

export async function GET(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const { session, error } = await withAuth(["ADMIN", "MANAGER", "AGENT"]);
  if (error) return error;

  const lead = await leadsRepo.findById(params.leadId);
  if (!lead) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Lead not found" } },
      { status: 404 }
    );
  }

  const isAgentOnly =
    session.user.roles.includes("AGENT") &&
    !session.user.roles.includes("ADMIN") &&
    !session.user.roles.includes("MANAGER");

  if (isAgentOnly && lead.assignedAgentId !== session.user.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Access denied" } },
      { status: 403 }
    );
  }

  return NextResponse.json({ data: lead });
}
