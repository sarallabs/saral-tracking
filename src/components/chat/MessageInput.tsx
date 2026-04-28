"use client";

import { useState } from "react";
import { Send, Smile } from "lucide-react";

interface MessageInputProps {
  onSendMessage: (content: string) => Promise<void>;
  placeholder?: string;
}

export function MessageInput({ onSendMessage, placeholder = "Type a message..." }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      await onSendMessage(content.trim());
      setContent("");
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] shrink-0">
      <div className="relative flex items-end border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))] focus-within:border-[hsl(var(--primary))]/50 focus-within:ring-2 focus-within:ring-[hsl(var(--primary))]/20 transition-all p-1">
        <textarea
          className="flex-1 bg-transparent border-none outline-none resize-none max-h-32 min-h-[40px] text-sm p-2.5"
          placeholder={placeholder}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          rows={1}
        />
        <div className="flex items-center gap-1 p-1.5">
          <button 
            type="submit" 
            disabled={!content.trim() || sending}
            className="p-2 rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </form>
  );
}
