import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";

export async function GET(request: NextRequest) {
  const { error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const area = request.nextUrl.searchParams.get("area");
  if (!area) {
    return NextResponse.json({ data: [] });
  }

  const projects = await prisma.project.findMany({
    where: { location: area, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: projects });
}
