import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const upsertSchema = z.object({
  estimatedPrice: z.number().positive("Estimated price must be positive"),
  notes: z.string().min(1, "Notes are required").max(2000),
});

// GET: fetch specialist assessment for a lead
export async function GET(
  _request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const { error } = await withAuth(["ADMIN", "MANAGER", "AGENT"]);
  if (error) return error;

  try {
    const assessment = await prisma.specialistAssessment.findUnique({
      where: { leadId: params.leadId },
      include: {
        specialist: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ data: assessment });
  } catch (err) {
    console.error("[specialist-assessment GET] Error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch assessment" } },
      { status: 500 }
    );
  }
}

// POST: create or update specialist assessment
export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const { session, error } = await withAuth(["ADMIN", "MANAGER", "AGENT"]);
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { estimatedPrice, notes } = parsed.data;

    // Verify lead exists and get area for PSF calculation
    const lead = await prisma.lead.findUnique({
      where: { id: params.leadId },
      select: { id: true, areaSqft: true },
    });

    if (!lead) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Lead not found" } },
        { status: 404 }
      );
    }

    const areaSqft = Number(lead.areaSqft);
    const estimatedPsf = areaSqft > 0 ? estimatedPrice / areaSqft : 0;

    const assessment = await prisma.specialistAssessment.upsert({
      where: { leadId: params.leadId },
      create: {
        leadId: params.leadId,
        specialistId: session.user.id,
        estimatedPrice,
        estimatedPsf,
        notes,
      },
      update: {
        specialistId: session.user.id,
        estimatedPrice,
        estimatedPsf,
        notes,
      },
      include: {
        specialist: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ data: assessment }, { status: 200 });
  } catch (err) {
    console.error("[specialist-assessment POST] Error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to save assessment" } },
      { status: 500 }
    );
  }
}

// DELETE: remove specialist assessment
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const { error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  try {
    await prisma.specialistAssessment.delete({
      where: { leadId: params.leadId },
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("[specialist-assessment DELETE] Error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete assessment" } },
      { status: 500 }
    );
  }
}
