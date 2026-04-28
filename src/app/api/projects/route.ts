export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, memberships, projectMembers, users } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// GET /api/projects — list projects for user's workspace
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get workspace from membership
  const membership = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, session.user.id))
    .limit(1);

  if (!membership[0]) {
    return NextResponse.json({ projects: [] });
  }

  const workspaceId = membership[0].workspaceId;

  const allProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      key: projects.key,
      description: projects.description,
      status: projects.status,
      coverColor: projects.coverColor,
      createdAt: projects.createdAt,
      ownerName: users.name,
      ownerEmail: users.email,
      ownerAvatar: users.avatarUrl,
    })
    .from(projects)
    .leftJoin(users, eq(projects.ownerId, users.id))
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(desc(projects.createdAt));

  return NextResponse.json({ projects: allProjects });
}

// POST /api/projects — create a new project
const createSchema = z.object({
  name: z.string().min(1).max(100),
  key: z
    .string()
    .min(2)
    .max(6)
    .toUpperCase()
    .regex(/^[A-Z]+$/, "Key must be uppercase letters only"),
  description: z.string().max(500).optional(),
  coverColor: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, session.user.id))
    .limit(1);

  if (!membership[0]) {
    return NextResponse.json({ error: "No workspace found" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const workspaceId = membership[0].workspaceId;

  const [project] = await db
    .insert(projects)
    .values({
      ...parsed.data,
      workspaceId,
      ownerId: session.user.id,
    })
    .returning();

  // Add creator as project admin
  await db.insert(projectMembers).values({
    projectId: project.id,
    userId: session.user.id,
    role: "admin",
  });

  return NextResponse.json({ project }, { status: 201 });
}

