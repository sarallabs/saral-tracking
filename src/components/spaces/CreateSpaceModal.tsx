"use client";

import { useState } from "react";
import { X, Lock, Globe, Plus, Minus } from "lucide-react";

const SPACE_ICONS = ["📁", "🚀", "💼", "📊", "🎯", "🛠️", "📚", "💡", "🔬", "🎨", "🌐", "⚡", "🏗️", "🎉", "🧩"];
const SPACE_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e",
  "#f97316", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

interface CreateSpaceModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateSpaceModal({ open, onClose, onCreated }: CreateSpaceModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("📁");
  const [color, setColor] = useState("#6366f1");
  const [isPrivate, setIsPrivate] = useState(false);
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [tag, setTag] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleNameChange = (v: string) => {
    setName(v);
    setSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  };

  const addCategory = () => {
    if (category.trim() && !categories.includes(category.trim())) {
      setCategories([...categories, category.trim()]);
      setCategory("");
    }
  };

  const addTag = () => {
    if (tag.trim() && !tags.includes(tag.trim())) {
      setTags([...tags, tag.trim()]);
      setTag("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, description, icon, color, isPrivate, categories, tags }),
    });

    if (res.ok) {
      onCreated();
      onClose();
      // reset
      setName(""); setSlug(""); setDescription(""); setIcon("📁"); setColor("#6366f1");
      setIsPrivate(false); setCategories([]); setTags([]);
    } else {
      const data = await res.json();
      setError(data.error?.message ?? "Failed to create space");
    }
    setSubmitting(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl animate-in overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[hsl(var(--border))] flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">Create a Space</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">A collaborative workspace for your team or project</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview */}
        <div className="px-6 pt-5">
          <div
            className="h-14 rounded-xl flex items-center px-4 gap-3 mb-4 relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${color}40, ${color}20)` }}
          >
            <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at 100% 0%, ${color}, transparent)` }} />
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xl relative" style={{ background: color }}>
              {icon}
            </div>
            <div className="relative">
              <p className="font-semibold text-sm">{name || "Space Name"}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{slug || "space-slug"}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Icon & Color */}
          <div className="flex gap-4">
            <div className="space-y-1.5 w-1/2">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Icon</label>
              <div className="flex flex-wrap gap-1.5">
                {SPACE_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${icon === ic ? "ring-2 ring-[hsl(var(--primary))] scale-110" : "hover:bg-[hsl(var(--secondary))]"}`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5 w-1/2">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Color</label>
              <div className="flex flex-wrap gap-1.5">
                {SPACE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full transition-all ${color === c ? "ring-2 ring-white scale-110" : "hover:scale-105"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Name *</label>
            <input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Marketing, Engineering"
              required
              className="input-field"
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">URL Slug *</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="marketing"
              required
              pattern="^[a-z0-9-]+$"
              className="input-field font-mono text-xs"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What's this space about?"
              className="input-field resize-none"
            />
          </div>

          {/* Categories */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Categories</label>
            <div className="flex gap-2">
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
                placeholder="e.g. Team, Project"
                className="input-field"
              />
              <button type="button" onClick={addCategory} className="btn-secondary px-3 py-2 shrink-0">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <span key={cat} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]">
                    {cat}
                    <button type="button" onClick={() => setCategories(categories.filter(c => c !== cat))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Tags</label>
            <div className="flex gap-2">
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="e.g. wiki, documentation"
                className="input-field"
              />
              <button type="button" onClick={addTag} className="btn-secondary px-3 py-2 shrink-0">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]">
                    #{t}
                    <button type="button" onClick={() => setTags(tags.filter(tg => tg !== t))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Privacy */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[hsl(var(--secondary))]/50 border border-[hsl(var(--border))]">
            <div className="flex items-center gap-2">
              {isPrivate ? <Lock className="w-4 h-4 text-amber-400" /> : <Globe className="w-4 h-4 text-emerald-400" />}
              <div>
                <p className="text-sm font-medium">{isPrivate ? "Private Space" : "Public Space"}</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  {isPrivate ? "Only invited members can access" : "All workspace members can see this space"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`w-10 h-5 rounded-full transition-colors relative ${isPrivate ? "bg-amber-500" : "bg-[hsl(var(--border))]"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isPrivate ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button type="submit" disabled={submitting || !name.trim()} className="btn-primary flex-1 justify-center">
              {submitting ? "Creating..." : "Create Space"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
