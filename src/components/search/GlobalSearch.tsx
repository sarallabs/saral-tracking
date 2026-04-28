"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Hash, User, CheckSquare, MessageSquare, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/types";

interface SearchResults {
  issues?: Array<{ id: string; title: string; status: string; priority: string; type: string; projectId: string }>;
  messages?: Array<{ id: string; content: string; channelId: string; actorName?: string }>;
  users?: Array<{ id: string; name?: string; email: string; image?: string }>;
  channels?: Array<{ id: string; name: string; description?: string }>;
}

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults({});
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults({}); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? {});
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  function navigate(path: string) { router.push(path); onClose(); }

  const total = Object.values(results).reduce((s, arr) => s + (arr?.length ?? 0), 0);
  const hasResults = total > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl overflow-hidden animate-in">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[hsl(var(--border))]">
          {loading ? <Loader2 className="w-5 h-5 text-[hsl(var(--primary))] animate-spin shrink-0" /> : <Search className="w-5 h-5 text-[hsl(var(--muted-foreground))] shrink-0" />}
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-[hsl(var(--muted-foreground))]"
            placeholder="Search issues, messages, people, channels..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
          />
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors">
            <X className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query.length > 1 && !hasResults && !loading && (
            <div className="p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No results for "<span className="text-[hsl(var(--foreground))]">{query}</span>"
            </div>
          )}

          {!query && (
            <div className="p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Type at least 2 characters to search
            </div>
          )}

          {/* Issues */}
          {(results.issues?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider bg-[hsl(var(--secondary))]/30">
                <CheckSquare className="w-3 h-3" />Issues
              </div>
              {results.issues!.map((issue) => {
                const status = STATUS_CONFIG[issue.status as keyof typeof STATUS_CONFIG];
                const priority = PRIORITY_CONFIG[issue.priority as keyof typeof PRIORITY_CONFIG];
                return (
                  <button
                    key={issue.id}
                    onClick={() => navigate(`/projects/${issue.projectId}?issue=${issue.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(var(--secondary))]/60 transition-colors text-left"
                  >
                    <span className="text-base">{priority?.icon ?? "•"}</span>
                    <span className="flex-1 text-sm truncate">{issue.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${status?.bg ?? ""} ${status?.color ?? ""}`}>
                      {status?.label ?? issue.status}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Channels */}
          {(results.channels?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider bg-[hsl(var(--secondary))]/30">
                <Hash className="w-3 h-3" />Channels
              </div>
              {results.channels!.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => navigate(`/channels/${ch.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(var(--secondary))]/60 transition-colors text-left"
                >
                  <Hash className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                  <div>
                    <p className="text-sm font-medium">{ch.name}</p>
                    {ch.description && <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">{ch.description}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          {(results.messages?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider bg-[hsl(var(--secondary))]/30">
                <MessageSquare className="w-3 h-3" />Messages
              </div>
              {results.messages!.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => navigate(`/channels/${msg.channelId}`)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(var(--secondary))]/60 transition-colors text-left"
                >
                  <MessageSquare className="w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm truncate">{msg.content}</p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{msg.actorName}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Users */}
          {(results.users?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider bg-[hsl(var(--secondary))]/30">
                <User className="w-3 h-3" />People
              </div>
              {results.users!.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white text-xs font-semibold shrink-0 overflow-hidden">
                    {u.image ? <img src={u.image} alt="" className="w-full h-full object-cover" /> : getInitials(u.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{u.name ?? u.email}</p>
                    {u.name && <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{u.email}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {hasResults && (
          <div className="border-t border-[hsl(var(--border))] px-4 py-2 flex items-center gap-4 text-[10px] text-[hsl(var(--muted-foreground))]">
            <span><kbd className="font-mono bg-[hsl(var(--secondary))] px-1 rounded">↑↓</kbd> Navigate</span>
            <span><kbd className="font-mono bg-[hsl(var(--secondary))] px-1 rounded">↵</kbd> Open</span>
            <span><kbd className="font-mono bg-[hsl(var(--secondary))] px-1 rounded">Esc</kbd> Close</span>
          </div>
        )}
      </div>
    </div>
  );
}
