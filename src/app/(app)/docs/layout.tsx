"use client";

import { useState, useEffect } from "react";
import { Plus, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageTree } from "@/components/docs/PageTree";
import { Page } from "@/lib/types";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const [pages, setPages] = useState<Page[]>([]);
  const router = useRouter();

  const fetchPages = async () => {
    const res = await fetch("/api/pages");
    if (res.ok) {
      const data = await res.json();
      setPages(data.pages ?? []);
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const handleCreateRoot = async () => {
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled Page" })
    });
    if (res.ok) {
      const data = await res.json();
      fetchPages();
      router.push(`/docs/${data.page.id}`);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-64 border-r border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/20 flex flex-col shrink-0">
        <div className="p-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <BookOpen className="w-4 h-4 text-[hsl(var(--primary))]" />
            <span>Docs</span>
          </div>
          <button onClick={handleCreateRoot} className="p-1 rounded hover:bg-[hsl(var(--secondary))] transition-colors" title="New Root Page">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <PageTree pages={pages} onPageCreated={fetchPages} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-[hsl(var(--background))]">
        {children}
      </div>
    </div>
  );
}
