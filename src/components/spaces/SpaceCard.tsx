"use client";

import { Space } from "@/lib/types";
import Link from "next/link";
import { Users, Lock, Globe, ChevronRight } from "lucide-react";

interface SpaceCardProps {
  space: Space;
}

const SPACE_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
  "#3b82f6", "#6366f1",
];

export function SpaceCard({ space }: SpaceCardProps) {
  const color = space.color ?? "#6366f1";
  const categories: string[] = Array.isArray(space.categories)
    ? space.categories
    : JSON.parse((space.categories as unknown as string) ?? "[]");
  const tags: string[] = Array.isArray(space.tags)
    ? space.tags
    : JSON.parse((space.tags as unknown as string) ?? "[]");

  return (
    <Link
      href={`/spaces/${space.id}`}
      className="group relative bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden hover:border-[hsl(var(--primary))]/30 hover:shadow-lg hover:shadow-[hsl(var(--primary))]/5 transition-all duration-300"
    >
      {/* Color header */}
      <div
        className="h-16 relative flex items-end px-5 pb-0 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${color}40, ${color}20)` }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{ background: `radial-gradient(circle at 100% 0%, ${color}, transparent 60%)` }}
        />
        {/* Large icon */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-lg relative translate-y-6 shrink-0"
          style={{ background: color }}
        >
          {space.icon ?? "📁"}
        </div>
        {/* Privacy badge */}
        <div className="absolute top-3 right-3">
          {space.isPrivate ? (
            <div className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-black/30 text-white/80 backdrop-blur-sm">
              <Lock className="w-2.5 h-2.5" />
              Private
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-black/20 text-white/70 backdrop-blur-sm">
              <Globe className="w-2.5 h-2.5" />
              Public
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 pt-8">
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate group-hover:text-[hsl(var(--primary))] transition-colors">
              {space.name}
            </h3>
          </div>
          <ChevronRight className="w-4 h-4 text-[hsl(var(--muted-foreground))]/50 group-hover:text-[hsl(var(--primary))] group-hover:translate-x-0.5 transition-all shrink-0 ml-2 mt-0.5" />
        </div>

        {space.description && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 mb-3">
            {space.description}
          </p>
        )}

        {/* Categories */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {categories.slice(0, 2).map((cat) => (
              <span
                key={cat}
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: `${color}20`, color }}
              >
                {cat}
              </span>
            ))}
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 text-[10px] text-[hsl(var(--muted-foreground))] border-t border-[hsl(var(--border))]/50 pt-3 mt-1">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {space.memberCount ?? 0} member{(space.memberCount ?? 0) !== 1 ? "s" : ""}
          </span>
          {space.userRole && (
            <span className="ml-auto capitalize px-1.5 py-0.5 rounded bg-[hsl(var(--secondary))]">
              {space.userRole}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
