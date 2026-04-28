export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { messageReactions, messages } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ channelId: string; messageId: string }> };

// POST /api/channels/[channelId]/messages/[messageId]/react
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId } = await params;
  const { emoji } = await req.json();
  if (!emoji) return NextResponse.json({ error: "emoji required" }, { status: 400 });

  // Toggle: remove if exists, add if not
  const existing = await db
    .select()
    .from(messageReactions)
    .where(and(
      eq(messageReactions.messageId, messageId),
      eq(messageReactions.userId, session.user.id),
      eq(messageReactions.emoji, emoji)
    ))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(messageReactions).where(eq(messageReactions.id, existing[0].id));
    return NextResponse.json({ action: "removed" });
  } else {
    await db.insert(messageReactions).values({
      messageId,
      userId: session.user.id,
      emoji,
    });
    return NextResponse.json({ action: "added" });
  }
}

// PATCH /api/channels/[channelId]/messages/[messageId]/react — edit message
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId } = await params;
  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });

  const [updated] = await db
    .update(messages)
    .set({ content, isEdited: true, updatedAt: new Date() })
    .where(and(eq(messages.id, messageId), eq(messages.authorId, session.user.id)))
    .returning();

  return NextResponse.json({ message: updated });
}

// DELETE /api/channels/[channelId]/messages/[messageId]/react
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId } = await params;
  await db
    .delete(messages)
    .where(and(eq(messages.id, messageId), eq(messages.authorId, session.user.id)));

  return NextResponse.json({ ok: true });
}
