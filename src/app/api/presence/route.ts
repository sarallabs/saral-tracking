export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userPresence, users, memberships } from "@/lib/schema";
import { eq, and, gt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// GET /api/presence — list online users in workspace
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [membership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, session.user.id))
    .limit(1);

  if (!membership) return NextResponse.json({ presence: [] });

  // Users seen in last 3 minutes = online
  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);

  const workspaceMembers = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.workspaceId, membership.workspaceId));

  const memberIds = workspaceMembers.map((m) => m.userId);

  const allPresence = await db
    .select({
      userId: userPresence.userId,
      status: userPresence.status,
      lastSeenAt: userPresence.lastSeenAt,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(userPresence)
    .leftJoin(users, eq(userPresence.userId, users.id));

  const result = allPresence
    .filter((p) => memberIds.includes(p.userId))
    .map((p) => ({
      ...p,
      isOnline: p.lastSeenAt > threeMinutesAgo,
    }));

  return NextResponse.json({ presence: result });
}

// PATCH /api/presence — update own presence
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status } = await req.json().catch(() => ({ status: "online" }));
  const newStatus = (status as string) ?? "online";

  const [existing] = await db.select().from(userPresence).where(eq(userPresence.userId, session.user.id)).limit(1);
  if (existing) {
    await db.update(userPresence).set({ status: newStatus, lastSeenAt: new Date() }).where(eq(userPresence.userId, session.user.id));
  } else {
    await db.insert(userPresence).values({ userId: session.user.id, status: newStatus, lastSeenAt: new Date() }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
