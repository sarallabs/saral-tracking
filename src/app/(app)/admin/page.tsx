"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, Shield, Settings, ClipboardList, Loader2, Check, X,
  Trash2, UserCog, RefreshCw, Plus, Eye, EyeOff, Save,
  ChevronDown, AlertTriangle,
} from "lucide-react";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import bcrypt from "bcryptjs";

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  id: string; name: string | null; email: string; status: string;
  isGlobalAdmin: boolean; image: string | null; createdAt: string;
}
interface AuditLog {
  id: string; action: string; entityType: string | null; entityName: string | null;
  actorEmail: string | null; metadata: string | null; createdAt: string;
}
interface WorkspaceSettings { id: string; name: string; logoUrl: string | null; slug: string; }

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, image }: { name?: string | null; image?: string | null }) {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shrink-0 overflow-hidden">
      {image
        ? <img src={image} alt="" className="w-full h-full object-cover" />
        : <span className="text-white text-xs font-semibold">{getInitials(name)}</span>
      }
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    active:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    pending:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
    suspended: "bg-red-500/10 text-red-400 border-red-500/20",
  }[status] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg}`}>
      {status}
    </span>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "suspended">("all");
  const [showAddUser, setShowAddUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function update(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await fetchUsers();
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail || !newPassword) return;
    setCreating(true);
    try {
      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, name: newName, password: newPassword }),
      });
      setNewEmail(""); setNewName(""); setNewPassword(""); setShowAddUser(false);
      await fetchUsers();
    } finally { setCreating(false); }
  }

  const filtered = filter === "all" ? users : users.filter((u) => u.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-[hsl(var(--secondary))] rounded-lg p-1">
          {(["all", "pending", "active", "suspended"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${filter === f ? "bg-[hsl(var(--card))] shadow-sm" : "text-[hsl(var(--muted-foreground))]"}`}>
              {f} {f !== "all" && <span className="ml-1 opacity-70">{users.filter((u) => u.status === f).length}</span>}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAddUser(!showAddUser)} className="btn-primary">
          <Plus className="w-4 h-4" />Add User
        </button>
      </div>

      {/* Add user form */}
      {showAddUser && (
        <div className="glass rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold mb-3">Create User with Password</h3>
          <form onSubmit={createUser} className="grid grid-cols-3 gap-3">
            <input className="input-field text-xs" placeholder="Full name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input className="input-field text-xs" type="email" placeholder="email@saralvidhya.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
            <div className="relative">
              <input className="input-field text-xs pr-9" type={showPw ? "text" : "password"} placeholder="Password (min 8 chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]">
                {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="col-span-3 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAddUser(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={creating} className="btn-primary">{creating ? "Creating..." : "Create User"}</button>
            </div>
          </form>
        </div>
      )}

      {/* User table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--primary))]" /></div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((user) => (
            <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl bg-[hsl(var(--secondary))]/30 border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/20 transition-colors">
              <Avatar name={user.name ?? user.email} image={user.image} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{user.name ?? "—"}</p>
                  {user.isGlobalAdmin && <span className="text-[9px] bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] px-1.5 py-0.5 rounded font-semibold">ADMIN</span>}
                </div>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">{user.email}</p>
              </div>
              <StatusBadge status={user.status} />
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] w-20 text-right shrink-0">{formatRelativeTime(user.createdAt)}</p>

              {/* Actions */}
              <div className="flex items-center gap-1 ml-1">
                {user.status === "pending" && (
                  <button onClick={() => update(user.id, { status: "active" })} title="Approve"
                    className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400 transition-colors">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
                {user.status === "active" && (
                  <button onClick={() => update(user.id, { status: "suspended" })} title="Suspend"
                    className="p-1.5 rounded-lg hover:bg-amber-500/10 text-amber-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {user.status === "suspended" && (
                  <button onClick={() => update(user.id, { status: "active" })} title="Reactivate"
                    className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400 transition-colors">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => update(user.id, { isGlobalAdmin: !user.isGlobalAdmin })} title="Toggle admin"
                  className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] transition-colors">
                  <UserCog className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Audit Log Tab ────────────────────────────────────────────────────────────

function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchLogs() {
    setLoading(true);
    const res = await fetch("/api/admin/audit");
    const data = await res.json();
    setLogs(data.logs ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchLogs(); }, []);

  const ACTION_COLORS: Record<string, string> = {
    "user.approve":    "text-emerald-400 bg-emerald-500/10",
    "user.suspend":    "text-red-400 bg-red-500/10",
    "user.admin":      "text-violet-400 bg-violet-500/10",
    "workspace.update":"text-blue-400 bg-blue-500/10",
    "project.create":  "text-amber-400 bg-amber-500/10",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Last 200 actions • All times in local timezone</p>
        <button onClick={fetchLogs} className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors">
          <RefreshCw className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--primary))]" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="w-10 h-10 text-[hsl(var(--muted-foreground))]/30 mx-auto mb-3" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No audit logs yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Header */}
          <div className="grid grid-cols-[1fr_2fr_1fr_1fr] gap-3 px-3 py-1.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            <span>Action</span><span>Entity</span><span>Actor</span><span>When</span>
          </div>
          {logs.map((log) => (
            <div key={log.id} className="grid grid-cols-[1fr_2fr_1fr_1fr] gap-3 items-center px-3 py-2.5 rounded-xl hover:bg-[hsl(var(--secondary))]/40 transition-colors border border-transparent hover:border-[hsl(var(--border))]">
              <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-mono font-medium w-fit ${ACTION_COLORS[log.action] ?? "text-slate-400 bg-slate-500/10"}`}>
                {log.action}
              </span>
              <div className="min-w-0">
                {log.entityName && <p className="text-xs font-medium truncate">{log.entityName}</p>}
                {log.entityType && <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{log.entityType}</p>}
              </div>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">{log.actorEmail ?? "—"}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{formatRelativeTime(log.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/settings").then((r) => r.json()).then((d) => {
      setSettings(d.workspace);
      setName(d.workspace?.name ?? "");
      setLoading(false);
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--primary))]" /></div>;

  return (
    <div className="max-w-md space-y-6">
      <div className="glass rounded-2xl p-5">
        <h3 className="text-sm font-semibold mb-4">Workspace Settings</h3>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5">Workspace Name</label>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5">Slug</label>
            <input className="input-field opacity-60" value={settings?.slug ?? ""} disabled />
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">Slug cannot be changed</p>
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : saved ? <><Check className="w-4 h-4" />Saved!</> : <><Save className="w-4 h-4" />Save Changes</>}
          </button>
        </form>
      </div>

      <div className="glass rounded-2xl p-5 border border-red-500/20">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
          These actions are irreversible. Proceed with caution.
        </p>
        <button disabled className="w-full px-3 py-2 rounded-lg border border-red-500/30 text-red-400/50 text-xs cursor-not-allowed">
          Delete Workspace — Contact support
        </button>
      </div>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

const TABS = [
  { id: "users",   label: "Users",       icon: Users },
  { id: "audit",   label: "Audit Logs",  icon: ClipboardList },
  { id: "settings",label: "Settings",    icon: Settings },
];

export default function AdminPage() {
  const [tab, setTab] = useState("users");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-[hsl(var(--primary))]" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Manage users, audit logs, and workspace settings</p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-[hsl(var(--secondary))] rounded-xl p-1 mb-6 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === t.id ? "bg-[hsl(var(--card))] shadow-sm text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "users" && <UsersTab />}
      {tab === "audit" && <AuditTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}
