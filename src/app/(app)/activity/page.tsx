"use client";

import { useState, useEffect } from "react";
import { Activity, CheckSquare, MessageSquare, MessageCircle, Loader2, RefreshCw } from "lucide-react";
import { formatRelativeTime, getInitials } from "@/lib/utils";

interface ActivityEvent {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  actorName?: string | null;
  actorEmail?: string | null;
  actorImage?: string | null;
  entityId?: string;
  entityType?: string;
  createdAt: string;
}

const EVENT_ICONS: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  issue_created:  { icon: CheckSquare, color: "text-violet-400", bg: "bg-violet-500/10" },
  message_sent:   { icon: MessageSquare, color: "text-blue-400", bg: "bg-blue-500/10" },
  comment_added:  { icon: MessageCircle, color: "text-amber-400", bg: "bg-amber-500/10" },
};

function ActivityRow({ event }: { event: ActivityEvent }) {
  const cfg = EVENT_ICONS[event.type] ?? { icon: Activity, color: "text-slate-400", bg: "bg-slate-500/10" };
  const Icon = cfg.icon;

  return (
    <div className="flex gap-3 py-3 border-b border-[hsl(var(--border))]/50 last:border-0 hover:bg-[hsl(var(--secondary))]/20 rounded-xl px-2 transition-colors">
      {/* Actor avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shrink-0 overflow-hidden">
        {event.actorImage
          ? <img src={event.actorImage} alt="" className="w-full h-full object-cover" />
          : <span className="text-white text-xs font-semibold">{getInitials(event.actorName ?? event.actorEmail)}</span>
        }
      </div>

      <div className="flex-1 min-w-0">
        {/* Actor name + time */}
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <span className="text-xs font-semibold">{event.actorName ?? event.actorEmail ?? "System"}</span>
          <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">{formatRelativeTime(event.createdAt)}</span>
        </div>
        {/* Event */}
        <div className="flex items-start gap-2">
          <div className={`mt-0.5 p-1 rounded-md ${cfg.bg} shrink-0`}>
            <Icon className={`w-3 h-3 ${cfg.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs leading-snug line-clamp-2">{event.title}</p>
            {event.subtitle && <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{event.subtitle}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "issues" | "messages" | "comments">("all");

  async function fetchActivity() {
    setLoading(true);
    try {
      const res = await fetch("/api/activity");
      const data = await res.json();
      setEvents(data.events ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchActivity(); }, []);

  const filtered = filter === "all" ? events : events.filter((e) => {
    if (filter === "issues") return e.type === "issue_created";
    if (filter === "messages") return e.type === "message_sent";
    if (filter === "comments") return e.type === "comment_added";
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-[hsl(var(--primary))]" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Activity Feed</h1>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Recent workspace activity</p>
          </div>
        </div>
        <button onClick={fetchActivity} className="p-2 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors" title="Refresh">
          <RefreshCw className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-[hsl(var(--secondary))] rounded-xl p-1 mb-5">
        {(["all", "issues", "messages", "comments"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              filter === f ? "bg-[hsl(var(--card))] shadow-sm text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Events */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--primary))]" />
          <span className="text-sm text-[hsl(var(--muted-foreground))]">Loading activity...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Activity className="w-10 h-10 text-[hsl(var(--muted-foreground))]/30 mx-auto mb-3" />
          <h3 className="text-sm font-semibold mb-1">No activity yet</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Actions will appear here as your team works</p>
        </div>
      ) : (
        <div className="glass rounded-2xl p-3">
          {filtered.map((event) => <ActivityRow key={event.id} event={event} />)}
        </div>
      )}
    </div>
  );
}
