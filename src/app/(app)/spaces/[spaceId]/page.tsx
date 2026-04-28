"use client";

import { useState, useEffect, use } from "react";
import {
  Plus, Lock, Globe, Users, Settings, FileText, BookOpen,
  ArrowRight, Clock, Edit3, Tag
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Space, Page, SpaceMember } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

export default function SpaceHomepage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = use(params);
  const router = useRouter();
  const [space, setSpace] = useState<Space | null>(null);
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
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
        setMembers(data.members ?? []);
        setUserRole(data.userRole);
      } else {
        router.push("/spaces");
        return;
      }

      if (pagesRes.ok) {
        const data = await pagesRes.json();
        setPages(data.pages ?? []);
      }

      setLoading(false);
    };
    load();
  }, [spaceId, router]);

  const handleCreatePage = async () => {
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled Page", spaceId }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/docs/${data.page.id}`);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-40 bg-[hsl(var(--secondary))] rounded-2xl" />
        <div className="h-8 bg-[hsl(var(--secondary))] rounded w-1/3" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-[hsl(var(--secondary))] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!space) return null;

  const categories: string[] = Array.isArray(space.categories)
    ? space.categories
    : JSON.parse((space.categories as unknown as string) ?? "[]");
  const tags: string[] = Array.isArray(space.tags)
    ? space.tags
    : JSON.parse((space.tags as unknown as string) ?? "[]");

  const recentPages = [...pages]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);

  const blogPosts = pages.filter((p) => p.isBlogPost);

  return (
    <div className="animate-in">
      {/* Hero banner */}
      <div
        className="relative h-48 flex items-end px-8 pb-6 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${space.color ?? "#6366f1"}60 0%, ${space.color ?? "#6366f1"}20 100%)` }}
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: `radial-gradient(ellipse at 80% 0%, ${space.color ?? "#6366f1"}, transparent 60%)` }}
        />
        <div className="relative flex items-end gap-5 w-full">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-xl"
            style={{ background: space.color ?? "#6366f1" }}
          >
            {space.icon ?? "📁"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{space.name}</h1>
              {space.isPrivate ? (
                <Lock className="w-4 h-4 text-amber-400" />
              ) : (
                <Globe className="w-4 h-4 text-emerald-400" />
              )}
            </div>
            {space.description && (
              <p className="text-sm text-[hsl(var(--foreground))]/70">{space.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleCreatePage} className="btn-primary text-sm">
              <Plus className="w-4 h-4" />
              New Page
            </button>
            {userRole === "admin" && (
              <Link href={`/spaces/${spaceId}/settings`} className="btn-secondary text-sm">
                <Settings className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {/* Categories & tags */}
        {(categories.length > 0 || tags.length > 0) && (
          <div className="flex flex-wrap items-center gap-3">
            {categories.map((cat) => (
              <span
                key={cat}
                className="text-xs px-3 py-1 rounded-full font-medium"
                style={{ background: `${space.color ?? "#6366f1"}20`, color: space.color ?? "#6366f1" }}
              >
                {cat}
              </span>
            ))}
            {tags.map((tag) => (
              <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Pages", value: pages.length, icon: FileText },
            { label: "Members", value: members.length, icon: Users },
            { label: "Blog Posts", value: blogPosts.length, icon: BookOpen },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="card flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${space.color ?? "#6366f1"}20` }}
              >
                <Icon className="w-5 h-5" style={{ color: space.color ?? "#6366f1" }} />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Recent pages */}
        {recentPages.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                <h2 className="font-semibold">Recent Pages</h2>
              </div>
              <Link href="#" className="text-xs text-[hsl(var(--primary))] hover:underline flex items-center gap-1">
                See all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {recentPages.map((page) => (
                <Link
                  key={page.id}
                  href={`/docs/${page.id}`}
                  className="group p-4 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl hover:border-[hsl(var(--primary))]/30 transition-all hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl shrink-0">{page.emoji ?? "📄"}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate group-hover:text-[hsl(var(--primary))] transition-colors">
                        {page.title}
                      </p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                        {formatDistanceToNow(new Date(page.updatedAt), { addSuffix: true })}
                        {!page.isPublished && (
                          <span className="ml-2 text-amber-400">· Draft</span>
                        )}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Members */}
        {members.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              <h2 className="font-semibold">Members</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {members.map((member) => {
                const initials = (member.name ?? member.email ?? "?")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                return (
                  <div key={member.id} className="flex items-center gap-2.5 px-3 py-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-medium overflow-hidden">
                      {member.image ? (
                        <img src={member.image} alt={member.name ?? ""} className="w-full h-full object-cover" />
                      ) : initials}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{member.name ?? member.email}</p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] capitalize">{member.role}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {pages.length === 0 && (
          <div className="text-center py-16 border border-dashed border-[hsl(var(--border))] rounded-2xl">
            <FileText className="w-10 h-10 mx-auto mb-3 text-[hsl(var(--muted-foreground))]/30" />
            <h3 className="font-semibold mb-2">No pages yet</h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
              Start documenting your team's knowledge
            </p>
            <button onClick={handleCreatePage} className="btn-primary">
              <Plus className="w-4 h-4" />
              Create First Page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
