"use client";

import { useState, useEffect, use } from "react";
import { BookOpen, Plus, Clock, Tag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Page, Space } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

export default function SpaceBlog({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = use(params);
  const router = useRouter();
  const [space, setSpace] = useState<Space | null>(null);
  const [blogPosts, setBlogPosts] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
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
        setBlogPosts((data.pages ?? []).filter((p: Page) => p.isBlogPost));
      }
      setLoading(false);
    };
    load();
  }, [spaceId]);

  const handleCreateBlogPost = async () => {
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled Post", spaceId, isBlogPost: true }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/docs/${data.page.id}`);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-[hsl(var(--secondary))] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-8 animate-in">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${space?.color ?? "#6366f1"}30` }}
          >
            <BookOpen className="w-5 h-5" style={{ color: space?.color ?? "#6366f1" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Blog</h1>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{space?.name} · {blogPosts.length} posts</p>
          </div>
        </div>
        <button onClick={handleCreateBlogPost} className="btn-primary text-sm">
          <Plus className="w-4 h-4" />
          New Post
        </button>
      </div>

      {blogPosts.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[hsl(var(--border))] rounded-2xl">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-[hsl(var(--muted-foreground))]/30" />
          <h3 className="font-semibold mb-2">No blog posts yet</h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
            Share updates, announcements, and insights with your team
          </p>
          <button onClick={handleCreateBlogPost} className="btn-primary">
            <Plus className="w-4 h-4" />
            Write First Post
          </button>
        </div>
      ) : (
        <div className="max-w-3xl space-y-5">
          {blogPosts
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .map((post) => (
              <Link
                key={post.id}
                href={`/docs/${post.id}`}
                className="group block p-6 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl hover:border-[hsl(var(--primary))]/30 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex items-start gap-4">
                  <span className="text-3xl shrink-0">{post.emoji ?? "📝"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h2 className="font-semibold text-base group-hover:text-[hsl(var(--primary))] transition-colors truncate">
                        {post.title}
                      </h2>
                      {!post.isPublished && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium shrink-0">
                          DRAFT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[hsl(var(--muted-foreground))]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(post.updatedAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
