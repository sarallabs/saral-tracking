export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaces, memberships } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

// GET /api/admin/settings — get workspace settings
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(session.user as { isGlobalAdmin?: boolean }).isGlobalAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [membership] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  if (!membership) return NextResponse.json({ error: "No workspace" }, { status: 404 });

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, membership.workspaceId)).limit(1);
  return NextResponse.json({ workspace });
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  logoUrl: z.string().url().optional().nullable(),
});

// PATCH /api/admin/settings — update workspace settings
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(session.user as { isGlobalAdmin?: boolean }).isGlobalAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [membership] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  if (!membership) return NextResponse.json({ error: "No workspace" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db
    .update(workspaces)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(workspaces.id, membership.workspaceId))
    .returning();

  await logAudit({
    workspaceId: membership.workspaceId,
    actorId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    action: "workspace.update",
    entityType: "workspace",
    entityId: membership.workspaceId,
    entityName: updated.name,
    metadata: parsed.data,
  });

  return NextResponse.json({ workspace: updated });
}
