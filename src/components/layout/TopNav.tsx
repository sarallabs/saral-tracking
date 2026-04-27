"use client";

import { useState, useEffect } from "react";
import { Bell, CheckCheck, Search } from "lucide-react";
import { NotificationsPanel } from "./NotificationsPanel";
import { GlobalSearch } from "@/components/search/GlobalSearch";

export function TopNav({ title }: { title?: string }) {
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd/Ctrl+K shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <header className="h-14 border-b border-[hsl(var(--border))] flex items-center justify-between px-5 bg-[hsl(var(--background))]/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-4">
          {title && <h1 className="text-sm font-semibold">{title}</h1>}
        </div>

        <div className="flex items-center gap-2">
          {/* Search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]/30 transition-colors w-52"
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left text-xs">Search everything...</span>
            <kbd className="text-[10px] bg-[hsl(var(--background))] px-1.5 py-0.5 rounded border border-[hsl(var(--border))] font-mono shrink-0">⌘K</kbd>
          </button>

          {/* Notifications */}
          <NotificationsPanel />
        </div>
      </header>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
