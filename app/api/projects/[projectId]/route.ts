import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { projectsRepo } from "@/db/repositories/projects.repo";
import { updateProjectSchema } from "@/validation/project.schema";
import { logAudit } from "@/audit/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const { error } = await withAuth(["ADMIN", "MANAGER", "AGENT", "VIEWER"]);
  if (error) return error;

  const project = await projectsRepo.findById(params.projectId);
  if (!project) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: project });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const { session, error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const existing = await projectsRepo.findById(params.projectId);
  if (!existing) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const updated = await projectsRepo.update(params.projectId, parsed.data);

  await logAudit({
    actorId: session.user.id,
    action: "PROJECT_UPDATE",
    entityType: "Project",
    entityId: params.projectId,
    before: existing,
    after: updated,
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const { session, error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const existing = await projectsRepo.findById(params.projectId);
  if (!existing) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 }
    );
  }

  await projectsRepo.softDelete(params.projectId);

  await logAudit({
    actorId: session.user.id,
    action: "PROJECT_DELETE",
    entityType: "Project",
    entityId: params.projectId,
    before: existing,
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json({ message: "Project deactivated successfully" });
}
