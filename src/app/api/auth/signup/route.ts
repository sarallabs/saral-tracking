export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { users, memberships, workspaces } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { isAutoApprovedEmail } from "@/lib/utils";

const signupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    const firstError = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return NextResponse.json({ error: firstError ?? "Invalid input" }, { status: 400 });
  }

  const { name, email, password } = parsed.data;

  // Check if email already registered
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  // Auto-approve internal domains, others go pending
  const status = isAutoApprovedEmail(email) ? "active" : "pending";
  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db.insert(users).values({
    email,
    name,
    passwordHash,
    status,
    emailVerified: status === "active" ? new Date() : null,
  }).returning();

  // Auto-assign to workspace for approved users
  if (status === "active") {
    const domain = email.split("@")[1] ?? "saralvidhya.com";
    const slug = domain.replace(/\./g, "-");
    const workspaceName = domain.includes("sarallabs") ? "Saral Labs" : "Saral Vidhya";

    let workspace = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
    if (workspace.length === 0) {
      const [ws] = await db.insert(workspaces).values({ name: workspaceName, slug }).returning();
      workspace = [ws];
    }

    const memberCount = await db.select({ id: memberships.id }).from(memberships).where(eq(memberships.workspaceId, workspace[0].id));
    await db.insert(memberships).values({
      userId: user.id,
      workspaceId: workspace[0].id,
      role: memberCount.length === 0 ? "owner" : "member",
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    status,
    message: status === "active"
      ? "Account created! You can now sign in."
      : "Account created! Your account is pending admin approval.",
  }, { status: 201 });
}
