import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  users,
  projects,
  issues,
  memberships,
  notifications,
} from "@/lib/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  MessageSquare,
  TrendingUp,
  Bell,
} from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

async function getDashboardData(userId: string) {
  // Get workspace
  const membership = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);

  if (!membership[0]) return null;

  const workspaceId = membership[0].workspaceId;

  const [allProjects, myIssues, unreadNotifs] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, workspaceId),
          eq(projects.status, "active")
        )
      )
      .limit(6),
    db
      .select()
      .from(issues)
      .where(eq(issues.assigneeId, userId))
      .orderBy(desc(issues.updatedAt))
      .limit(8),
    db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
      .limit(5),
  ]);

  return { projects: allProjects, myIssues, unreadNotifs };
}

const statusColors: Record<string, string> = {
  backlog: "text-[hsl(var(--muted-foreground))]",
  todo: "text-blue-400",
  in_progress: "text-blue-400",
  in_review: "text-amber-400",
  done: "text-emerald-400",
  cancelled: "text-red-400",
};

const priorityDot: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-slate-500",
  none: "bg-slate-600",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const data = await getDashboardData(session.user.id);
  const userName = session.user.name?.split(" ")[0] ?? "there";

  const stats = [
    {
      label: "Active Projects",
      value: data?.projects.length ?? 0,
      icon: FolderKanban,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      label: "My Open Issues",
      value:
        data?.myIssues.filter(
          (i) => i.status !== "done" && i.status !== "cancelled"
        ).length ?? 0,
      icon: AlertCircle,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Completed Today",
      value:
        data?.myIssues.filter(
          (i) =>
            i.status === "done" &&
            i.updatedAt &&
            new Date(i.updatedAt).toDateString() === new Date().toDateString()
        ).length ?? 0,
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Notifications",
      value: data?.unreadNotifs.length ?? 0,
      icon: Bell,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto animate-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">
          Good{" "}
          {new Date().getHours() < 12
            ? "morning"
            : new Date().getHours() < 17
            ? "afternoon"
            : "evening"}
          , {userName} 👋
        </h1>
        <p className="text-[hsl(var(--muted-foreground))] text-sm">
          Here's what's happening across your workspace today.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="card">
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <TrendingUp className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]/40" />
            </div>
            <p className="text-2xl font-bold mb-0.5">{stat.value}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projects */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Active Projects</h2>
            <Link
              href="/projects"
              className="text-xs text-[hsl(var(--primary))] hover:underline"
            >
              View all
            </Link>
          </div>

          {(!data?.projects || data.projects.length === 0) ? (
            <div className="card text-center py-10">
              <FolderKanban className="w-8 h-8 text-[hsl(var(--muted-foreground))]/40 mx-auto mb-3" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                No projects yet
              </p>
              <Link href="/projects" className="btn-primary mt-3 inline-flex">
                Create your first project
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="card hover:border-[hsl(var(--primary))]/30 transition-colors group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: project.coverColor ?? "#6366f1" }}
                    >
                      {project.key.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-[hsl(var(--primary))] transition-colors">
                        {project.name}
                      </p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {project.key}
                      </p>
                    </div>
                  </div>
                  {project.description && (
                    <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2">
                      {project.description}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* My Issues */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">My Issues</h2>
            <Link
              href="/projects/my-issues"
              className="text-xs text-[hsl(var(--primary))] hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="card p-0 overflow-hidden">
            {(!data?.myIssues || data.myIssues.length === 0) ? (
              <div className="py-10 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400/40 mx-auto mb-2" />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  No issues assigned to you
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[hsl(var(--border))]">
                {data.myIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-[hsl(var(--secondary))]/50 transition-colors"
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${priorityDot[issue.priority]}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium line-clamp-1">
                        {issue.title}
                      </p>
                      <p
                        className={`text-[10px] mt-0.5 ${statusColors[issue.status]}`}
                      >
                        {issue.status.replace("_", " ")}
                      </p>
                    </div>
                    {issue.dueDate && (
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">
                        {formatRelativeTime(issue.dueDate)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
