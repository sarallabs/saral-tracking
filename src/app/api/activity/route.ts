export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { issues, messages, comments, users, memberships } from "@/lib/schema";
import { eq, desc, and } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET /api/activity — recent workspace activity feed
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [membership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, session.user.id))
    .limit(1);

  const events: Array<{
    id: string;
    type: string;
    title: string;
    subtitle?: string;
    actorName?: string | null;
    actorEmail?: string | null;
    actorImage?: string | null;
    entityId?: string;
    entityType?: string;
    createdAt: string;
  }> = [];

  const [recentIssues, recentMessages, recentComments] = await Promise.all([
    // Recent issues created
    db.select({
      id: issues.id,
      title: issues.title,
      status: issues.status,
      type: issues.type,
      createdAt: issues.createdAt,
      actorName: users.name,
      actorEmail: users.email,
      actorImage: users.image,
    })
    .from(issues)
    .leftJoin(users, eq(issues.reporterId, users.id))
    .orderBy(desc(issues.createdAt))
    .limit(15),

    // Recent messages
    db.select({
      id: messages.id,
      content: messages.content,
      channelId: messages.channelId,
      createdAt: messages.createdAt,
      actorName: users.name,
      actorEmail: users.email,
      actorImage: users.image,
    })
    .from(messages)
    .leftJoin(users, eq(messages.authorId, users.id))
    .orderBy(desc(messages.createdAt))
    .limit(10),

    // Recent comments
    db.select({
      id: comments.id,
      content: comments.content,
      entityType: comments.entityType,
      entityId: comments.entityId,
      createdAt: comments.createdAt,
      actorName: users.name,
      actorEmail: users.email,
      actorImage: users.image,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .orderBy(desc(comments.createdAt))
    .limit(10),
  ]);

  for (const i of recentIssues) {
    events.push({
      id: `issue-${i.id}`,
      type: "issue_created",
      title: `Created issue: ${i.title}`,
      subtitle: `${i.type} · ${i.status}`,
      actorName: i.actorName,
      actorEmail: i.actorEmail,
      actorImage: i.actorImage,
      entityId: i.id,
      entityType: "issue",
      createdAt: i.createdAt.toISOString(),
    });
  }

  for (const m of recentMessages) {
    events.push({
      id: `msg-${m.id}`,
      type: "message_sent",
      title: m.content.slice(0, 80) + (m.content.length > 80 ? "…" : ""),
      subtitle: "in a channel",
      actorName: m.actorName,
      actorEmail: m.actorEmail,
      actorImage: m.actorImage,
      entityId: m.id,
      entityType: "message",
      createdAt: m.createdAt.toISOString(),
    });
  }

  for (const c of recentComments) {
    events.push({
      id: `comment-${c.id}`,
      type: "comment_added",
      title: `Commented: ${c.content.slice(0, 60)}${c.content.length > 60 ? "…" : ""}`,
      actorName: c.actorName,
      actorEmail: c.actorEmail,
      actorImage: c.actorImage,
      entityId: c.entityId,
      entityType: c.entityType,
      createdAt: c.createdAt.toISOString(),
    });
  }

  // Sort all by createdAt desc
  events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ events: events.slice(0, 40) });
}
