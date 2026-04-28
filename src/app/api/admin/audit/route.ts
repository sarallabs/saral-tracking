export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLogs, memberships } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET /api/admin/audit — audit log for admins
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(session.user as { isGlobalAdmin?: boolean }).isGlobalAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [membership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, session.user.id))
    .limit(1);

  const logs = await db
    .select()
    .from(auditLogs)
    .where(membership ? eq(auditLogs.workspaceId, membership.workspaceId) : undefined as never)
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);

  return NextResponse.json({ logs });
}
