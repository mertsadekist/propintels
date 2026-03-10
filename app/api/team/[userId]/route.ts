import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { usersRepo } from "@/db/repositories/users.repo";
import { updateUserSchema } from "@/validation/user.schema";
import { logAudit } from "@/audit/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const user = await usersRepo.findById(params.userId);
  if (!user) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: user });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { session, error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const existing = await usersRepo.findById(params.userId);
  if (!existing) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const updated = await usersRepo.update(params.userId, parsed.data);

  await logAudit({
    actorId: session.user.id,
    action: "USER_UPDATE",
    entityType: "User",
    entityId: params.userId,
    before: { status: existing.status, name: existing.name },
    after: { status: updated?.status, name: updated?.name },
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json({ data: updated });
}
