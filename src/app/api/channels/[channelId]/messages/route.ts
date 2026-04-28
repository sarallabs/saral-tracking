export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { messages, messageReactions, users } from "@/lib/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Ably from "ably";

export async function GET(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { channelId } = await params;
  
  const allMessages = await db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      authorId: messages.authorId,
      content: messages.content,
      threadParentId: messages.threadParentId,
      isEdited: messages.isEdited,
      createdAt: messages.createdAt,
      updatedAt: messages.updatedAt,
      authorName: users.name,
      authorEmail: users.email,
      authorImage: users.image,
    })
    .from(messages)
    .leftJoin(users, eq(messages.authorId, users.id))
    .where(eq(messages.channelId, channelId))
    .orderBy(asc(messages.createdAt));

  const messageIds = allMessages.map(m => m.id);
  
  let allReactions: any[] = [];
  if (messageIds.length > 0) {
    allReactions = await db
      .select({
        id: messageReactions.id,
        messageId: messageReactions.messageId,
        userId: messageReactions.userId,
        emoji: messageReactions.emoji,
        userName: users.name,
      })
      .from(messageReactions)
      .leftJoin(users, eq(messageReactions.userId, users.id))
      .where(inArray(messageReactions.messageId, messageIds));
  }

  const combined = allMessages.map(msg => ({
    ...msg,
    reactions: allReactions.filter(r => r.messageId === msg.id),
    replyCount: allMessages.filter(m => m.threadParentId === msg.id).length
  }));

  return NextResponse.json({ messages: combined });
}

const createSchema = z.object({
  content: z.string().min(1).max(5000),
  threadParentId: z.string().uuid().optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { channelId } = await params;
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [message] = await db.insert(messages).values({
    ...parsed.data,
    channelId,
    authorId: session.user.id,
  }).returning();

  const [author] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

  const fullMessage = {
    ...message,
    authorName: author?.name ?? null,
    authorEmail: author?.email ?? null,
    authorImage: author?.image ?? null,
    reactions: [],
    replyCount: 0
  };

  if (process.env.ABLY_API_KEY) {
    const client = new Ably.Rest(process.env.ABLY_API_KEY);
    const channel = client.channels.get(`channel:${channelId}`);
    await channel.publish("message", fullMessage);
  }

  return NextResponse.json({ message: fullMessage }, { status: 201 });
}
