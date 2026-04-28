export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { spaces, spaceMembers, memberships, users } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, session.user.id))
    .limit(1);

  if (!membership[0]) return NextResponse.json({ spaces: [] });
  const workspaceId = membership[0].workspaceId;

  // Get all spaces with member count and user's membership
  const allSpaces = await db
    .select({
      id: spaces.id,
      name: spaces.name,
      slug: spaces.slug,
      description: spaces.description,
      icon: spaces.icon,
      color: spaces.color,
      isPrivate: spaces.isPrivate,
      categories: spaces.categories,
      tags: spaces.tags,
      homepageId: spaces.homepageId,
      createdBy: spaces.createdBy,
      createdAt: spaces.createdAt,
      updatedAt: spaces.updatedAt,
    })
    .from(spaces)
    .where(eq(spaces.workspaceId, workspaceId));

  // For each space, get member info
  const spacesWithMeta = await Promise.all(
    allSpaces.map(async (space) => {
      const members = await db
        .select({ userId: spaceMembers.userId, role: spaceMembers.role })
        .from(spaceMembers)
        .where(eq(spaceMembers.spaceId, space.id));

      const userMembership = members.find((m) => m.userId === session.user!.id);

      // Public spaces visible to all workspace members; private only to members
      if (space.isPrivate && !userMembership) return null;

      return {
        ...space,
        memberCount: members.length,
        userRole: userMembership?.role ?? null,
      };
    })
  );

  return NextResponse.json({ spaces: spacesWithMeta.filter(Boolean) });
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  isPrivate: z.boolean().optional(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
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

  // Only admin/owner can create spaces
  if (!["admin", "owner"].includes(membership[0].role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [space] = await db.insert(spaces).values({
    ...parsed.data,
    categories: JSON.stringify(parsed.data.categories ?? []),
    tags: JSON.stringify(parsed.data.tags ?? []),
    workspaceId: membership[0].workspaceId,
    createdBy: session.user.id,
  }).returning();

  // Creator becomes admin of the space
  await db.insert(spaceMembers).values({
    spaceId: space.id,
    userId: session.user.id,
    role: "admin",
  });

  return NextResponse.json({ space }, { status: 201 });
}
