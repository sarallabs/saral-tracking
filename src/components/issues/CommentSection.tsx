"use client";

import { useState, useEffect, useRef } from "react";
import { Send, MessageSquare } from "lucide-react";
import { Comment } from "@/lib/types";
import { formatRelativeTime, getInitials } from "@/lib/utils";

interface CommentSectionProps {
  entityType: "issue" | "page" | "message" | "project" | "channel";
  entityId: string;
  currentUserId: string;
  currentUserName?: string | null;
}

function Avatar({ name, image, size = "sm" }: { name?: string | null; image?: string | null; size?: "sm" | "xs" }) {
  const sz = size === "xs" ? "w-6 h-6 text-[9px]" : "w-7 h-7 text-xs";
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shrink-0 overflow-hidden`}>
      {image
        ? <img src={image} alt={name ?? ""} className="w-full h-full object-cover" />
        : <span className="text-white font-medium">{getInitials(name)}</span>
      }
    </div>
  );
}

export function CommentSection({ entityType, entityId, currentUserId, currentUserName }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchComments();
  }, [entityId]);

  async function fetchComments() {
    setLoading(true);
    try {
      const res = await fetch(`/api/comments?entityType=${entityType}&entityId=${entityId}`);
      const data = await res.json();
      setComments(data.comments ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, content: content.trim() }),
      });
      if (res.ok) {
        setContent("");
        await fetchComments();
        textareaRef.current?.focus();
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Auto-resize textarea
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        <h3 className="text-sm font-semibold">
          Comments{comments.length > 0 && <span className="ml-1.5 text-[hsl(var(--muted-foreground))] font-normal text-xs">({comments.length})</span>}
        </h3>
      </div>

      {/* Comment list */}
      <div className="space-y-4 mb-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-7 h-7 rounded-full bg-[hsl(var(--secondary))] shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 bg-[hsl(var(--secondary))] rounded w-1/4" />
                  <div className="h-3 bg-[hsl(var(--secondary))] rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))] italic">No comments yet. Be the first to comment.</p>
        ) : (
          [...comments].reverse().map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar name={comment.authorName ?? comment.authorEmail} image={comment.authorImage} />
              <div className="flex-1">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-medium">
                    {comment.authorName ?? comment.authorEmail ?? "Unknown"}
                  </span>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {formatRelativeTime(comment.createdAt)}
                  </span>
                </div>
                <div className="bg-[hsl(var(--secondary))]/60 rounded-xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed">
                  {comment.content}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <Avatar name={currentUserName} size="sm" />
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            className="input-field resize-none pr-10 min-h-[38px] text-sm leading-relaxed"
            placeholder="Add a comment..."
            value={content}
            onChange={handleInput}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as React.FormEvent);
            }}
          />
          <button
            type="submit"
            disabled={!content.trim() || submitting}
            className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-[hsl(var(--primary))] text-white disabled:opacity-40 hover:bg-[hsl(var(--primary))]/90 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 ml-10">
        Ctrl+Enter to submit
      </p>
    </div>
  );
}
