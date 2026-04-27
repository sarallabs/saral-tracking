export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projectMembers, users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// GET /api/projects/[id]/members
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .leftJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, id));

  return NextResponse.json({ members });
}
