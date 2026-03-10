import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { entriesRepo } from "@/db/repositories/entries.repo";
import { createEntrySchema } from "@/validation/entry.schema";
import { logAudit } from "@/audit/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const { error } = await withAuth(["ADMIN", "MANAGER", "AGENT", "VIEWER"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const options = {
    sourceType: (searchParams.get("sourceType") as "LISTING" | "TRANSACTION") ?? undefined,
    propertyType: searchParams.get("propertyType") ?? undefined,
    bedrooms: searchParams.get("bedrooms") ? parseInt(searchParams.get("bedrooms")!) : undefined,
    isActive: searchParams.get("isActive") !== "false",
    page: parseInt(searchParams.get("page") ?? "1"),
    pageSize: Math.min(parseInt(searchParams.get("pageSize") ?? "50"), 200),
  };

  const result = await entriesRepo.list(params.projectId, options);

  return NextResponse.json({
    data: result.entries,
    meta: { total: result.total, page: result.page, pageSize: result.pageSize },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const { session, error } = await withAuth(["ADMIN", "MANAGER", "AGENT"]);
  if (error) return error;

  const body = await request.json();
  const parsed = createEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const entry = await entriesRepo.create(params.projectId, parsed.data);

  await logAudit({
    actorId: session.user.id,
    action: "ENTRY_CREATE",
    entityType: "Entry",
    entityId: entry.id,
    after: entry,
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json({ data: entry }, { status: 201 });
}
