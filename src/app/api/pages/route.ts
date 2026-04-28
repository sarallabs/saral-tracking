export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pages, memberships, pageVersions, spaces, spaceMembers } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

async function checkSpaceAccess(spaceId: string, userId: string): Promise<boolean> {
  const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return false;
  if (!space.isPrivate) return true;

  const [membership] = await db
    .select()
    .from(spaceMembers)
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, userId)))
    .limit(1);

  return !!membership;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, session.user.id))
    .limit(1);

  if (!membership[0]) return NextResponse.json({ pages: [] });
  const workspaceId = membership[0].workspaceId;

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const spaceId = url.searchParams.get("spaceId");

  const allPages = await db
    .select()
    .from(pages)
    .where(eq(pages.workspaceId, workspaceId))
    .orderBy(desc(pages.createdAt));

  let filtered = allPages;
  if (projectId) filtered = filtered.filter((p) => p.projectId === projectId);
  if (spaceId) filtered = filtered.filter((p) => p.spaceId === spaceId);

  // Filter out space-private pages user can't see
  const accessiblePages = await Promise.all(
    filtered.map(async (p) => {
      if (p.spaceId) {
        const canAccess = await checkSpaceAccess(p.spaceId, session.user!.id!);
        if (!canAccess) return null;
      }
      return p;
    })
  );

  return NextResponse.json({ pages: accessiblePages.filter(Boolean) });
}

const createSchema = z.object({
  title: z.string().min(1).max(255),
  parentId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  spaceId: z.string().uuid().optional().nullable(),
  emoji: z.string().optional(),
  isBlogPost: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, session.user.id))
    .limit(1);

  if (!membership[0]) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Calculate depth from parent
  let depth = 0;
  if (parsed.data.parentId) {
    const [parent] = await db
      .select({ depth: pages.depth })
      .from(pages)
      .where(eq(pages.id, parsed.data.parentId))
      .limit(1);

    if (parent) {
      depth = (parent.depth ?? 0) + 1;
      if (depth > 2) {
        return NextResponse.json(
          { error: "Maximum page hierarchy depth (3 levels) reached" },
          { status: 400 }
        );
      }
    }
  }

  // Check space access if spaceId given
  if (parsed.data.spaceId) {
    const canAccess = await checkSpaceAccess(parsed.data.spaceId, session.user.id);
    if (!canAccess) return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const [page] = await db
    .insert(pages)
    .values({
      ...parsed.data,
      depth,
      workspaceId: membership[0].workspaceId,
      authorId: session.user.id,
      content: `<h1>${parsed.data.title}</h1><p></p>`,
      status: "draft",
    })
    .returning();

  await db.insert(pageVersions).values({
    pageId: page.id,
    content: page.content || "",
    authorId: session.user.id,
    versionNumber: 1,
  });

  return NextResponse.json({ page }, { status: 201 });
}
