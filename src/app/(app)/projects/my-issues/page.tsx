import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { issues, projects } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ListTodo, CheckCircle2 } from "lucide-react";

export default async function MyIssuesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const myIssues = await db
    .select({
      id: issues.id,
      title: issues.title,
      status: issues.status,
      priority: issues.priority,
      projectId: issues.projectId,
      projectName: projects.name,
      projectKey: projects.key,
      projectColor: projects.coverColor,
    })
    .from(issues)
    .leftJoin(projects, eq(issues.projectId, projects.id))
    .where(eq(issues.assigneeId, session.user.id))
    .orderBy(desc(issues.createdAt));

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--background))]">
      <div className="px-6 py-5 border-b border-[hsl(var(--border))]">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-[hsl(var(--primary))]" />
          My Issues
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Issues assigned to you across all projects</p>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {myIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-[hsl(var(--muted-foreground))]">
            <CheckCircle2 className="w-10 h-10 mb-2 opacity-20" />
            <p>You have no issues assigned to you.</p>
          </div>
        ) : (
          <div className="grid gap-3 max-w-4xl">
            {myIssues.map((issue) => (
              <Link key={issue.id} href={`/projects/${issue.projectId}`} className="flex items-center justify-between p-4 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl hover:border-[hsl(var(--primary))]/50 transition-colors group">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium group-hover:text-[hsl(var(--primary))] transition-colors">{issue.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: issue.projectColor ?? '#6366f1' }}>
                        {issue.projectKey?.slice(0, 1)}
                      </div>
                      {issue.projectName}
                    </div>
                    <span>•</span>
                    <span className="capitalize">{issue.status.replace('_', ' ')}</span>
                    <span>•</span>
                    <span className="capitalize">{issue.priority}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
