"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  FolderKanban,
  MoreHorizontal,
  ChevronRight,
  Search,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  key: string;
  description: string | null;
  status: string;
  coverColor: string | null;
  createdAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerAvatar: string | null;
}

const PROJECT_COLORS = [
  "#6366f1", "#8b5cf6", "#06b6d4", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899", "#3b82f6",
];

function CreateProjectModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (p: Project) => void;
}) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auto-generate key from name
  useEffect(() => {
    if (name) {
      const generated = name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 4);
      setKey(generated || name.slice(0, 4).toUpperCase());
    }
  }, [name]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, key, description, coverColor: color }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage = typeof data.error === "string" 
          ? data.error 
          : data.error?.fieldErrors?.name?.[0] 
            ?? data.error?.fieldErrors?.key?.[0] 
            ?? data.error?.formErrors?.[0] 
            ?? "Failed to create project";
        setError(errorMessage);
        return;
      }

      onCreated(data.project);
      onClose();
      setName(""); setKey(""); setDescription(""); setColor(PROJECT_COLORS[0]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative glass rounded-2xl p-6 w-full max-w-md animate-in">
        <h2 className="text-lg font-semibold mb-5">Create New Project</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
              Project Name *
            </label>
            <input
              className="input-field"
              placeholder="e.g. Engineering Sprint"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
                Project Key *
              </label>
              <input
                className="input-field font-mono uppercase"
                placeholder="PROJ"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase().slice(0, 6).replace(/[^A-Z]/g, ""))}
                required
                maxLength={6}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
                Color
              </label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="w-5 h-5 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? "white" : "transparent",
                    }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
              Description
            </label>
            <textarea
              className="input-field resize-none"
              rows={3}
              placeholder="What is this project about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 justify-center"
            >
              {loading ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.key.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Projects</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            {projects.length} project{projects.length !== 1 ? "s" : ""} in your workspace
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        <input
          className="input-field pl-9"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-32 animate-pulse bg-[hsl(var(--secondary))]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <FolderKanban className="w-12 h-12 text-[hsl(var(--muted-foreground))]/30 mx-auto mb-4" />
          <h3 className="font-semibold mb-1">
            {search ? "No projects match your search" : "No projects yet"}
          </h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
            {search
              ? "Try a different search term"
              : "Create your first project to start tracking work"}
          </p>
          {!search && (
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="card hover:border-[hsl(var(--primary))]/40 transition-all duration-200 group cursor-pointer block"
            >
              {/* Cover bar */}
              <div
                className="h-1.5 w-full rounded-full mb-4 opacity-80"
                style={{ backgroundColor: project.coverColor ?? "#6366f1" }}
              />

              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                  style={{ backgroundColor: project.coverColor ?? "#6366f1" }}
                >
                  {project.key.slice(0, 2)}
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[hsl(var(--secondary))] transition-all"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <MoreHorizontal className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                </button>
              </div>

              <h3 className="font-semibold text-sm mb-1 group-hover:text-[hsl(var(--primary))] transition-colors">
                {project.name}
              </h3>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono mb-2">
                {project.key}
              </p>

              {project.description && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 mb-3">
                  {project.description}
                </p>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--border))]">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))] capitalize">
                    {project.status}
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]/40 group-hover:text-[hsl(var(--primary))] transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(p) => setProjects((prev) => [p, ...prev])}
      />
    </div>
  );
}
