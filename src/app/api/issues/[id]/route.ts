export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { issues, users, notifications } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// GET /api/issues/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [row] = await db
    .select({
      id: issues.id,
      title: issues.title,
      description: issues.description,
      type: issues.type,
      status: issues.status,
      priority: issues.priority,
      sortOrder: issues.sortOrder,
      dueDate: issues.dueDate,
      createdAt: issues.createdAt,
      updatedAt: issues.updatedAt,
      projectId: issues.projectId,
      assigneeId: issues.assigneeId,
      reporterId: issues.reporterId,
      parentId: issues.parentId,
      assigneeName: users.name,
      assigneeEmail: users.email,
      assigneeImage: users.image,
    })
    .from(issues)
    .leftJoin(users, eq(issues.assigneeId, users.id))
    .where(eq(issues.id, id))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ issue: row });
}

const patchSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  type: z.enum(["task", "bug", "story", "epic"]).optional(),
  status: z.enum(["backlog", "todo", "in_progress", "in_review", "done", "cancelled"]).optional(),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  sortOrder: z.number().optional(),
});

// PATCH /api/issues/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { dueDate, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

  // Get previous state to check assignee change
  const [prev] = await db.select().from(issues).where(eq(issues.id, id)).limit(1);

  const [updated] = await db
    .update(issues)
    .set(updateData)
    .where(eq(issues.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Notify new assignee
  if (
    rest.assigneeId &&
    rest.assigneeId !== prev?.assigneeId &&
    rest.assigneeId !== session.user.id
  ) {
    await db.insert(notifications).values({
      userId: rest.assigneeId,
      type: "issue_assigned",
      entityType: "issue",
      entityId: id,
      title: "You were assigned an issue",
      body: updated.title,
    });
  }

  // Notify status change to reporter
  if (rest.status && rest.status !== prev?.status && prev?.reporterId && prev.reporterId !== session.user.id) {
    await db.insert(notifications).values({
      userId: prev.reporterId,
      type: "issue_status_changed",
      entityType: "issue",
      entityId: id,
      title: `Issue status changed to ${rest.status.replace("_", " ")}`,
      body: updated.title,
    });
  }

  return NextResponse.json({ issue: updated });
}

// DELETE /api/issues/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(issues).where(eq(issues.id, id));
  return NextResponse.json({ ok: true });
}
