"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, ChevronDown, FileText, Plus, FileEdit } from "lucide-react";
import { Page } from "@/lib/types";

interface PageTreeProps {
  pages: Page[];
  onPageCreated: () => void;
  spaceId?: string;
}

function PageNode({
  page,
  allPages,
  depth = 0,
  onPageCreated,
  spaceId,
}: {
  page: Page;
  allPages: Page[];
  depth?: number;
  onPageCreated: () => void;
  spaceId?: string;
}) {
  const router = useRouter();
  const params = useParams();
  const isActive = params.pageId === page.id;
  const [expanded, setExpanded] = useState(true);

  const children = useMemo(() => allPages.filter((p) => p.parentId === page.id), [allPages, page.id]);
  const canAddChild = depth < 2; // max 3 levels (0, 1, 2)

  const handleCreateSubpage = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const body: Record<string, unknown> = { title: "Untitled Page", parentId: page.id };
    if (spaceId) body.spaceId = spaceId;
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
        className={`group flex items-center justify-between py-1.5 px-2 rounded-lg text-sm transition-colors ${
          isActive
            ? "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] font-medium"
            : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]"
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
          {children.length > 0 ? (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
            >
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <div className="w-4 h-4 shrink-0" />
          )}

          <span className="shrink-0 text-base leading-none">{page.emoji ?? "📄"}</span>
          <span className="truncate">{page.title}</span>

          {/* Draft badge */}
          {!page.isPublished && (
            <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium ml-1">
              DRAFT
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {canAddChild && (
            <button
              onClick={handleCreateSubpage}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/20"
              title={`Add subpage (level ${depth + 2})`}
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>
      </Link>

      {expanded && children.length > 0 && (
        <div className="animate-in">
          {children.map((child) => (
            <PageNode
              key={child.id}
              page={child}
              allPages={allPages}
              depth={depth + 1}
              onPageCreated={onPageCreated}
              spaceId={spaceId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PageTree({ pages, onPageCreated, spaceId }: PageTreeProps) {
  const rootPages = useMemo(() => pages.filter((p) => !p.parentId), [pages]);

  return (
    <div className="py-2 space-y-0.5">
      {rootPages.map((page) => (
        <PageNode
          key={page.id}
          page={page}
          allPages={pages}
          onPageCreated={onPageCreated}
          spaceId={spaceId}
        />
      ))}
      {pages.length === 0 && (
        <div className="px-4 py-8 text-center">
          <FileText className="w-6 h-6 mx-auto mb-2 text-[hsl(var(--muted-foreground))]/30" />
          <p className="text-xs text-[hsl(var(--muted-foreground))]">No pages yet.</p>
        </div>
      )}
    </div>
  );
}
