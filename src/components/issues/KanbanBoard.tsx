"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext, DragOverlay, DragStartEvent, DragOverEvent, DragEndEvent,
  PointerSensor, useSensor, useSensors, closestCorners, useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, GripVertical, Calendar } from "lucide-react";
import {
  Issue, Member, IssueStatus, KANBAN_COLUMNS, STATUS_CONFIG, PRIORITY_CONFIG,
} from "@/lib/types";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import { CreateIssueModal } from "./CreateIssueModal";
import { IssueDetailPanel } from "./IssueDetailPanel";

// ─── Issue Card ───────────────────────────────────────────────────────────────

function IssueCard({ issue, onClick }: { issue: Issue; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const priorityCfg = PRIORITY_CONFIG[issue.priority];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-3 cursor-pointer hover:border-[hsl(var(--primary))]/30 hover:shadow-md transition-all"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-[hsl(var(--secondary))] cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium leading-snug line-clamp-2">{issue.title}</p>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5">
              {/* Priority dot */}
              <div className={`w-1.5 h-1.5 rounded-full ${
                issue.priority === "urgent" ? "bg-red-500" :
                issue.priority === "high" ? "bg-orange-500" :
                issue.priority === "medium" ? "bg-blue-500" : "bg-slate-500"
              }`} />
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {priorityCfg.label}
              </span>
            </div>
            {/* Assignee avatar */}
            {issue.assigneeName && (
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white text-[9px] font-medium"
                title={issue.assigneeName}>
                {getInitials(issue.assigneeName)}
              </div>
            )}
          </div>
          {issue.dueDate && (
            <div className="flex items-center gap-1 mt-1.5">
              <Calendar className="w-2.5 h-2.5 text-[hsl(var(--muted-foreground))]" />
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{formatRelativeTime(issue.dueDate)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

function Column({
  status, issues, onAddClick, onCardClick,
}: {
  status: IssueStatus;
  issues: Issue[];
  onAddClick: () => void;
  onCardClick: (issue: Issue) => void;
}) {
  const cfg = STATUS_CONFIG[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border transition-colors min-h-[200px] ${
        isOver ? "border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/3" : "border-[hsl(var(--border))]"
      } bg-[hsl(var(--secondary))]/30`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          <span className="text-xs font-semibold">{cfg.label}</span>
          <span className="text-[10px] text-[hsl(var(--muted-foreground))] bg-[hsl(var(--secondary))] px-1.5 py-0.5 rounded-full">
            {issues.length}
          </span>
        </div>
        <button
          onClick={onAddClick}
          className="p-1 rounded-lg hover:bg-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-260px)]">
        <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} onClick={() => onCardClick(issue)} />
          ))}
        </SortableContext>
        {issues.length === 0 && (
          <div className="text-center py-8 text-[10px] text-[hsl(var(--muted-foreground))]/50">
            Drop issues here
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

interface KanbanBoardProps {
  projectId: string;
  projectName: string;
  members: Member[];
  currentUserId: string;
  currentUserName?: string | null;
}

export function KanbanBoard({ projectId, projectName, members, currentUserId, currentUserName }: KanbanBoardProps) {
  const [issuesByStatus, setIssuesByStatus] = useState<Record<IssueStatus, Issue[]>>({
    backlog: [], todo: [], in_progress: [], in_review: [], done: [], cancelled: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [createStatus, setCreateStatus] = useState<IssueStatus | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/issues?projectId=${projectId}`);
      const data = await res.json();
      const grouped: Record<IssueStatus, Issue[]> = {
        backlog: [], todo: [], in_progress: [], in_review: [], done: [], cancelled: [],
      };
      for (const issue of (data.issues ?? []) as Issue[]) {
        if (grouped[issue.status]) grouped[issue.status].push(issue);
      }
      setIssuesByStatus(grouped);
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  function findIssueContainer(id: string): IssueStatus | null {
    for (const status of Object.keys(issuesByStatus) as IssueStatus[]) {
      if (issuesByStatus[status].find((i) => i.id === id)) return status;
    }
    return null;
  }

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    const container = findIssueContainer(id);
    if (container) setActiveIssue(issuesByStatus[container].find((i) => i.id === id) ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeContainer = findIssueContainer(activeId);
    const overContainer = (KANBAN_COLUMNS.includes(overId as IssueStatus) ? overId : findIssueContainer(overId)) as IssueStatus | null;

    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setIssuesByStatus((prev) => {
      const activeItems = [...prev[activeContainer]];
      const overItems = [...prev[overContainer]];
      const movedItem = activeItems.find((i) => i.id === activeId)!;
      return {
        ...prev,
        [activeContainer]: activeItems.filter((i) => i.id !== activeId),
        [overContainer]: [...overItems, { ...movedItem, status: overContainer }],
      };
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveIssue(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const container = findIssueContainer(activeId);
    if (!container) return;

    setIssuesByStatus((prev) => {
      const items = [...prev[container]];
      const oldIdx = items.findIndex((i) => i.id === activeId);
      const newIdx = items.findIndex((i) => i.id === overId);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return prev;
      return { ...prev, [container]: arrayMove(items, oldIdx, newIdx) };
    });

    // Persist status change if moved between columns
    const issue = Object.values(issuesByStatus).flat().find((i) => i.id === activeId);
    if (issue && issue.status !== container) {
      await fetch(`/api/issues/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: container }),
      });
    }
  }

  function handleIssueUpdated(updated: Issue) {
    setIssuesByStatus((prev) => {
      const next = { ...prev };
      // Remove from all columns
      for (const s of Object.keys(next) as IssueStatus[]) {
        next[s] = next[s].filter((i) => i.id !== updated.id);
      }
      // Add to correct column
      next[updated.status] = [updated, ...next[updated.status]];
      return next;
    });
    setSelectedIssue(updated);
  }

  function handleIssueDeleted(id: string) {
    setIssuesByStatus((prev) => {
      const next = { ...prev };
      for (const s of Object.keys(next) as IssueStatus[]) {
        next[s] = next[s].filter((i) => i.id !== id);
      }
      return next;
    });
    setSelectedIssue(null);
  }

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-3 p-4">
        {KANBAN_COLUMNS.map((s) => (
          <div key={s} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30 p-3 space-y-2 animate-pulse">
            <div className="h-4 bg-[hsl(var(--secondary))] rounded w-1/2 mb-3" />
            {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-[hsl(var(--secondary))] rounded-xl" />)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-4 gap-3 p-4">
          {KANBAN_COLUMNS.map((status) => (
            <Column
              key={status}
              status={status}
              issues={issuesByStatus[status]}
              onAddClick={() => setCreateStatus(status)}
              onCardClick={(issue) => setSelectedIssue(issue)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeIssue && (
            <div className="bg-[hsl(var(--card))] border border-[hsl(var(--primary))]/40 rounded-xl p-3 shadow-2xl rotate-2 w-52">
              <p className="text-xs font-medium line-clamp-2">{activeIssue.title}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Create Issue Modal */}
      <CreateIssueModal
        projectId={projectId}
        members={members}
        open={createStatus !== null}
        defaultStatus={createStatus ?? "todo"}
        onClose={() => setCreateStatus(null)}
        onCreated={fetchIssues}
      />

      {/* Issue Detail Panel */}
      {selectedIssue && (
        <IssueDetailPanel
          issue={selectedIssue}
          members={members}
          projectId={projectId}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => setSelectedIssue(null)}
          onUpdated={handleIssueUpdated}
          onDeleted={handleIssueDeleted}
        />
      )}
    </>
  );
}
