export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pages, pageVersions, spaceMembers, spaces } from "@/lib/schema";
import { eq, desc, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

async function checkPageAccess(pageId: string, userId: string): Promise<{ page: typeof pages.$inferSelect | null; canEdit: boolean }> {
  const [page] = await db.select().from(pages).where(eq(pages.id, pageId)).limit(1);
  if (!page) return { page: null, canEdit: false };

  // Check space access
  if (page.spaceId) {
    const [space] = await db.select().from(spaces).where(eq(spaces.id, page.spaceId)).limit(1);
    if (space?.isPrivate) {
      const [membership] = await db
        .select()
        .from(spaceMembers)
        .where(and(eq(spaceMembers.spaceId, page.spaceId), eq(spaceMembers.userId, userId)))
        .limit(1);
      if (!membership) return { page: null, canEdit: false };
      const canEdit = ["admin", "editor"].includes(membership.role);
      return { page, canEdit };
    }
  }

  return { page, canEdit: true };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  const { page } = await checkPageAccess(pageId, session.user.id);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get breadcrumb ancestors
  const breadcrumb: Array<{ id: string; title: string; emoji: string | null }> = [];
  let currentPage = page;
  while (currentPage.parentId) {
    const [parent] = await db
      .select({ id: pages.id, title: pages.title, emoji: pages.emoji, parentId: pages.parentId })
      .from(pages)
      .where(eq(pages.id, currentPage.parentId))
      .limit(1);
    if (!parent) break;
    breadcrumb.unshift({ id: parent.id, title: parent.title, emoji: parent.emoji });
    currentPage = parent as typeof pages.$inferSelect;
  }

  // Get space info if present
  let spaceInfo = null;
  if (page.spaceId) {
    const [space] = await db.select({ id: spaces.id, name: spaces.name, icon: spaces.icon, color: spaces.color }).from(spaces).where(eq(spaces.id, page.spaceId)).limit(1);
    spaceInfo = space ?? null;
  }

  return NextResponse.json({ page, breadcrumb, space: spaceInfo });
}

const patchSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
  draftContent: z.string().optional(),
  parentId: z.string().uuid().optional().nullable(),
  emoji: z.string().optional(),
  saveVersion: z.boolean().optional(),
  status: z.enum(["draft", "published"]).optional(),
  accessLevel: z.enum(["workspace", "space", "restricted"]).optional(),
  isBlogPost: z.boolean().optional(),
  coverImage: z.string().optional().nullable(),
  spaceId: z.string().uuid().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  const { page, canEdit } = await checkPageAccess(pageId, session.user.id);

  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEdit) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Validate depth if parentId is changing
  if (parsed.data.parentId) {
    const [parent] = await db
      .select({ depth: pages.depth })
      .from(pages)
      .where(eq(pages.id, parsed.data.parentId))
      .limit(1);
    if (parent && (parent.depth ?? 0) + 1 > 2) {
      return NextResponse.json({ error: "Maximum hierarchy depth reached" }, { status: 400 });
    }
  }

  const { saveVersion, ...updateData } = parsed.data;

  // If publishing, also update isPublished for backward compat
  const extraFields: Record<string, unknown> = {};
  if (parsed.data.status === "published") {
    extraFields.isPublished = true;
    // On publish, copy draftContent → content if draftContent is provided
    if (parsed.data.draftContent) {
      extraFields.content = parsed.data.draftContent;
      extraFields.draftContent = null;
    }
  }

  const [updatedPage] = await db
    .update(pages)
    .set({ ...updateData, ...extraFields, updatedAt: new Date() })
    .where(eq(pages.id, pageId))
    .returning();

  if (!updatedPage) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (saveVersion && (parsed.data.content !== undefined || extraFields.content)) {
    const contentToSave = (extraFields.content as string) ?? parsed.data.content ?? "";
    const latest = await db
      .select()
      .from(pageVersions)
      .where(eq(pageVersions.pageId, pageId))
      .orderBy(desc(pageVersions.versionNumber))
      .limit(1);
    const nextVer = latest[0] ? latest[0].versionNumber + 1 : 1;
    await db.insert(pageVersions).values({
      pageId,
      content: contentToSave,
      authorId: session.user.id,
      versionNumber: nextVer,
    });
  }

  return NextResponse.json({ page: updatedPage });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  await db.delete(pages).where(eq(pages.id, pageId));

  return NextResponse.json({ ok: true });
}
