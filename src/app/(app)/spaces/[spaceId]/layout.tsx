"use client";

import { useState, useEffect } from "react";
import { Plus, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageTree } from "@/components/docs/PageTree";
import { Page, Space } from "@/lib/types";
import Link from "next/link";

interface SpaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ spaceId: string }>;
}

export default function SpaceLayout({ children, params: paramsPromise }: SpaceLayoutProps) {
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [space, setSpace] = useState<Space | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const router = useRouter();

  useEffect(() => {
    paramsPromise.then((p) => setSpaceId(p.spaceId));
  }, [paramsPromise]);

  const fetchData = async () => {
    if (!spaceId) return;
    const [spaceRes, pagesRes] = await Promise.all([
      fetch(`/api/spaces/${spaceId}`),
      fetch(`/api/pages?spaceId=${spaceId}`),
    ]);
    if (spaceRes.ok) {
      const data = await spaceRes.json();
      setSpace(data.space);
    }
    if (pagesRes.ok) {
      const data = await pagesRes.json();
      setPages(data.pages ?? []);
    }
  };

  useEffect(() => {
    if (spaceId) fetchData();
  }, [spaceId]);

  const handleCreatePage = async () => {
    if (!spaceId) return;
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled Page", spaceId }),
    });
    if (res.ok) {
      const data = await res.json();
      fetchData();
      router.push(`/docs/${data.page.id}`);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Space sidebar */}
      <div className="w-64 border-r border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/20 flex flex-col shrink-0">
        {/* Space header */}
        <div className="p-4 border-b border-[hsl(var(--border))]">
          {space ? (
            <Link href={`/spaces/${spaceId}`} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity mb-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0"
                style={{ background: space.color ?? "#6366f1" }}
              >
                {space.icon ?? "📁"}
              </div>
              <span className="font-semibold text-sm truncate">{space.name}</span>
            </Link>
          ) : (
            <div className="h-8 bg-[hsl(var(--secondary))] rounded animate-pulse mb-3" />
          )}

          <div className="flex gap-1.5">
            <Link
              href={`/spaces/${spaceId}`}
              className="flex-1 text-[10px] px-2 py-1.5 rounded-lg bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/80 text-center transition-colors"
            >
              Overview
            </Link>
            <Link
              href={`/spaces/${spaceId}/blog`}
              className="flex-1 text-[10px] px-2 py-1.5 rounded-lg bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/80 text-center transition-colors"
            >
              Blog
            </Link>
          </div>
        </div>

        {/* Pages header */}
        <div className="px-4 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            <BookOpen className="w-3.5 h-3.5" />
            Pages
          </div>
          <button
            onClick={handleCreatePage}
            className="p-1 rounded hover:bg-[hsl(var(--secondary))] transition-colors"
            title="New Page"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Page tree */}
        <div className="flex-1 overflow-y-auto p-2">
          <PageTree pages={pages} onPageCreated={fetchData} spaceId={spaceId ?? undefined} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-[hsl(var(--background))]">
        {children}
      </div>
    </div>
  );
}
