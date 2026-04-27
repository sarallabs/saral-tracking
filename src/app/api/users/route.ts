export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, memberships } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { ensureDefaultWorkspace } from "@/lib/auth";

// GET /api/users — list all users (admin only)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
  const filtered = status ? allUsers.filter((u) => u.status === status) : allUsers;
  // Strip password hashes from response
  return NextResponse.json({ users: filtered.map(({ passwordHash: _, ...u }) => u) });
}

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  isAdmin: z.boolean().default(false),
});

// POST /api/users — admin creates a user with password login
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(session.user as { isGlobalAdmin?: boolean }).isGlobalAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { email, name, password, isAdmin } = parsed.data;

  // Check if exists
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return NextResponse.json({ error: "User with this email already exists" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(users).values({
    email,
    name: name ?? null,
    passwordHash,
    status: "active",
    isGlobalAdmin: isAdmin,
    emailVerified: new Date(),
  }).returning();

  // Ensure workspace membership
  const [adminMembership] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  if (adminMembership) {
    await ensureDefaultWorkspace(user.id, name ?? email, email);
  }

  await logAudit({
    workspaceId: adminMembership?.workspaceId,
    actorId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    action: "user.create",
    entityType: "user",
    entityId: user.id,
    entityName: email,
  });

  const { passwordHash: _, ...safe } = user;
  return NextResponse.json({ user: safe }, { status: 201 });
}
