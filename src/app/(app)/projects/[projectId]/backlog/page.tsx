"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, LayoutGrid, List, Plus, Search, ChevronDown,
  AlertCircle, Calendar, Flag,
} from "lucide-react";
import {
  Issue, Member, IssueStatus, IssuePriority,
  STATUS_CONFIG, PRIORITY_CONFIG, ALL_STATUSES, TYPE_CONFIG,
} from "@/lib/types";
import { formatDate, getInitials } from "@/lib/utils";
import { CreateIssueModal } from "@/components/issues/CreateIssueModal";
import { IssueDetailPanel } from "@/components/issues/IssueDetailPanel";

type GroupBy = "status" | "priority" | "assignee";

function Avatar({ name, image }: { name?: string | null; image?: string | null }) {
  return (
    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center overflow-hidden shrink-0">
      {image
        ? <img src={image} alt={name ?? ""} className="w-full h-full object-cover" />
        : <span className="text-white text-[8px] font-medium">{getInitials(name)}</span>
      }
    </div>
  );
}

function StatusBadge({ status }: { status: IssueStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} border-current/20`}>
      <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function BacklogPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [issues, setIssues] = useState<Issue[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<IssueStatus | "">("");
  const [filterPriority, setFilterPriority] = useState<IssuePriority | "">("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [projectName, setProjectName] = useState("Project");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [issueRes, memberRes, projectRes] = await Promise.all([
        fetch(`/api/issues?projectId=${projectId}`),
        fetch(`/api/projects/${projectId}/members`),
        fetch(`/api/projects`),
      ]);
      const [issueData, memberData, projectData] = await Promise.all([
        issueRes.json(), memberRes.json(), projectRes.json(),
      ]);
      setIssues(issueData.issues ?? []);
      setMembers(memberData.members ?? []);
      const found = (projectData.projects ?? []).find((p: { id: string; name: string }) => p.id === projectId);
      if (found) setProjectName(found.name);
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = issues.filter((i) => {
    if (filterStatus && i.status !== filterStatus) return false;
    if (filterPriority && i.priority !== filterPriority) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function handleUpdated(updated: Issue) {
    setIssues((prev) => prev.map((i) => i.id === updated.id ? updated : i));
    setSelectedIssue(updated);
  }

  function handleDeleted(id: string) {
    setIssues((prev) => prev.filter((i) => i.id !== id));
    setSelectedIssue(null);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[hsl(var(--border))] shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/projects" className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Projects
          </Link>
          <span className="text-[hsl(var(--muted-foreground))]">/</span>
          <span className="text-sm font-semibold">{projectName}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[hsl(var(--secondary))] rounded-lg p-1">
            <Link href={`/projects/${projectId}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
              <LayoutGrid className="w-3.5 h-3.5" />Board
            </Link>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[hsl(var(--primary))] text-white">
              <List className="w-3.5 h-3.5" />Backlog
            </button>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" />New Issue
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[hsl(var(--border))]/50">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
          <input className="input-field pl-8 text-xs" placeholder="Search issues..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field text-xs w-36" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as IssueStatus | "")}>
          <option value="">All Statuses</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>
        <select className="input-field text-xs w-36" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value as IssuePriority | "")}>
          <option value="">All Priorities</option>
          {(Object.keys(PRIORITY_CONFIG) as IssuePriority[]).map((p) => <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>)}
        </select>
        <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{filtered.length} issue{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Issue table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-5 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-[hsl(var(--secondary))]/40 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <AlertCircle className="w-10 h-10 text-[hsl(var(--muted-foreground))]/30 mx-auto mb-3" />
            <h3 className="text-sm font-semibold mb-1">No issues found</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
              {search || filterStatus || filterPriority ? "Try adjusting your filters" : "Create your first issue to get started"}
            </p>
            {!search && !filterStatus && !filterPriority && (
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                <Plus className="w-4 h-4" />Create Issue
              </button>
            )}
          </div>
        ) : (
          <div className="px-5 py-3">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 px-3 py-2 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">
              <span>Title</span><span>Status</span><span>Priority</span><span>Assignee</span><span>Due</span>
            </div>
            <div className="space-y-1">
              {filtered.map((issue) => (
                <div
                  key={issue.id}
                  onClick={() => setSelectedIssue(issue)}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 items-center px-3 py-2.5 rounded-xl hover:bg-[hsl(var(--secondary))]/50 transition-colors cursor-pointer group border border-transparent hover:border-[hsl(var(--border))]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm">{TYPE_CONFIG[issue.type].icon}</span>
                    <span className="text-xs font-medium truncate group-hover:text-[hsl(var(--primary))] transition-colors">
                      {issue.title}
                    </span>
                  </div>
                  <StatusBadge status={issue.status} />
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      issue.priority === "urgent" ? "bg-red-500" :
                      issue.priority === "high" ? "bg-orange-500" :
                      issue.priority === "medium" ? "bg-blue-500" : "bg-slate-500"
                    }`} />
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{PRIORITY_CONFIG[issue.priority].label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {issue.assigneeId ? (
                      <>
                        <Avatar name={issue.assigneeName} image={issue.assigneeImage} />
                        <span className="text-xs text-[hsl(var(--muted-foreground))] truncate">{issue.assigneeName ?? "—"}</span>
                      </>
                    ) : (
                      <span className="text-xs text-[hsl(var(--muted-foreground))]/50">Unassigned</span>
                    )}
                  </div>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {issue.dueDate ? formatDate(issue.dueDate) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <CreateIssueModal
        projectId={projectId} members={members}
        open={showCreate} onClose={() => setShowCreate(false)} onCreated={fetchAll}
      />

      {selectedIssue && (
        <IssueDetailPanel
          issue={selectedIssue} members={members} projectId={projectId}
          currentUserId="" currentUserName={null}
          onClose={() => setSelectedIssue(null)}
          onUpdated={handleUpdated} onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
