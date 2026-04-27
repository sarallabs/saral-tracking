export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pages, pageVersions } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  const [page] = await db.select().from(pages).where(eq(pages.id, pageId)).limit(1);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ page });
}

const patchSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
  parentId: z.string().uuid().optional().nullable(),
  emoji: z.string().optional(),
  saveVersion: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { saveVersion, ...updateData } = parsed.data;

  const [page] = await db.update(pages).set({
    ...updateData,
    updatedAt: new Date(),
  }).where(eq(pages.id, pageId)).returning();

  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (saveVersion && parsed.data.content !== undefined) {
    const latest = await db.select().from(pageVersions).where(eq(pageVersions.pageId, pageId)).orderBy(desc(pageVersions.versionNumber)).limit(1);
    const nextVer = latest[0] ? latest[0].versionNumber + 1 : 1;
    await db.insert(pageVersions).values({
      pageId,
      content: parsed.data.content,
      authorId: session.user.id,
      versionNumber: nextVer,
    });
  }

  return NextResponse.json({ page });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  await db.delete(pages).where(eq(pages.id, pageId));
  
  return NextResponse.json({ ok: true });
}
