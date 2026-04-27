"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  issue_assigned: "🎯",
  issue_status_changed: "🔄",
  comment_added: "💬",
  mention: "📣",
  default: "🔔",
};

export function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30s
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnread((u) => Math.max(0, u - 1));
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        className="relative p-2 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors"
      >
        <Bell className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-[hsl(var(--primary))] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 z-50 bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl overflow-hidden animate-in">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unread > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline">
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-8 h-8 text-[hsl(var(--muted-foreground))]/30 mx-auto mb-2" />
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">You're all caught up!</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markRead(n.id)}
                    className={`flex gap-3 px-4 py-3 hover:bg-[hsl(var(--secondary))]/50 transition-colors cursor-pointer border-b border-[hsl(var(--border))]/50 ${!n.read ? "bg-[hsl(var(--primary))]/5" : ""}`}
                  >
                    <span className="text-lg mt-0.5 shrink-0">
                      {TYPE_ICONS[n.type] ?? TYPE_ICONS.default}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug ${!n.read ? "font-medium" : "text-[hsl(var(--muted-foreground))]"}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-1">{n.body}</p>
                      )}
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]/70 mt-1">
                        {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>
                    {!n.read && (
                      <div className="w-1.5 h-1.5 bg-[hsl(var(--primary))] rounded-full mt-1.5 shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
