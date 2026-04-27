"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Hash, Lock, Plus, Users, ChevronDown, ChevronRight, Search } from "lucide-react";

interface Channel {
  id: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  isDm: boolean;
  unreadCount: number;
}

interface PresenceUser {
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  isOnline: boolean;
}

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

function PresenceDot({ online }: { online: boolean }) {
  return (
    <span className={`w-2 h-2 rounded-full border-2 border-[hsl(var(--card))] shrink-0 ${online ? "bg-emerald-500" : "bg-slate-500"}`} />
  );
}

interface ChannelSidebarProps {
  currentUserId: string;
  onChannelSelect?: (id: string) => void;
}

export function ChannelSidebar({ currentUserId, onChannelSelect }: ChannelSidebarProps) {
  const params = useParams();
  const activeChannelId = params?.channelId as string | undefined;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [channelOpen, setChannelOpen] = useState(true);
  const [dmOpen, setDmOpen] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchChannels = useCallback(async () => {
    const [chRes, presRes] = await Promise.all([
      fetch("/api/channels"),
      fetch("/api/presence"),
    ]);
    const [chData, presData] = await Promise.all([chRes.json(), presRes.json()]);
    setChannels(chData.channels ?? []);
    setPresence(presData.presence ?? []);
  }, []);

  useEffect(() => {
    fetchChannels();
    const interval = setInterval(fetchChannels, 10000);
    return () => clearInterval(interval);
  }, [fetchChannels]);

  async function createChannel() {
    if (!newChannelName.trim()) return;
    setCreating(true);
    try {
      await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newChannelName.trim().toLowerCase().replace(/\s+/g, "-") }),
      });
      setNewChannelName("");
      setShowCreate(false);
      await fetchChannels();
    } finally { setCreating(false); }
  }

  const textChannels = channels.filter((c) => !c.isDm);
  const dmChannels = channels.filter((c) => c.isDm);
  const totalUnread = channels.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <div className="flex flex-col h-full w-60 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]/50">
      {/* Workspace header */}
      <div className="px-3 py-3 border-b border-[hsl(var(--border))]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Channels</h2>
          {totalUnread > 0 && (
            <span className="text-[10px] bg-[hsl(var(--primary))] text-white px-1.5 py-0.5 rounded-full font-bold">
              {totalUnread}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {/* Channels section */}
        <div className="mb-2">
          <button
            onClick={() => setChannelOpen(!channelOpen)}
            className="w-full flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] uppercase tracking-wider transition-colors"
          >
            {channelOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Channels
          </button>
          {channelOpen && (
            <div className="space-y-0.5 mt-0.5">
              {textChannels.map((ch) => (
                <Link
                  key={ch.id}
                  href={`/channels/${ch.id}`}
                  className={`flex items-center justify-between px-3 py-1.5 mx-1 rounded-lg text-xs transition-colors group ${
                    activeChannelId === ch.id
                      ? "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] font-medium"
                      : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {ch.isPrivate ? <Lock className="w-3 h-3 shrink-0" /> : <Hash className="w-3 h-3 shrink-0" />}
                    <span className="truncate">{ch.name}</span>
                  </div>
                  {ch.unreadCount > 0 && (
                    <span className="text-[10px] bg-[hsl(var(--primary))] text-white px-1.5 py-0.5 rounded-full font-bold shrink-0">
                      {ch.unreadCount > 9 ? "9+" : ch.unreadCount}
                    </span>
                  )}
                </Link>
              ))}
              {/* Add channel */}
              {showCreate ? (
                <div className="px-2 mx-1">
                  <div className="flex gap-1.5 mt-1">
                    <input
                      autoFocus
                      className="input-field text-xs flex-1 py-1.5"
                      placeholder="channel-name"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createChannel();
                        if (e.key === "Escape") setShowCreate(false);
                      }}
                    />
                    <button onClick={createChannel} disabled={creating} className="px-2 py-1.5 rounded-lg bg-[hsl(var(--primary))] text-white text-xs">
                      {creating ? "..." : "Add"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 px-3 py-1.5 mx-1 rounded-lg text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors w-[calc(100%-0.5rem)]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add channel
                </button>
              )}
            </div>
          )}
        </div>

        {/* DM section */}
        {dmChannels.length > 0 && (
          <div className="mb-2">
            <button
              onClick={() => setDmOpen(!dmOpen)}
              className="w-full flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] uppercase tracking-wider transition-colors"
            >
              {dmOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Direct Messages
            </button>
            {dmOpen && dmChannels.map((ch) => (
              <Link
                key={ch.id}
                href={`/channels/${ch.id}`}
                className={`flex items-center gap-2 px-3 py-1.5 mx-1 rounded-lg text-xs transition-colors ${
                  activeChannelId === ch.id
                    ? "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] font-medium"
                    : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                <span className="truncate">{ch.name}</span>
                {ch.unreadCount > 0 && (
                  <span className="text-[10px] bg-[hsl(var(--primary))] text-white px-1.5 py-0.5 rounded-full font-bold ml-auto shrink-0">
                    {ch.unreadCount}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Presence section */}
        {presence.length > 0 && (
          <div>
            <p className="px-3 py-1 text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
              Team — {presence.filter((p) => p.isOnline).length} online
            </p>
            <div className="space-y-0.5">
              {presence.map((p) => (
                <div key={p.userId} className="flex items-center gap-2 px-3 py-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                  <div className="relative">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white text-[9px] font-semibold overflow-hidden">
                      {p.image
                        ? <img src={p.image} alt="" className="w-full h-full object-cover" />
                        : getInitials(p.name)
                      }
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[hsl(var(--card))] ${p.isOnline ? "bg-emerald-500" : "bg-slate-500"}`} />
                  </div>
                  <span className="truncate">{p.name ?? p.email}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
