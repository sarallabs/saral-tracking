"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle, X, Check, Reply, CornerDownRight, CheckCircle2, Circle, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PageComment {
  id: string;
  content: string;
  parentId: string | null;
  anchorText: string | null;
  anchorId: string | null;
  isResolved: boolean;
  createdAt: string;
  authorId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  authorImage: string | null;
}

interface InlineCommentsProps {
  pageId: string;
  currentUserId: string;
  open: boolean;
  onClose: () => void;
}

function AuthorAvatar({ name, image, size = "sm" }: { name: string | null; image: string | null; size?: "sm" | "xs" }) {
  const initials = (name ?? "?").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const cls = size === "xs" ? "w-5 h-5 text-[10px]" : "w-7 h-7 text-xs";
  return (
    <div className={`${cls} rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shrink-0 font-medium text-white overflow-hidden`}>
      {image ? <img src={image} alt={name ?? ""} className="w-full h-full object-cover" /> : initials}
    </div>
  );
}

function CommentItem({
  comment,
  replies,
  currentUserId,
  onReply,
  onResolve,
  onDelete,
}: {
  comment: PageComment;
  replies: PageComment[];
  currentUserId: string;
  onReply: (parentId: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={`rounded-xl border transition-all ${comment.isResolved ? "border-[hsl(var(--border))]/50 opacity-60" : "border-[hsl(var(--border))] bg-[hsl(var(--card))]"}`}>
      {/* Anchor text */}
      {comment.anchorText && (
        <div className="px-3 pt-3 pb-0">
          <div className="border-l-2 border-[hsl(var(--primary))] pl-2 text-xs text-[hsl(var(--muted-foreground))] italic truncate">
            "{comment.anchorText}"
          </div>
        </div>
      )}

      <div className="p-3">
        <div className="flex items-start gap-2">
          <AuthorAvatar name={comment.authorName} image={comment.authorImage} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium truncate">{comment.authorName ?? comment.authorEmail ?? "Unknown"}</span>
              <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">
                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm mt-1 leading-relaxed">{comment.content}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 mt-2 pl-9">
          <button
            onClick={() => onReply(comment.id)}
            className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors px-1.5 py-0.5 rounded hover:bg-[hsl(var(--secondary))]"
          >
            <Reply className="w-3 h-3" />
            Reply
          </button>
          <button
            onClick={() => onResolve(comment.id, !comment.isResolved)}
            className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] hover:text-emerald-400 transition-colors px-1.5 py-0.5 rounded hover:bg-[hsl(var(--secondary))]"
          >
            {comment.isResolved ? <Circle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
            {comment.isResolved ? "Reopen" : "Resolve"}
          </button>
          {comment.authorId === currentUserId && (
            <button
              onClick={() => onDelete(comment.id)}
              className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors px-1.5 py-0.5 rounded hover:bg-[hsl(var(--secondary))]"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="border-t border-[hsl(var(--border))]/50 px-3 py-2 space-y-3">
          {replies.map((reply) => (
            <div key={reply.id} className="flex items-start gap-2">
              <CornerDownRight className="w-3 h-3 mt-1 text-[hsl(var(--muted-foreground))]/50 shrink-0" />
              <AuthorAvatar name={reply.authorName} image={reply.authorImage} size="xs" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium">{reply.authorName ?? reply.authorEmail ?? "Unknown"}</span>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs mt-0.5 leading-relaxed">{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function InlineComments({ pageId, currentUserId, open, onClose }: InlineCommentsProps) {
  const [comments, setComments] = useState<PageComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/pages/${pageId}/comments`);
    if (res.ok) {
      const data = await res.json();
      setComments(data.comments ?? []);
    }
    setLoading(false);
  }, [pageId]);

  useEffect(() => {
    if (open) fetchComments();
  }, [open, fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/pages/${pageId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newComment, parentId: replyTo }),
    });
    if (res.ok) {
      setNewComment("");
      setReplyTo(null);
      fetchComments();
    }
    setSubmitting(false);
  };

  const handleResolve = async (id: string, resolved: boolean) => {
    await fetch(`/api/pages/${pageId}/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isResolved: resolved }),
    });
    fetchComments();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this comment?")) return;
    await fetch(`/api/pages/${pageId}/comments/${id}`, { method: "DELETE" });
    fetchComments();
  };

  const rootComments = comments.filter(c => !c.parentId);
  const getReplies = (id: string) => comments.filter(c => c.parentId === id);
  const filtered = showResolved ? rootComments : rootComments.filter(c => !c.isResolved);

  if (!open) return null;

  return (
    <aside className="w-80 shrink-0 border-l border-[hsl(var(--border))] flex flex-col bg-[hsl(var(--card))] h-full animate-slide-in">
      {/* Header */}
      <div className="p-4 border-b border-[hsl(var(--border))] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[hsl(var(--primary))]" />
          <span className="font-medium text-sm">Comments</span>
          {comments.filter(c => !c.parentId && !c.isResolved).length > 0 && (
            <span className="text-[10px] bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] px-1.5 py-0.5 rounded-full font-medium">
              {comments.filter(c => !c.parentId && !c.isResolved).length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={`text-[10px] px-2 py-1 rounded transition-colors ${showResolved ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]"}`}
          >
            {showResolved ? "Hide Resolved" : "Show Resolved"}
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-[hsl(var(--secondary))] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-[hsl(var(--secondary))]/50 rounded-xl animate-pulse" />
            ))}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <MessageCircle className="w-8 h-8 mx-auto mb-3 text-[hsl(var(--muted-foreground))]/30" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No comments yet</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]/60 mt-1">Add a comment below to start the discussion</p>
          </div>
        )}
        {filtered.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            replies={getReplies(comment.id)}
            currentUserId={currentUserId}
            onReply={setReplyTo}
            onResolve={handleResolve}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Reply indicator */}
      {replyTo && (
        <div className="px-4 py-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--primary))]/5 flex items-center justify-between">
          <span className="text-xs text-[hsl(var(--primary))]">
            <CornerDownRight className="w-3 h-3 inline mr-1" />
            Replying to comment
          </span>
          <button onClick={() => setReplyTo(null)} className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">Cancel</button>
        </div>
      )}

      {/* New comment form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-[hsl(var(--border))] shrink-0">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--input))] border border-[hsl(var(--border))] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50 transition-colors placeholder:text-[hsl(var(--muted-foreground))]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">⌘+Enter to submit</span>
          <button
            type="submit"
            disabled={submitting || !newComment.trim()}
            className="btn-primary text-xs py-1.5 px-3"
          >
            {submitting ? "Posting..." : "Comment"}
          </button>
        </div>
      </form>
    </aside>
  );
}
