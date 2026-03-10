import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { leadsRepo } from "@/db/repositories/leads.repo";

export async function GET(request: NextRequest) {
  const { session, error } = await withAuth(["ADMIN", "MANAGER", "AGENT"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);

  const isAgentOnly =
    session.user.roles.includes("AGENT") &&
    !session.user.roles.includes("ADMIN") &&
    !session.user.roles.includes("MANAGER");

  const options = {
    status: searchParams.get("status") ?? undefined,
    verdict: searchParams.get("verdict") ?? undefined,
    projectId: searchParams.get("projectId") ?? undefined,
    assignedAgentId: isAgentOnly
      ? session.user.id
      : (searchParams.get("assignedAgentId") ?? undefined),
    search: searchParams.get("search") ?? undefined,
    page: parseInt(searchParams.get("page") ?? "1"),
    pageSize: Math.min(parseInt(searchParams.get("pageSize") ?? "20"), 100),
    dateFrom: searchParams.get("dateFrom") ? new Date(searchParams.get("dateFrom")!) : undefined,
    dateTo: searchParams.get("dateTo") ? new Date(searchParams.get("dateTo")!) : undefined,
  };

  const result = await leadsRepo.list(options);

  return NextResponse.json({
    data: result.leads,
    meta: { total: result.total, page: result.page, pageSize: result.pageSize },
  });
}
