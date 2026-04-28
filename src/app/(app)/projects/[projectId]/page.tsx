import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, projectMembers, users, memberships } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, LayoutGrid, List, Settings, Plus } from "lucide-react";
import { KanbanBoard } from "@/components/issues/KanbanBoard";

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  return { title: project?.name ?? "Project" };
}

async function getProjectData(projectId: string, userId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return null;

  const members = await db
    .select({ id: users.id, name: users.name, email: users.email, image: users.image, role: projectMembers.role })
    .from(projectMembers)
    .leftJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId));

  return { project, members };
}

export default async function ProjectBoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const data = await getProjectData(projectId, session.user.id);
  if (!data) notFound();

  const { project, members } = data;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/projects" className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Projects
          </Link>
          <span className="text-[hsl(var(--muted-foreground))]">/</span>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: project.coverColor ?? "#6366f1" }}>
              {project.key.slice(0, 2)}
            </div>
            <span className="text-sm font-semibold">{project.name}</span>
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex items-center gap-1 bg-[hsl(var(--secondary))] rounded-lg p-1">
          <Link href={`/projects/${projectId}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[hsl(var(--primary))] text-white">
            <LayoutGrid className="w-3.5 h-3.5" />
            Board
          </Link>
          <Link href={`/projects/${projectId}/backlog`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
            <List className="w-3.5 h-3.5" />
            Backlog
          </Link>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto">
        <KanbanBoard
          projectId={projectId}
          projectName={project.name}
          members={members.map((m) => ({
            id: m.id ?? "",
            name: m.name,
            email: m.email ?? "",
            image: m.image,
            role: m.role,
          }))}
          currentUserId={session.user.id}
          currentUserName={session.user.name}
        />
      </div>
    </div>
  );
}
