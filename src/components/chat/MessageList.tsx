"use client";

import { Message } from "@/lib/types";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import { MessageSquare, SmilePlus } from "lucide-react";
import { useState } from "react";

const EMOJI_OPTIONS = ["👍", "❤️", "😂", "🚀", "👀"];

export function MessageItem({
  message,
  currentUserId,
  onReply,
  onReact,
}: {
  message: Message;
  currentUserId: string;
  onReply: (message: Message) => void;
  onReact: (messageId: string, emoji: string) => void;
}) {
  const [showEmojis, setShowEmojis] = useState(false);

  // Group reactions by emoji
  const reactionsByEmoji = (message.reactions || []).reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, userIds: new Set() };
    acc[r.emoji].count += 1;
    acc[r.emoji].userIds.add(r.userId);
    return acc;
  }, {} as Record<string, { count: number, userIds: Set<string> }>);

  return (
    <div className="group flex gap-3 px-5 py-2 hover:bg-[hsl(var(--secondary))]/40 transition-colors relative">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white shrink-0 overflow-hidden">
        {message.authorImage ? (
          <img src={message.authorImage} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-medium">{getInitials(message.authorName ?? message.authorEmail)}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="font-semibold text-sm">{message.authorName ?? message.authorEmail}</span>
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{formatRelativeTime(message.createdAt)}</span>
        </div>
        
        <div className="text-sm text-[hsl(var(--foreground))] whitespace-pre-wrap leading-relaxed">
          {message.content}
        </div>

        {/* Reactions and Threads row */}
        {(Object.keys(reactionsByEmoji).length > 0 || (message.replyCount && message.replyCount > 0)) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {Object.entries(reactionsByEmoji).map(([emoji, data]) => {
              const hasReacted = data.userIds.has(currentUserId);
              return (
                <button
                  key={emoji}
                  onClick={() => onReact(message.id, emoji)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                    hasReacted 
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400" 
                      : "bg-[hsl(var(--secondary))] border-transparent hover:border-[hsl(var(--border))]"
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="font-medium">{data.count}</span>
                </button>
              );
            })}

            {message.replyCount ? (
              <button
                onClick={() => onReply(message)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10 transition-colors ml-2"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                {message.replyCount} {message.replyCount === 1 ? "reply" : "replies"}
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* Hover actions */}
      <div className="absolute right-5 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-sm">
        <div className="relative">
          <button 
            onClick={() => setShowEmojis(!showEmojis)}
            className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
            title="React"
          >
            <SmilePlus className="w-4 h-4" />
          </button>
          {showEmojis && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowEmojis(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 flex gap-1 p-1.5 bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-xl shadow-xl animate-in">
                {EMOJI_OPTIONS.map(e => (
                  <button 
                    key={e} 
                    onClick={() => { onReact(message.id, e); setShowEmojis(false); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors text-lg"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button 
          onClick={() => onReply(message)}
          className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
          title="Reply in thread"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function MessageList({
  messages,
  currentUserId,
  onReply,
  onReact,
}: {
  messages: Message[];
  currentUserId: string;
  onReply: (message: Message) => void;
  onReact: (messageId: string, emoji: string) => void;
}) {
  return (
    <div className="flex flex-col py-4">
      {messages.map(msg => (
        <MessageItem
          key={msg.id}
          message={msg}
          currentUserId={currentUserId}
          onReply={onReply}
          onReact={onReact}
        />
      ))}
      {messages.length === 0 && (
        <div className="text-center py-20 text-[hsl(var(--muted-foreground))]">
          <p className="text-sm font-medium mb-1">No messages yet</p>
          <p className="text-xs">Be the first to say hello!</p>
        </div>
      )}
    </div>
  );
}
