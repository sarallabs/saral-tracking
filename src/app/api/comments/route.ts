export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { comments, users, notifications, issues, pages } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// GET /api/comments?entityType=issue&entityId=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType") as "issue" | "page" | "message" | null;
  const entityId = url.searchParams.get("entityId");

  if (!entityType || !entityId) return NextResponse.json({ error: "entityType and entityId required" }, { status: 400 });

  const rows = await db
    .select({
      id: comments.id,
      content: comments.content,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      authorId: comments.authorId,
      authorName: users.name,
      authorEmail: users.email,
      authorImage: users.image,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(and(eq(comments.entityType, entityType), eq(comments.entityId, entityId)))
    .orderBy(desc(comments.createdAt));

  return NextResponse.json({ comments: rows });
}

const createSchema = z.object({
  entityType: z.enum(["issue", "page", "message", "project", "channel"]),
  entityId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  parentId: z.string().uuid().optional().nullable(),
});

// POST /api/comments
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [comment] = await db.insert(comments).values({
    ...parsed.data,
    authorId: session.user.id,
  }).returning();

  // Notify issue reporter/assignee on comment
  if (parsed.data.entityType === "issue") {
    const [issue] = await db.select().from(issues).where(eq(issues.id, parsed.data.entityId)).limit(1);
    if (issue) {
      const notifyIds = new Set<string>();
      if (issue.reporterId && issue.reporterId !== session.user.id) notifyIds.add(issue.reporterId);
      if (issue.assigneeId && issue.assigneeId !== session.user.id) notifyIds.add(issue.assigneeId);

      for (const userId of notifyIds) {
        await db.insert(notifications).values({
          userId,
          type: "comment_added",
          entityType: "issue",
          entityId: parsed.data.entityId,
          title: "New comment on issue",
          body: parsed.data.content.slice(0, 100),
        });
      }
    }
  }

  return NextResponse.json({ comment }, { status: 201 });
}
