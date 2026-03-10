import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { usersRepo } from "@/db/repositories/users.repo";
import { createUserSchema } from "@/validation/user.schema";
import { logAudit } from "@/audit/logger";
import { sendMail } from "@/notifications/mail";
import { welcomeEmail } from "@/notifications/templates/welcome";

export async function GET(request: NextRequest) {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const role = searchParams.get("role") ?? undefined;
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") ?? "20"), 100);

  const result = await usersRepo.list({ status, role, page, pageSize });

  return NextResponse.json({
    data: result.users,
    meta: { total: result.total, page, pageSize },
  });
}

export async function POST(request: NextRequest) {
  const { session, error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const user = await usersRepo.create(parsed.data);

  await logAudit({
    actorId: session.user.id,
    action: "USER_CREATE",
    entityType: "User",
    entityId: user?.id,
    after: { name: user?.name, email: user?.email },
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  // Send welcome email with temporary credentials (non-blocking)
  if (user) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXTAUTH_URL ??
      "http://localhost:3000";

    const { subject, html, text } = welcomeEmail({
      userName: user.name,
      userEmail: user.email,
      temporaryPassword: parsed.data.password,
      loginUrl: `${appUrl}/login`,
    });

    sendMail({ to: user.email, subject, html, text }).catch((err) => {
      console.error("[Team] Failed to send welcome email:", err);
    });
  }

  return NextResponse.json({ data: user }, { status: 201 });
}
