import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { settingsRepo } from "@/db/repositories/settings.repo";
import { logAudit } from "@/audit/logger";
import { z } from "zod";

const valuationRulesSchema = z.object({
  areaTolerancePct: z.number().int().min(5).max(50),
  outlierMethod: z.enum(["trim10", "iqr"]),
  minComps: z.number().int().min(1).max(20),
  benchmark: z.enum(["transactionMedianPsf", "listingMedianPsf"]),
  thresholds: z.object({
    below_market: z.number().min(0.5).max(1),
    aligned_max: z.number().min(0.9).max(1.2),
    slightly_above_max: z.number().min(1).max(2),
  }),
});

export async function GET(_request: NextRequest) {
  const { error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const rules = await settingsRepo.getValuationRules();
  return NextResponse.json({ data: rules });
}

export async function PUT(request: NextRequest) {
  const { session, error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const body = await request.json();
  const parsed = valuationRulesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const updated = await settingsRepo.updateValuationRules(parsed.data);

  await logAudit({
    actorId: session.user.id,
    action: "SETTINGS_UPDATE",
    entityType: "Setting",
    entityId: "valuation_rules",
    after: parsed.data,
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json({ data: updated.value });
}
