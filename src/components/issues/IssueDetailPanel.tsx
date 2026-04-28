"use client";

import { useState, useEffect } from "react";
import { X, Calendar, User, Flag, Tag, Trash2, ExternalLink, ChevronDown } from "lucide-react";
import {
  Issue, Member, IssueStatus, IssuePriority, IssueType,
  STATUS_CONFIG, PRIORITY_CONFIG, TYPE_CONFIG, ALL_STATUSES,
} from "@/lib/types";
import { CommentSection } from "./CommentSection";
import { formatDate, getInitials } from "@/lib/utils";

interface IssueDetailPanelProps {
  issue: Issue | null;
  members: Member[];
  projectId: string;
  currentUserId: string;
  currentUserName?: string | null;
  onClose: () => void;
  onUpdated: (issue: Issue) => void;
  onDeleted: (id: string) => void;
}

function FieldSelect<T extends string>({
  label, value, options, onChange, icon: Icon,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; color?: string }[];
  onChange: (v: T) => void;
  icon?: React.ElementType;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--secondary))]/50 hover:bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-xs transition-colors"
      >
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />}
          <span className={current?.color ?? ""}>{current?.label ?? value}</span>
        </div>
        <ChevronDown className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-full bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-xl shadow-xl overflow-hidden animate-in">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-[hsl(var(--secondary))] transition-colors ${opt.color ?? ""} ${value === opt.value ? "bg-[hsl(var(--primary))]/5" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function IssueDetailPanel({
  issue, members, currentUserId, currentUserName, onClose, onUpdated, onDeleted,
}: IssueDetailPanelProps) {
  const [title, setTitle] = useState(issue?.title ?? "");
  const [description, setDescription] = useState(issue?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (issue) {
      setTitle(issue.title);
      setDescription(issue.description ?? "");
    }
  }, [issue?.id]);

  if (!issue) return null;

  async function update(patch: Partial<Issue>) {
    if (!issue) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdated({ ...issue, ...patch, ...data.issue });
      }
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm("Delete this issue? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await fetch(`/api/issues/${issue!.id}`, { method: "DELETE" });
      onDeleted(issue!.id);
      onClose();
    } finally { setDeleting(false); }
  }

  const assignee = members.find((m) => m.id === issue.assigneeId);
  const statusCfg = STATUS_CONFIG[issue.status];
  const priorityCfg = PRIORITY_CONFIG[issue.priority];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-2xl bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] flex flex-col h-full shadow-2xl animate-slide-in overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[hsl(var(--border))] shrink-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${statusCfg.bg} ${statusCfg.color} border-current/20`}>
              {statusCfg.label}
            </span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{TYPE_CONFIG[issue.type].icon} {TYPE_CONFIG[issue.type].label}</span>
          </div>
          <div className="flex items-center gap-1">
            {saving && <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Saving...</span>}
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
              title="Delete issue"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5">
            {/* Title */}
            <textarea
              className="w-full text-lg font-semibold bg-transparent border-none outline-none resize-none leading-snug mb-3 focus:ring-2 focus:ring-[hsl(var(--primary))]/20 rounded-lg px-2 py-1 -mx-2"
              value={title}
              rows={2}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title !== issue.title && update({ title })}
            />

            {/* Description */}
            <textarea
              className="w-full text-sm text-[hsl(var(--muted-foreground))] bg-transparent border border-transparent hover:border-[hsl(var(--border))] rounded-xl p-3 -mx-3 resize-none outline-none leading-relaxed focus:border-[hsl(var(--primary))]/40 focus:text-[hsl(var(--foreground))] transition-colors min-h-[80px]"
              placeholder="Add description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== (issue.description ?? "") && update({ description: description || null })}
            />

            {/* Properties grid */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              {/* Status */}
              <div>
                <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1 block">Status</label>
                <FieldSelect
                  label="Status" value={issue.status}
                  options={ALL_STATUSES.map((s) => ({ value: s, label: STATUS_CONFIG[s].label, color: STATUS_CONFIG[s].color }))}
                  onChange={(v: IssueStatus) => update({ status: v })}
                  icon={Tag}
                />
              </div>

              {/* Priority */}
              <div>
                <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1 block">Priority</label>
                <FieldSelect
                  label="Priority" value={issue.priority}
                  options={(Object.keys(PRIORITY_CONFIG) as IssuePriority[]).map((p) => ({ value: p, label: `${PRIORITY_CONFIG[p].icon} ${PRIORITY_CONFIG[p].label}`, color: PRIORITY_CONFIG[p].color }))}
                  onChange={(v: IssuePriority) => update({ priority: v })}
                  icon={Flag}
                />
              </div>

              {/* Assignee */}
              <div>
                <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1 block">Assignee</label>
                <FieldSelect
                  label="Assignee" value={issue.assigneeId ?? ""}
                  options={[{ value: "", label: "Unassigned" }, ...members.map((m) => ({ value: m.id, label: m.name ?? m.email }))]}
                  onChange={(v) => update({ assigneeId: v || null })}
                  icon={User}
                />
              </div>

              {/* Due date */}
              <div>
                <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1 block">Due Date</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--secondary))]/50 border border-[hsl(var(--border))] text-xs">
                  <Calendar className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
                  <input
                    type="date"
                    className="bg-transparent outline-none flex-1 text-xs"
                    value={issue.dueDate ? issue.dueDate.split("T")[0] : ""}
                    onChange={(e) => update({ dueDate: e.target.value || null })}
                  />
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1 block">Type</label>
                <FieldSelect
                  label="Type" value={issue.type}
                  options={(Object.keys(TYPE_CONFIG) as IssueType[]).map((t) => ({ value: t, label: `${TYPE_CONFIG[t].icon} ${TYPE_CONFIG[t].label}` }))}
                  onChange={(v: IssueType) => update({ type: v })}
                />
              </div>
            </div>

            {/* Assignee card */}
            {assignee && (
              <div className="mt-4 flex items-center gap-2.5 p-3 rounded-xl bg-[hsl(var(--secondary))]/40 border border-[hsl(var(--border))]">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shrink-0">
                  {assignee.image
                    ? <img src={assignee.image} alt={assignee.name ?? ""} className="w-8 h-8 rounded-full" />
                    : <span className="text-white text-xs font-medium">{getInitials(assignee.name)}</span>
                  }
                </div>
                <div>
                  <p className="text-xs font-medium">{assignee.name ?? assignee.email}</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Assigned</p>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-[hsl(var(--border))] mt-6" />

            {/* Comments */}
            <CommentSection
              entityType="issue"
              entityId={issue.id}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
