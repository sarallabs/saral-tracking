export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pages, memberships, pageVersions } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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

  const query = db.select().from(pages).where(eq(pages.workspaceId, workspaceId)).orderBy(desc(pages.createdAt));
  const allPages = await query;

  const filtered = projectId ? allPages.filter(p => p.projectId === projectId) : allPages;

  return NextResponse.json({ pages: filtered });
}

const createSchema = z.object({
  title: z.string().min(1).max(255),
  parentId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  emoji: z.string().optional(),
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

  const [page] = await db.insert(pages).values({
    ...parsed.data,
    workspaceId: membership[0].workspaceId,
    authorId: session.user.id,
    content: `<h1>${parsed.data.title}</h1><p></p>`,
  }).returning();

  await db.insert(pageVersions).values({
    pageId: page.id,
    content: page.content || "",
    authorId: session.user.id,
    versionNumber: 1,
  });

  return NextResponse.json({ page }, { status: 201 });
}
