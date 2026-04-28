export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { spaces, spaceMembers, memberships, users } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

async function getSpaceWithAccess(spaceId: string, userId: string) {
  const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { space: null, member: null };

  const [member] = await db
    .select()
    .from(spaceMembers)
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, userId)))
    .limit(1);

  return { space, member };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ spaceId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { spaceId } = await params;
  const { space, member } = await getSpaceWithAccess(spaceId, session.user.id);

  if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (space.isPrivate && !member) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  // Get all members with user info
  const members = await db
    .select({
      id: spaceMembers.id,
      userId: spaceMembers.userId,
      role: spaceMembers.role,
      joinedAt: spaceMembers.joinedAt,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(spaceMembers)
    .leftJoin(users, eq(spaceMembers.userId, users.id))
    .where(eq(spaceMembers.spaceId, spaceId));

  return NextResponse.json({
    space: {
      ...space,
      categories: JSON.parse(space.categories ?? "[]"),
      tags: JSON.parse(space.tags ?? "[]"),
    },
    members,
    userRole: member?.role ?? null,
  });
}

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().optional(),
  color: z.string().optional(),
  isPrivate: z.boolean().optional(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  homepageId: z.string().uuid().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ spaceId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { spaceId } = await params;
  const { space, member } = await getSpaceWithAccess(spaceId, session.user.id);

  if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!member || member.role !== "admin") return NextResponse.json({ error: "Access denied" }, { status: 403 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.categories) updateData.categories = JSON.stringify(parsed.data.categories);
  if (parsed.data.tags) updateData.tags = JSON.stringify(parsed.data.tags);

  const [updated] = await db.update(spaces).set(updateData).where(eq(spaces.id, spaceId)).returning();

  return NextResponse.json({ space: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ spaceId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { spaceId } = await params;
  const { space, member } = await getSpaceWithAccess(spaceId, session.user.id);

  if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!member || member.role !== "admin") return NextResponse.json({ error: "Access denied" }, { status: 403 });

  await db.delete(spaces).where(eq(spaces.id, spaceId));
  return NextResponse.json({ ok: true });
}
