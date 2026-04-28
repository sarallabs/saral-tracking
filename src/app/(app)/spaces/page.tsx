"use client";

import { useState, useEffect } from "react";
import { Plus, Layers, Search, Filter } from "lucide-react";
import { SpaceCard } from "@/components/spaces/SpaceCard";
import { CreateSpaceModal } from "@/components/spaces/CreateSpaceModal";
import { Space } from "@/lib/types";

export default function SpacesPage() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);

  const fetchSpaces = async () => {
    setLoading(true);
    const res = await fetch("/api/spaces");
    if (res.ok) {
      const data = await res.json();
      setSpaces(data.spaces ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSpaces();
  }, []);

  // Collect all tags from all spaces
  const allTags = Array.from(new Set(spaces.flatMap((s) =>
    Array.isArray(s.tags) ? s.tags : JSON.parse((s.tags as unknown as string) ?? "[]")
  )));

  const filtered = spaces.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(q) ||
      (s.description ?? "").toLowerCase().includes(q);
    const tags: string[] = Array.isArray(s.tags) ? s.tags : JSON.parse((s.tags as unknown as string) ?? "[]");
    const matchesTag = !filterTag || tags.includes(filterTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="p-8 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Spaces</h1>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] ml-13">
            Collaborative workspaces for your teams and projects
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Space
        </button>
      </div>

      {/* Search & filter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search spaces..."
            className="input-field pl-9 text-sm"
          />
        </div>

        {allTags.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
            <div className="flex gap-1.5 flex-wrap">
              {allTags.slice(0, 6).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                    filterTag === tag
                      ? "bg-[hsl(var(--primary))] text-white"
                      : "bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]/80"
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-52 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-violet-500/10 to-blue-600/10 flex items-center justify-center">
            <Layers className="w-10 h-10 text-[hsl(var(--muted-foreground))]/30" />
          </div>
          <h3 className="font-semibold mb-2">
            {search || filterTag ? "No spaces match your search" : "No spaces yet"}
          </h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-5">
            {search || filterTag
              ? "Try adjusting your search or filters"
              : "Create your first space to organize your team's knowledge"}
          </p>
          {!search && !filterTag && (
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Create First Space
            </button>
          )}
        </div>
      )}

      {/* Space grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((space) => (
            <SpaceCard key={space.id} space={space} />
          ))}
        </div>
      )}

      <CreateSpaceModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchSpaces}
      />
    </div>
  );
}
