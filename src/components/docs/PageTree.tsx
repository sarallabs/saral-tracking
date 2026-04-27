"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, ChevronDown, FileText, Plus } from "lucide-react";
import { Page } from "@/lib/types";

interface PageTreeProps {
  pages: Page[];
  onPageCreated: () => void;
}

function PageNode({ page, allPages, depth = 0, onPageCreated }: { page: Page, allPages: Page[], depth?: number, onPageCreated: () => void }) {
  const router = useRouter();
  const params = useParams();
  const isActive = params.pageId === page.id;
  const [expanded, setExpanded] = useState(true);
  
  const children = useMemo(() => allPages.filter(p => p.parentId === page.id), [allPages, page.id]);

  const handleCreateSubpage = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled Page", parentId: page.id })
    });
    if (res.ok) {
      const data = await res.json();
      setExpanded(true);
      onPageCreated();
      router.push(`/docs/${data.page.id}`);
    }
  };

  return (
    <div className="select-none">
      <Link
        href={`/docs/${page.id}`}
        className={`group flex items-center justify-between py-1.5 px-2 rounded-lg text-sm transition-colors ${isActive ? "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] font-medium" : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]"}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          {children.length > 0 ? (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(!expanded); }}
              className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
            >
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <div className="w-4.5 h-4.5" />
          )}
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{page.title}</span>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCreateSubpage}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/20"
            title="Add subpage"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </Link>
      
      {expanded && children.map(child => (
        <PageNode key={child.id} page={child} allPages={allPages} depth={depth + 1} onPageCreated={onPageCreated} />
      ))}
    </div>
  );
}

export function PageTree({ pages, onPageCreated }: PageTreeProps) {
  const rootPages = useMemo(() => pages.filter(p => !p.parentId), [pages]);
  
  return (
    <div className="py-2 space-y-0.5">
      {rootPages.map(page => (
        <PageNode key={page.id} page={page} allPages={pages} onPageCreated={onPageCreated} />
      ))}
      {pages.length === 0 && (
        <div className="px-4 py-8 text-center">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">No pages found.</p>
        </div>
      )}
    </div>
  );
}
