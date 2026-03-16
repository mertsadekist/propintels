import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const link = await prisma.valuationLink.findUnique({
    where: { id: params.token },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          location: true,
          category: true,
          defaultType: true,
          currency: true,
        },
      },
    },
  });

  if (!link) {
    return NextResponse.json(
      { error: { code: "TOKEN_INVALID", message: "This link is invalid or has been removed." } },
      { status: 404 }
    );
  }

  if (link.status === "DISABLED") {
    return NextResponse.json(
      { error: { code: "TOKEN_INVALID", message: "This link has been disabled." } },
      { status: 410 }
    );
  }

  if (link.expiresAt && link.expiresAt < new Date()) {
    return NextResponse.json(
      { error: { code: "TOKEN_EXPIRED", message: "This link has expired." } },
      { status: 410 }
    );
  }

  if (link.maxUses && link.usedCount >= link.maxUses) {
    return NextResponse.json(
      { error: { code: "TOKEN_EXPIRED", message: "This link has reached its maximum usage limit." } },
      { status: 410 }
    );
  }

  return NextResponse.json({
    data: {
      project: link.project,
      link: {
        id: link.id,
        label: link.label,
        expiresAt: link.expiresAt,
        maxUses: link.maxUses,
        usedCount: link.usedCount,
      },
    },
  });
}
