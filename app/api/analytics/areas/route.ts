import { NextResponse } from "next/server";
import { withAuth } from "@/auth/session";
import { prisma } from "@/db/prisma";

export async function GET() {
  const { error } = await withAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const projects = await prisma.project.findMany({
    where: { location: { not: null } },
    select: { location: true },
    distinct: ["location"],
    orderBy: { location: "asc" },
  });

  const areas = projects
    .map((p) => p.location)
    .filter((l): l is string => l !== null && l.trim() !== "")
    .sort();

  return NextResponse.json({ data: areas });
}
