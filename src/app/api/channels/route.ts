export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { channels, memberships } from "@/lib/schema";
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

  if (!membership[0]) return NextResponse.json({ channels: [] });
  const workspaceId = membership[0].workspaceId;

  const allChannels = await db.select().from(channels).where(eq(channels.workspaceId, workspaceId)).orderBy(desc(channels.createdAt));

  return NextResponse.json({ channels: allChannels });
}

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  isPrivate: z.boolean().default(false),
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

  const [channel] = await db.insert(channels).values({
    ...parsed.data,
    workspaceId: membership[0].workspaceId,
    createdBy: session.user.id,
    isDm: false,
  }).returning();

  return NextResponse.json({ channel }, { status: 201 });
}
