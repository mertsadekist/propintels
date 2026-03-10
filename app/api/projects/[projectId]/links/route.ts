import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";
import { createLinkSchema } from "@/validation/link.schema";
import { generateToken, hashToken } from "@/lib/token";
import { logAudit } from "@/audit/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const { session, error } = await withAuth(["ADMIN", "MANAGER", "AGENT"]);
  if (error) return error;

  const where: { projectId: string; agentId?: string } = { projectId: params.projectId };

  if (
    session.user.roles.includes("AGENT") &&
    !session.user.roles.includes("ADMIN") &&
    !session.user.roles.includes("MANAGER")
  ) {
    where.agentId = session.user.id;
  }

  const links = await prisma.valuationLink.findMany({
    where,
    include: {
      agent: { select: { id: true, name: true, email: true } },
      _count: { select: { leads: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: links });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const { session, error } = await withAuth(["ADMIN", "MANAGER", "AGENT"]);
  if (error) return error;

  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project || !project.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = createLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);

  const link = await prisma.valuationLink.create({
    data: {
      projectId: params.projectId,
      agentId: session.user.id,
      tokenHash,
      label: parsed.data.label ?? null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      maxUses: parsed.data.maxUses ?? null,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "LINK_CREATE",
    entityType: "ValuationLink",
    entityId: link.id,
    after: { id: link.id, projectId: link.projectId },
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const publicUrl = `${appUrl}/v/${rawToken}`;

  return NextResponse.json(
    {
      data: {
        ...link,
        token: rawToken,
        publicUrl,
      },
      message: "Save this token — it will not be shown again",
    },
    { status: 201 }
  );
}
