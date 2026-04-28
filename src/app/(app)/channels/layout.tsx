"use client";

import { useState, useEffect } from "react";
import { Plus, Hash, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Channel } from "@/lib/types";

export default function ChannelsLayout({ children }: { children: React.ReactNode }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const params = useParams();
  const activeChannelId = params.channelId as string;

  const fetchChannels = async () => {
    const res = await fetch("/api/channels");
    if (res.ok) {
      const data = await res.json();
      setChannels(data.channels ?? []);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const handleCreateChannel = async () => {
    const name = prompt("Channel name:");
    if (!name) return;
    await fetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    fetchChannels();
  };

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-64 border-r border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/20 flex flex-col shrink-0">
        <div className="p-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <MessageSquare className="w-4 h-4 text-[hsl(var(--primary))]" />
            <span>Chat</span>
          </div>
          <button onClick={handleCreateChannel} className="p-1 rounded hover:bg-[hsl(var(--secondary))] transition-colors" title="New Channel">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2 px-2">Channels</div>
          {channels.map(channel => (
            <Link
              key={channel.id}
              href={`/channels/${channel.id}`}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${activeChannelId === channel.id ? "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] font-medium" : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"}`}
            >
              <Hash className="w-4 h-4 opacity-50" />
              <span className="truncate">{channel.name}</span>
            </Link>
          ))}
          {channels.length === 0 && (
            <div className="px-2 py-2 text-xs text-[hsl(var(--muted-foreground))]">No channels yet</div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-[hsl(var(--background))]">
        {children}
      </div>
    </div>
  );
}
