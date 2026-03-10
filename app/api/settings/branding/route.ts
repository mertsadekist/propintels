import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { settingsRepo } from "@/db/repositories/settings.repo";
import { logAudit } from "@/audit/logger";
import { z } from "zod";

const brandingSchema = z.object({
  companyName: z.string().min(1).max(200),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  logoUrl: z.string().url().nullable().optional(),
  website: z.string().url().optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  disclaimer: z.string().max(2000).optional(),
});

export async function GET(_request: NextRequest) {
  const { error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const branding = await settingsRepo.getBranding();
  return NextResponse.json({ data: branding });
}

export async function PUT(request: NextRequest) {
  const { session, error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const body = await request.json();
  const parsed = brandingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const updated = await settingsRepo.updateBranding(parsed.data);

  await logAudit({
    actorId: session.user.id,
    action: "SETTINGS_UPDATE",
    entityType: "Setting",
    entityId: "branding",
    after: parsed.data,
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json({ data: updated.value });
}
