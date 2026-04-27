"use client";

import { useState } from "react";
import { X, ChevronDown } from "lucide-react";
import {
  IssueType, IssueStatus, IssuePriority, Member,
  TYPE_CONFIG, STATUS_CONFIG, PRIORITY_CONFIG, ALL_STATUSES,
} from "@/lib/types";

interface CreateIssueModalProps {
  projectId: string;
  members: Member[];
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultStatus?: IssueStatus;
}

function Select<T extends string>({
  value, onChange, options, label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-xs hover:border-[hsl(var(--primary))]/40 transition-colors"
      >
        <span className="text-[hsl(var(--muted-foreground))]">{label}:</span>
        <span>{current?.label ?? value}</span>
        <ChevronDown className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[140px] bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-xl shadow-xl overflow-hidden animate-in">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-[hsl(var(--secondary))] transition-colors ${value === opt.value ? "text-[hsl(var(--primary))]" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CreateIssueModal({ projectId, members, open, onClose, onCreated, defaultStatus = "backlog" }: CreateIssueModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<IssueType>("task");
  const [status, setStatus] = useState<IssueStatus>(defaultStatus);
  const [priority, setPriority] = useState<IssuePriority>("medium");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, title: title.trim(), description: description || undefined,
          type, status, priority,
          assigneeId: assigneeId || null,
          dueDate: dueDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.formErrors?.[0] ?? "Failed to create"); return; }
      setTitle(""); setDescription(""); setType("task"); setPriority("medium"); setAssigneeId(""); setDueDate("");
      onCreated();
      onClose();
    } finally { setLoading(false); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass rounded-2xl w-full max-w-lg animate-in shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[hsl(var(--border))]">
          <h2 className="font-semibold text-sm">Create Issue</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type pills */}
          <div className="flex gap-1.5 flex-wrap">
            {(Object.keys(TYPE_CONFIG) as IssueType[]).map((t) => (
              <button
                key={t} type="button"
                onClick={() => setType(t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${type === t ? "bg-[hsl(var(--primary))]/10 border-[hsl(var(--primary))]/40 text-[hsl(var(--primary))]" : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]/30"}`}
              >
                {TYPE_CONFIG[t].icon} {TYPE_CONFIG[t].label}
              </button>
            ))}
          </div>

          {/* Title */}
          <input
            className="input-field text-base font-medium"
            placeholder="Issue title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />

          {/* Description */}
          <textarea
            className="input-field resize-none text-sm"
            rows={3}
            placeholder="Add a description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {/* Meta row */}
          <div className="flex flex-wrap gap-2">
            <Select
              value={status} onChange={setStatus} label="Status"
              options={ALL_STATUSES.map((s) => ({ value: s, label: STATUS_CONFIG[s].label }))}
            />
            <Select
              value={priority} onChange={setPriority} label="Priority"
              options={(Object.keys(PRIORITY_CONFIG) as IssuePriority[]).map((p) => ({ value: p, label: PRIORITY_CONFIG[p].label }))}
            />
          </div>

          {/* Assignee + Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">Assignee</label>
              <select
                className="input-field text-xs"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name ?? m.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">Due Date</label>
              <input
                type="date"
                className="input-field text-xs"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={loading || !title.trim()} className="btn-primary flex-1 justify-center disabled:opacity-50">
              {loading ? "Creating..." : "Create Issue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
