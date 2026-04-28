"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Hash, Lock, Send, Smile, MessageSquare, Pencil, Trash2, X, Check, Loader2, AtSign } from "lucide-react";
import { formatRelativeTime, getInitials } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  content: string;
  isEdited: boolean;
  threadParentId: string | null;
  createdAt: string;
  authorId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  authorImage: string | null;
  replyCount: number;
  reactions: Record<string, { count: number; userIds: string[] }>;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "🙏", "🔥", "✅", "👀"];

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
  name, image, size = "md",
}: { name?: string | null; image?: string | null; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-7 h-7 text-xs" : "w-8 h-8 text-sm";
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex-shrink-0 flex items-center justify-center overflow-hidden`}>
      {image
        ? <img src={image} alt={name ?? ""} className="w-full h-full object-cover" />
        : <span className="text-white font-semibold">{getInitials(name)}</span>
      }
    </div>
  );
}

// ─── Single Message Row ───────────────────────────────────────────────────────

function MessageRow({
  msg, currentUserId, onReact, onEdit, onDelete, onThreadOpen,
}: {
  msg: Message;
  currentUserId: string;
  onReact: (id: string, emoji: string) => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onThreadOpen: (msg: Message) => void;
}) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(msg.content);
  const isOwn = msg.authorId === currentUserId;

  return (
    <div className="group relative flex gap-3 px-4 py-1.5 hover:bg-[hsl(var(--secondary))]/30 rounded-xl transition-colors">
      <Avatar name={msg.authorName ?? msg.authorEmail} image={msg.authorImage} />
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-xs font-semibold">{msg.authorName ?? msg.authorEmail ?? "Unknown"}</span>
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{formatRelativeTime(msg.createdAt)}</span>
          {msg.isEdited && <span className="text-[10px] text-[hsl(var(--muted-foreground))]/60">(edited)</span>}
        </div>

        {/* Content */}
        {editing ? (
          <div className="flex gap-2 items-end">
            <textarea
              autoFocus
              className="input-field text-sm resize-none flex-1 min-h-[60px]"
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onEdit(msg.id, editVal);
                  setEditing(false);
                }
                if (e.key === "Escape") setEditing(false);
              }}
            />
            <div className="flex flex-col gap-1">
              <button onClick={() => { onEdit(msg.id, editVal); setEditing(false); }}
                className="p-1.5 rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/80">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
        )}

        {/* Reactions */}
        {Object.keys(msg.reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {Object.entries(msg.reactions).map(([emoji, data]) => (
              <button
                key={emoji}
                onClick={() => onReact(msg.id, emoji)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                  data.userIds.includes(currentUserId)
                    ? "border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                    : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/30"
                }`}
              >
                {emoji} <span>{data.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Thread count */}
        {msg.replyCount > 0 && (
          <button
            onClick={() => onThreadOpen(msg)}
            className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[hsl(var(--primary))] hover:underline"
          >
            <MessageSquare className="w-3 h-3" />
            {msg.replyCount} {msg.replyCount === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>

      {/* Action toolbar (on hover) */}
      <div className="absolute right-4 top-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-md p-0.5 z-10">
        <div className="relative">
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="p-1.5 rounded-md hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            title="React"
          >
            <Smile className="w-3.5 h-3.5" />
          </button>
          {showEmoji && (
            <div className="absolute bottom-full right-0 mb-1 flex gap-1 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-1.5 shadow-xl z-20">
              {QUICK_EMOJIS.map((e) => (
                <button key={e} onClick={() => { onReact(msg.id, e); setShowEmoji(false); }}
                  className="text-lg hover:scale-125 transition-transform p-0.5">{e}</button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => onThreadOpen(msg)}
          className="p-1.5 rounded-md hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          title="Reply in thread"
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
        {isOwn && (
          <>
            <button onClick={() => { setEditing(true); setEditVal(msg.content); }}
              className="p-1.5 rounded-md hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors" title="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(msg.id)}
              className="p-1.5 rounded-md hover:bg-red-500/10 text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Thread Panel ─────────────────────────────────────────────────────────────

function ThreadPanel({
  parentMsg, channelId, currentUserId, currentUserName,
  onClose,
}: {
  parentMsg: Message;
  channelId: string;
  currentUserId: string;
  currentUserName?: string | null;
  onClose: () => void;
}) {
  const [replies, setReplies] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchReplies = useCallback(async () => {
    const res = await fetch(`/api/channels/${channelId}/messages?threadParentId=${parentMsg.id}`);
    const data = await res.json();
    setReplies(data.messages ?? []);
    setLoading(false);
  }, [channelId, parentMsg.id]);

  useEffect(() => { fetchReplies(); }, [fetchReplies]);

  async function send() {
    if (!content.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/channels/${channelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), threadParentId: parentMsg.id }),
      });
      setContent("");
      await fetchReplies();
    } finally { setSending(false); }
  }

  return (
    <div className="w-80 xl:w-96 flex flex-col h-full border-l border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
          <h3 className="text-sm font-semibold">Thread</h3>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Parent message */}
      <div className="p-4 border-b border-[hsl(var(--border))]/50 bg-[hsl(var(--secondary))]/20">
        <div className="flex items-center gap-2 mb-1">
          <Avatar name={parentMsg.authorName} image={parentMsg.authorImage} size="sm" />
          <span className="text-xs font-semibold">{parentMsg.authorName ?? parentMsg.authorEmail}</span>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed pl-9">{parentMsg.content}</p>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : replies.length === 0 ? (
          <p className="text-center text-xs text-[hsl(var(--muted-foreground))] py-8">No replies yet</p>
        ) : (
          replies.map((r) => (
            <div key={r.id} className="flex gap-2.5 py-1.5">
              <Avatar name={r.authorName} image={r.authorImage} size="sm" />
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold">{r.authorName ?? r.authorEmail}</span>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{formatRelativeTime(r.createdAt)}</span>
                </div>
                <p className="text-sm leading-relaxed">{r.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Thread input */}
      <div className="p-3 border-t border-[hsl(var(--border))]">
        <div className="flex gap-2">
          <Avatar name={currentUserName} size="sm" />
          <div className="flex-1 relative">
            <textarea
              className="input-field text-sm resize-none pr-10 min-h-[38px]"
              rows={1}
              placeholder="Reply in thread..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
            />
            <button
              onClick={send}
              disabled={!content.trim() || sending}
              className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-[hsl(var(--primary))] text-white disabled:opacity-40 transition-colors"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Message Input ────────────────────────────────────────────────────────────

function MessageInput({
  channelName, onSend, disabled,
}: { channelName: string; onSend: (content: string) => Promise<void>; disabled?: boolean }) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  async function handleSend() {
    if (!content.trim() || sending || disabled) return;
    setSending(true);
    try {
      await onSend(content.trim());
      setContent("");
      if (textRef.current) {
        textRef.current.style.height = "auto";
        textRef.current.focus();
      }
    } finally { setSending(false); }
  }

  return (
    <div className="p-3 border-t border-[hsl(var(--border))]">
      <div className="flex items-end gap-2 bg-[hsl(var(--secondary))]/60 border border-[hsl(var(--border))] rounded-xl px-3 py-2 focus-within:border-[hsl(var(--primary))]/40 transition-colors">
        <textarea
          ref={textRef}
          className="flex-1 bg-transparent outline-none resize-none text-sm leading-relaxed max-h-40 py-1"
          placeholder={`Message #${channelName}`}
          value={content}
          disabled={disabled}
          rows={1}
          onChange={(e) => {
            setContent(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
        />
        <button
          onClick={handleSend}
          disabled={!content.trim() || sending || disabled}
          className="p-2 rounded-lg bg-[hsl(var(--primary))] text-white disabled:opacity-40 hover:bg-[hsl(var(--primary))]/90 transition-colors shrink-0"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 ml-1">Enter to send · Shift+Enter for newline</p>
    </div>
  );
}

// ─── Channel View (main export) ───────────────────────────────────────────────

interface ChannelViewProps {
  channelId: string;
  channelName: string;
  channelDescription?: string | null;
  isPrivate?: boolean;
  currentUserId: string;
  currentUserName?: string | null;
  currentUserImage?: string | null;
}

export function ChannelView({
  channelId, channelName, channelDescription, isPrivate,
  currentUserId, currentUserName, currentUserImage,
}: ChannelViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadMsg, setThreadMsg] = useState<Message | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevChannelId = useRef<string>("");

  const fetchMessages = useCallback(async (scroll = false) => {
    const res = await fetch(`/api/channels/${channelId}/messages`);
    const data = await res.json();
    setMessages(data.messages ?? []);
    setLoading(false);
    if (scroll) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [channelId]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    fetchMessages(true);
    prevChannelId.current = channelId;
    // Poll every 3 seconds
    const interval = setInterval(() => fetchMessages(false), 3000);
    return () => clearInterval(interval);
  }, [channelId, fetchMessages]);

  async function handleSend(content: string) {
    // Optimistic update
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      content,
      isEdited: false,
      threadParentId: null,
      createdAt: new Date().toISOString(),
      authorId: currentUserId,
      authorName: currentUserName ?? null,
      authorEmail: null,
      authorImage: currentUserImage ?? null,
      replyCount: 0,
      reactions: {},
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    await fetch(`/api/channels/${channelId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    await fetchMessages(false);
  }

  async function handleReact(messageId: string, emoji: string) {
    await fetch(`/api/channels/${channelId}/messages/${messageId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    await fetchMessages(false);
  }

  async function handleEdit(messageId: string, content: string) {
    await fetch(`/api/channels/${channelId}/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, content, isEdited: true } : m));
  }

  async function handleDelete(messageId: string) {
    if (!confirm("Delete this message?")) return;
    await fetch(`/api/channels/${channelId}/messages/${messageId}`, { method: "DELETE" });
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }

  // Group messages by date
  const groups: { date: string; msgs: Message[] }[] = [];
  for (const msg of messages) {
    const date = new Date(msg.createdAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const last = groups[groups.length - 1];
    if (last?.date === date) last.msgs.push(msg);
    else groups.push({ date, msgs: [msg] });
  }

  return (
    <div className="flex h-full">
      {/* Main channel */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Channel header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border))] shrink-0">
          <div className={`flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]`}>
            {isPrivate ? <Lock className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
          </div>
          <div>
            <h2 className="text-sm font-semibold">{channelName}</h2>
            {channelDescription && (
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{channelDescription}</p>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--primary))]" />
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--primary))]/10 flex items-center justify-center mb-3">
                <Hash className="w-6 h-6 text-[hsl(var(--primary))]" />
              </div>
              <h3 className="text-sm font-semibold mb-1">Welcome to #{channelName}!</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {channelDescription ?? "This is the start of the channel. Say hello!"}
              </p>
            </div>
          ) : (
            <div>
              {groups.map((group) => (
                <div key={group.date}>
                  {/* Date separator */}
                  <div className="flex items-center gap-3 px-4 my-4">
                    <div className="flex-1 border-t border-[hsl(var(--border))]" />
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] bg-[hsl(var(--background))] px-2">{group.date}</span>
                    <div className="flex-1 border-t border-[hsl(var(--border))]" />
                  </div>
                  {group.msgs.map((msg) => (
                    <MessageRow
                      key={msg.id}
                      msg={msg}
                      currentUserId={currentUserId}
                      onReact={handleReact}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onThreadOpen={setThreadMsg}
                    />
                  ))}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <MessageInput channelName={channelName} onSend={handleSend} />
      </div>

      {/* Thread panel */}
      {threadMsg && (
        <ThreadPanel
          parentMsg={threadMsg}
          channelId={channelId}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => setThreadMsg(null)}
        />
      )}
    </div>
  );
}
