import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { projectsRepo, type ProjectSortBy } from "@/db/repositories/projects.repo";
import { createProjectSchema } from "@/validation/project.schema";
import { logAudit } from "@/audit/logger";

export async function GET(request: NextRequest) {
  const { session, error } = await withAuth(["ADMIN", "MANAGER", "AGENT", "VIEWER"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") ?? "20"), 100);
  const isActiveParam = searchParams.get("isActive");
  // "true" → active only, "false" → inactive only, absent/empty → all
  const isActive =
    isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;
  const category = searchParams.get("category") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const sortBy = (searchParams.get("sortBy") ?? undefined) as ProjectSortBy | undefined;

  const ownerId =
    session.user.roles.includes("AGENT") &&
    !session.user.roles.includes("ADMIN") &&
    !session.user.roles.includes("MANAGER")
      ? session.user.id
      : undefined;

  const result = await projectsRepo.list({ isActive, category, ownerId, search, sortBy, page, pageSize });

  return NextResponse.json({
    data: result.projects,
    meta: { total: result.total, page, pageSize },
  });
}

export async function POST(request: NextRequest) {
  const { session, error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const body = await request.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const project = await projectsRepo.create(parsed.data, session.user.id);

  await logAudit({
    actorId: session.user.id,
    action: "PROJECT_CREATE",
    entityType: "Project",
    entityId: project.id,
    after: project,
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json({ data: project }, { status: 201 });
}
