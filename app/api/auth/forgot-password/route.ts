import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/prisma";
import { generateToken, hashToken } from "@/lib/token";
import { sendMail } from "@/notifications/mail";
import { forgotPasswordEmail } from "@/notifications/templates/forgot-password";
import { checkRateLimit } from "@/lib/ratelimit";

const schema = z.object({
  email: z.string().email(),
});

const RESET_TOKEN_EXPIRES_HOURS = 2;

export async function POST(request: NextRequest) {
  // Rate limit: 5 requests per hour per IP
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = await checkRateLimit(`forgot-password:${ip}`, 5, 3600);
  if (!rl.success) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Always return 200 to prevent email enumeration
    return NextResponse.json({ data: { message: "If that email is registered, you will receive a reset link." } });
  }

  const { email } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  // Always respond the same way regardless of whether user exists
  if (!user || user.status !== "ACTIVE") {
    return NextResponse.json({ data: { message: "If that email is registered, you will receive a reset link." } });
  }

  // Invalidate existing tokens for this user
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  // Generate new token
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRES_HOURS * 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  // Build reset URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  // Send email
  const { subject, html, text } = forgotPasswordEmail({
    userName: user.name,
    resetUrl,
    expiresInHours: RESET_TOKEN_EXPIRES_HOURS,
  });

  try {
    await sendMail({ to: user.email, subject, html, text });
  } catch (err) {
    console.error("[ForgotPassword] Failed to send email:", err);
    // Don't expose mail errors to client
  }

  return NextResponse.json({ data: { message: "If that email is registered, you will receive a reset link." } });
}
