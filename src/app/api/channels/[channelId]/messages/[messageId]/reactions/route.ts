export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { messageReactions, users } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Ably from "ably";

const createSchema = z.object({
  emoji: z.string().min(1).max(10),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ channelId: string, messageId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { channelId, messageId } = await params;
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { emoji } = parsed.data;

  // Toggle logic: check if exists
  const existing = await db
    .select()
    .from(messageReactions)
    .where(and(
      eq(messageReactions.messageId, messageId),
      eq(messageReactions.userId, session.user.id),
      eq(messageReactions.emoji, emoji)
    ))
    .limit(1);

  let result;
  let action: "added" | "removed";

  if (existing[0]) {
    await db.delete(messageReactions).where(eq(messageReactions.id, existing[0].id));
    result = existing[0];
    action = "removed";
  } else {
    const [inserted] = await db.insert(messageReactions).values({
      messageId,
      userId: session.user.id,
      emoji,
    }).returning();
    result = inserted;
    action = "added";
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

  const reactionEvent = {
    id: result.id,
    messageId,
    userId: session.user.id,
    emoji,
    userName: user?.name ?? null,
    action,
  };

  if (process.env.ABLY_API_KEY) {
    const client = new Ably.Rest(process.env.ABLY_API_KEY);
    const channel = client.channels.get(`channel:${channelId}`);
    await channel.publish("reaction", reactionEvent);
  }

  return NextResponse.json({ reaction: reactionEvent }, { status: 200 });
}
