import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/prisma";
import { hashToken } from "@/lib/token";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "@/lib/ratelimit";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100),
});

export async function POST(request: NextRequest) {
  // Rate limit: 10 attempts per hour per IP
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = await checkRateLimit(`reset-password:${ip}`, 10, 3600);
  if (!rl.success) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again later." } },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid request.", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);

  // Find the token record
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!resetToken) {
    return NextResponse.json(
      { error: { code: "TOKEN_INVALID", message: "Invalid or expired reset link. Please request a new one." } },
      { status: 400 }
    );
  }

  if (resetToken.usedAt) {
    return NextResponse.json(
      { error: { code: "TOKEN_INVALID", message: "This reset link has already been used. Please request a new one." } },
      { status: 400 }
    );
  }

  if (resetToken.expiresAt < new Date()) {
    return NextResponse.json(
      { error: { code: "TOKEN_EXPIRED", message: "This reset link has expired. Please request a new one." } },
      { status: 400 }
    );
  }

  if (!resetToken.user || resetToken.user.status !== "ACTIVE") {
    return NextResponse.json(
      { error: { code: "TOKEN_INVALID", message: "Invalid or expired reset link." } },
      { status: 400 }
    );
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(password, 12);

  // Update user password and mark token as used (atomic transaction)
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ data: { message: "Password reset successfully." } });
}
