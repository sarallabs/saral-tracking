"use client";

import { useState, useEffect, useCallback, use } from "react";
import {
  History, Trash2, CheckCircle2, Globe, Lock, Users,
  ChevronRight, MessageCircle, Eye, Edit3, Send, FileEdit,
  Clock, BookOpen
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { TiptapEditor } from "@/components/docs/TiptapEditor";
import { VersionHistoryPanel } from "@/components/docs/VersionHistoryPanel";
import { InlineComments } from "@/components/docs/InlineComments";
import { Page } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import Ably from "ably";

interface Breadcrumb {
  id: string;
  title: string;
  emoji: string | null;
}

interface SpaceInfo {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface Presence {
  userId: string;
  name: string;
  image: string | null;
}

const ACCESS_ICONS = {
  workspace: Globe,
  space: Users,
  restricted: Lock,
};

const ACCESS_LABELS = {
  workspace: "Workspace",
  space: "Space members",
  restricted: "Restricted",
};

export default function PageEditor({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = use(params);
  const router = useRouter();
  const { data: session } = useSession();

  const [page, setPage] = useState<Page | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<Breadcrumb[]>([]);
  const [space, setSpace] = useState<SpaceInfo | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedStatus, setSavedStatus] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [activeView, setActiveView] = useState<"edit" | "preview">("edit");
  const [presence, setPresence] = useState<Presence[]>([]);
  const [ablyChannel, setAblyChannel] = useState<Ably.RealtimeChannel | null>(null);

  // Access level state
  const [accessLevel, setAccessLevel] = useState<"workspace" | "space" | "restricted">("workspace");
  const [showAccessMenu, setShowAccessMenu] = useState(false);

  const fetchPage = useCallback(async () => {
    const res = await fetch(`/api/pages/${pageId}`);
    if (res.ok) {
      const data = await res.json();
      setPage(data.page);
      setTitle(data.page.title);
      setContent(data.page.content ?? "");
      setDraftContent(data.page.draftContent ?? data.page.content ?? "");
      setAccessLevel(data.page.accessLevel ?? "workspace");
      setBreadcrumb(data.breadcrumb ?? []);
      setSpace(data.space ?? null);
    }
  }, [pageId]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  // ─── Ably Real-time Presence ───────────────────────────────────────────────
let sharedAblyClient: Ably.Realtime | null = null;

  useEffect(() => {
    if (!session?.user?.id || !pageId) return;

    let channel: Ably.RealtimeChannel | null = null;

    const setup = async () => {
      try {
        if (!sharedAblyClient) {
          sharedAblyClient = new Ably.Realtime({ authUrl: "/api/ably/auth" });
        }
        channel = sharedAblyClient.channels.get(`page:${pageId}`);
        setAblyChannel(channel);

        // Enter presence
        channel.presence.enter({
          userId: session.user!.id,
          name: session.user!.name ?? session.user!.email ?? "Unknown",
          image: session.user!.image ?? null,
        }).catch(() => {});

        // Track presence updates
        const updatePresence = async () => {
          if (!channel) return;
          try {
            const members = await channel.presence.get();
            const others = members
              .filter((m) => m.clientId !== session.user!.id)
              .map((m) => m.data as Presence);
            setPresence(others);
          } catch (e) {
            // ignore
          }
        };

        channel.presence.subscribe(updatePresence);
        updatePresence();

        // Listen for content broadcasts from other editors
        channel.subscribe("content-update", (msg) => {
          if (msg.clientId !== session.user!.id) {
            // Another user updated - we get a notification but don't auto-overwrite local edits
            setSavedStatus(false);
          }
        });
      } catch (e) {
        console.error("Ably setup error:", e);
      }
    };

    setup();

    return () => {
      if (channel) {
        try {
          channel.presence.leave().catch(() => {});
          channel.unsubscribe();
          channel.presence.unsubscribe();
          channel.detach(() => {});
        } catch (e) {
          // Ignore synchronous cleanup errors
        }
      }
    };
  }, [session, pageId]);

  // ─── Auto-save draft ──────────────────────────────────────────────────────
  const saveDraft = useCallback(async (newTitle: string, newDraft: string) => {
    await fetch(`/api/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, draftContent: newDraft }),
    });
    // Broadcast to co-editors
    ablyChannel?.publish("content-update", { editorId: session?.user?.id });
  }, [pageId, ablyChannel, session]);

  // Debounced auto-save
  useEffect(() => {
    if (!page) return;
    const timer = setTimeout(() => {
      saveDraft(title, draftContent);
    }, 1500);
    return () => clearTimeout(timer);
  }, [title, draftContent, saveDraft, page]);

  const handleContentChange = (newHtml: string) => {
    setDraftContent(newHtml);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await fetch(`/api/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, draftContent, saveVersion: false }),
      });
      setSavedStatus(true);
      setTimeout(() => setSavedStatus(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      await fetch(`/api/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          draftContent,
          content: draftContent,
          status: "published",
          accessLevel,
          saveVersion: true,
        }),
      });
      await fetchPage();
      setSavedStatus(true);
      setTimeout(() => setSavedStatus(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleSetAccess = async (level: "workspace" | "space" | "restricted") => {
    setAccessLevel(level);
    setShowAccessMenu(false);
    await fetch(`/api/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessLevel: level }),
    });
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this page?")) return;
    await fetch(`/api/pages/${pageId}`, { method: "DELETE" });
    router.push("/docs");
  };

  if (!page) {
    return (
      <div className="flex-1 p-10 animate-pulse space-y-4 max-w-4xl mx-auto">
        <div className="h-8 bg-[hsl(var(--secondary))] rounded-xl w-1/2" />
        <div className="h-4 bg-[hsl(var(--secondary))] rounded w-3/4" />
        <div className="h-4 bg-[hsl(var(--secondary))] rounded w-2/3" />
      </div>
    );
  }

  const AccessIcon = ACCESS_ICONS[accessLevel];
  const isPublished = page.status === "published";

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main editor area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top toolbar */}
        <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] shrink-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 px-6 pt-3 text-xs text-[hsl(var(--muted-foreground))]">
            {space && (
              <>
                <a href={`/spaces/${space.id}`} className="flex items-center gap-1 hover:text-[hsl(var(--foreground))] transition-colors">
                  <span>{space.icon}</span>
                  <span>{space.name}</span>
                </a>
                <ChevronRight className="w-3 h-3" />
              </>
            )}
            {breadcrumb.map((crumb) => (
              <div key={crumb.id} className="flex items-center gap-1.5">
                <a href={`/docs/${crumb.id}`} className="flex items-center gap-1 hover:text-[hsl(var(--foreground))] transition-colors">
                  <span>{crumb.emoji ?? "📄"}</span>
                  <span>{crumb.title}</span>
                </a>
                <ChevronRight className="w-3 h-3" />
              </div>
            ))}
            <span className="flex items-center gap-1 text-[hsl(var(--foreground))]">
              <span>{page.emoji ?? "📄"}</span>
              <span className="font-medium">{page.title}</span>
            </span>
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between px-6 py-3">
            {/* Left: status & view toggle */}
            <div className="flex items-center gap-2">
              {/* Status badge */}
              <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${
                isPublished
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-amber-500/20 text-amber-400"
              }`}>
                {isPublished ? "● PUBLISHED" : "● DRAFT"}
              </span>

              {/* View toggle */}
              <div className="flex items-center bg-[hsl(var(--secondary))] rounded-lg p-0.5">
                <button
                  onClick={() => setActiveView("edit")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeView === "edit"
                      ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
                      : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  }`}
                >
                  <Edit3 className="w-3 h-3" />
                  Edit
                </button>
                <button
                  onClick={() => setActiveView("preview")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeView === "preview"
                      ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
                      : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  Preview
                </button>
              </div>
            </div>

            {/* Right: presence + actions */}
            <div className="flex items-center gap-2">
              {/* Co-editor presence avatars */}
              {presence.length > 0 && (
                <div className="flex items-center gap-1 mr-2">
                  <div className="flex -space-x-2">
                    {presence.slice(0, 4).map((p, i) => {
                      const initials = p.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                      return (
                        <div
                          key={p.userId}
                          title={`${p.name} is editing`}
                          className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-medium border-2 border-[hsl(var(--background))] overflow-hidden"
                          style={{ zIndex: 10 - i }}
                        >
                          {p.image ? (
                            <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                          ) : initials}
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))] ml-1">
                    {presence.length} editing
                  </span>
                </div>
              )}

              {/* Access control */}
              <div className="relative">
                <button
                  onClick={() => setShowAccessMenu(!showAccessMenu)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/80 transition-colors border border-[hsl(var(--border))]"
                >
                  <AccessIcon className="w-3.5 h-3.5" />
                  {ACCESS_LABELS[accessLevel]}
                </button>
                {showAccessMenu && (
                  <div className="absolute right-0 top-9 w-44 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-50 overflow-hidden animate-in">
                    {(["workspace", "space", "restricted"] as const).map((level) => {
                      const Icon = ACCESS_ICONS[level];
                      return (
                        <button
                          key={level}
                          onClick={() => handleSetAccess(level)}
                          className={`flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-[hsl(var(--secondary))] transition-colors ${accessLevel === level ? "text-[hsl(var(--primary))]" : ""}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {ACCESS_LABELS[level]}
                          {accessLevel === level && <CheckCircle2 className="w-3 h-3 ml-auto" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button onClick={() => setShowHistory(true)} className="btn-secondary text-xs py-1.5 px-3">
                <History className="w-3.5 h-3.5" />
                History
              </button>

              <button
                onClick={() => setShowComments(!showComments)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  showComments
                    ? "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30"
                    : "bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]/80"
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Comments
              </button>

              {/* Save Draft */}
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                <Clock className="w-3.5 h-3.5" />
                Save Draft
              </button>

              {/* Publish */}
              <button
                onClick={handlePublish}
                disabled={saving}
                className="btn-primary text-xs py-1.5 px-3"
              >
                {saving ? (
                  "Saving..."
                ) : savedStatus ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> Saved</>
                ) : (
                  <><Send className="w-3.5 h-3.5" /> {isPublished ? "Update" : "Publish"}</>
                )}
              </button>

              <button
                onClick={handleDelete}
                className="p-2 rounded-lg hover:bg-red-500/10 text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
                title="Delete Page"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Editor content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 py-8">
            {/* Page title */}
            <div className="flex items-center gap-3 mb-6">
              <button
                title="Page emoji"
                className="text-4xl hover:bg-[hsl(var(--secondary))] p-1 rounded-lg transition-colors shrink-0"
                onClick={() => {
                  const emoji = window.prompt("Enter emoji:", page.emoji ?? "📄");
                  if (emoji !== null) {
                    fetch(`/api/pages/${pageId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ emoji }),
                    }).then(fetchPage);
                  }
                }}
              >
                {page.emoji ?? "📄"}
              </button>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled Page"
                className="text-4xl font-bold bg-transparent border-none outline-none placeholder:text-[hsl(var(--muted-foreground))]/30 flex-1 focus:ring-0"
              />
            </div>

            {/* Page meta */}
            <div className="flex items-center gap-4 mb-6 text-xs text-[hsl(var(--muted-foreground))]">
              <span>Updated {formatDistanceToNow(new Date(page.updatedAt), { addSuffix: true })}</span>
              {page.depth > 0 && (
                <span className="flex items-center gap-1">
                  Level {page.depth + 1} page
                </span>
              )}
            </div>

            {/* Editor / Preview */}
            {activeView === "edit" ? (
              <TiptapEditor
                content={draftContent}
                onChange={handleContentChange}
                editable={true}
              />
            ) : (
              <div className="border border-[hsl(var(--border))] rounded-xl overflow-hidden bg-[hsl(var(--card))] p-6">
                <TiptapEditor
                  content={page.content ?? ""}
                  onChange={() => {}}
                  editable={false}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comments panel */}
      {showComments && session?.user?.id && (
        <InlineComments
          pageId={pageId}
          currentUserId={session.user.id}
          open={showComments}
          onClose={() => setShowComments(false)}
        />
      )}

      {/* Version history panel */}
      <VersionHistoryPanel
        pageId={pageId}
        currentContent={content}
        open={showHistory}
        onClose={() => setShowHistory(false)}
      />

      {/* Click-away for access menu */}
      {showAccessMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowAccessMenu(false)} />
      )}
    </div>
  );
}
