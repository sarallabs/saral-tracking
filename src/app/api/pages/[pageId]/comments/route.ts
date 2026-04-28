export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pageComments, users } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;

  const comments = await db
    .select({
      id: pageComments.id,
      pageId: pageComments.pageId,
      content: pageComments.content,
      parentId: pageComments.parentId,
      anchorText: pageComments.anchorText,
      anchorId: pageComments.anchorId,
      isResolved: pageComments.isResolved,
      createdAt: pageComments.createdAt,
      updatedAt: pageComments.updatedAt,
      authorId: pageComments.authorId,
      authorName: users.name,
      authorEmail: users.email,
      authorImage: users.image,
    })
    .from(pageComments)
    .leftJoin(users, eq(pageComments.authorId, users.id))
    .where(eq(pageComments.pageId, pageId))
    .orderBy(desc(pageComments.createdAt));

  return NextResponse.json({ comments });
}

const createSchema = z.object({
  content: z.string().min(1),
  parentId: z.string().uuid().optional().nullable(),
  anchorText: z.string().optional().nullable(),
  anchorId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [comment] = await db
    .insert(pageComments)
    .values({
      ...parsed.data,
      pageId,
      authorId: session.user.id,
    })
    .returning();

  return NextResponse.json({ comment }, { status: 201 });
}
