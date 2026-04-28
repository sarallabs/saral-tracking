"use client";

import { Message } from "@/lib/types";
import { X, MessageSquare } from "lucide-react";
import { MessageItem, MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";

interface ThreadPanelProps {
  parentMessage: Message;
  replies: Message[];
  currentUserId: string;
  onClose: () => void;
  onSendReply: (content: string) => Promise<void>;
  onReact: (messageId: string, emoji: string) => void;
}

export function ThreadPanel({ parentMessage, replies, currentUserId, onClose, onSendReply, onReact }: ThreadPanelProps) {
  return (
    <div className="w-80 lg:w-96 border-l border-[hsl(var(--border))] bg-[hsl(var(--background))] flex flex-col h-full shadow-xl">
      <div className="px-4 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between bg-[hsl(var(--secondary))]/30 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
          <h3 className="font-semibold text-sm">Thread</h3>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="pb-4">
          <MessageItem
            message={parentMessage}
            currentUserId={currentUserId}
            onReply={() => {}} 
            onReact={onReact}
          />
        </div>
        
        <div className="flex items-center gap-2 px-5 mb-2">
          <div className="flex-1 h-px bg-[hsl(var(--border))]" />
          <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{replies.length} replies</span>
          <div className="flex-1 h-px bg-[hsl(var(--border))]" />
        </div>

        <MessageList
          messages={replies}
          currentUserId={currentUserId}
          onReply={() => {}} 
          onReact={onReact}
        />
      </div>

      <MessageInput onSendMessage={onSendReply} placeholder="Reply in thread..." />
    </div>
  );
}
