export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// GET /api/notifications
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, session.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  const unreadCount = rows.filter((n) => !n.read).length;
  return NextResponse.json({ notifications: rows, unreadCount });
}

// PATCH /api/notifications — mark all read, or specific ids
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = body.ids ?? [];

  if (ids.length > 0) {
    for (const id of ids) {
      await db
        .update(notifications)
        .set({ read: true })
        .where(and(eq(notifications.id, id), eq(notifications.userId, session.user.id)));
    }
  } else {
    // Mark all read
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, session.user.id), eq(notifications.read, false)));
  }

  return NextResponse.json({ ok: true });
}
