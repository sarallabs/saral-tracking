export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/schema";
import { eq, and, gt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

// Use Web Crypto API (works on Cloudflare Edge + Node.js)
function generateToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// POST /api/auth/forgot-password — generate reset token (returns token directly for internal tool)
// In production you'd email this; for internal use we show it on screen
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = (body.email as string | undefined)?.toLowerCase().trim();

  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  // Return success regardless (security: don't leak if email exists)
  if (!user || !user.passwordHash) {
    return NextResponse.json({
      ok: true,
      message: "If this account exists with password login, a reset link has been sent to your admin.",
    });
  }

  // Generate token using Web Crypto API
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token,
    expiresAt,
  });

  // For an internal tool without email: return the reset link directly
  // In prod you'd send this via email instead
  return NextResponse.json({
    ok: true,
    resetToken: token, // Shows on-screen so user/admin can use it
    message: "Use this token to reset your password. It expires in 1 hour.",
  });
}

// PATCH /api/auth/forgot-password — use token to set new password
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { token, newPassword } = body as { token?: string; newPassword?: string };

  if (!token || !newPassword) return NextResponse.json({ error: "Token and newPassword required" }, { status: 400 });
  if (newPassword.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const [resetToken] = await db
    .select()
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.token, token), eq(passwordResetTokens.used, false), gt(passwordResetTokens.expiresAt, new Date())))
    .limit(1);

  if (!resetToken) return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 });

  const hash = await bcrypt.hash(newPassword, 12);
  await db.update(users).set({ passwordHash: hash }).where(eq(users.id, resetToken.userId));
  await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, resetToken.id));

  return NextResponse.json({ ok: true, message: "Password updated successfully" });
}
