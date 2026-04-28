export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pageComments } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string; commentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { commentId } = await params;

  const body = await req.json();
  const schema = z.object({
    content: z.string().min(1).optional(),
    isResolved: z.boolean().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Only author can edit content; anyone can resolve
  const [comment] = await db.select().from(pageComments).where(eq(pageComments.id, commentId)).limit(1);
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.content && comment.authorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [updated] = await db
    .update(pageComments)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(pageComments.id, commentId))
    .returning();

  return NextResponse.json({ comment: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ pageId: string; commentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { commentId } = await params;

  const [comment] = await db.select().from(pageComments).where(eq(pageComments.id, commentId)).limit(1);
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (comment.authorId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(pageComments).where(eq(pageComments.id, commentId));
  return NextResponse.json({ ok: true });
}
