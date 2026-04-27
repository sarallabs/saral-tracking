"use client";

import { useState, useEffect, useCallback, use } from "react";
import { History, Save, Trash2, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { TiptapEditor } from "@/components/docs/TiptapEditor";
import { VersionHistoryPanel } from "@/components/docs/VersionHistoryPanel";
import { Page } from "@/lib/types";

export default function PageEditor({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = use(params);
  const router = useRouter();
  const [page, setPage] = useState<Page | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedStatus, setSavedStatus] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchPage = useCallback(async () => {
    const res = await fetch(`/api/pages/${pageId}`);
    if (res.ok) {
      const data = await res.json();
      setPage(data.page);
      setTitle(data.page.title);
      setContent(data.page.content ?? "");
    }
  }, [pageId]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  const saveDraft = useCallback(async (newTitle: string, newContent: string) => {
    await fetch(`/api/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, content: newContent })
    });
  }, [pageId]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    saveDraft(e.target.value, content);
  };

  const handleContentChange = (newHtml: string) => {
    setContent(newHtml);
    saveDraft(title, newHtml);
  };

  const handleSaveVersion = async () => {
    setSaving(true);
    try {
      await fetch(`/api/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, saveVersion: true })
      });
      setSavedStatus(true);
      setTimeout(() => setSavedStatus(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this page?")) return;
    await fetch(`/api/pages/${pageId}`, { method: "DELETE" });
    router.push("/docs");
  };

  if (!page) return <div className="p-8 animate-pulse flex space-x-4"><div className="flex-1 space-y-4 py-1"><div className="h-4 bg-[hsl(var(--secondary))] rounded w-3/4"></div><div className="space-y-2"><div className="h-4 bg-[hsl(var(--secondary))] rounded"></div><div className="h-4 bg-[hsl(var(--secondary))] rounded w-5/6"></div></div></div></div>;

  return (
    <div className="max-w-4xl mx-auto px-8 py-10 animate-in">
      <div className="flex items-center justify-between mb-8">
        <input
          value={title}
          onChange={handleTitleChange}
          placeholder="Page Title"
          className="text-4xl font-bold bg-transparent border-none outline-none placeholder:text-[hsl(var(--muted-foreground))]/40 flex-1 mr-4 focus:ring-0"
        />
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowHistory(true)}
            className="btn-secondary"
          >
            <History className="w-4 h-4" />
            History
          </button>
          <button
            onClick={handleSaveVersion}
            disabled={saving}
            className="btn-primary min-w-[140px] justify-center transition-all"
          >
            {saving ? "Saving..." : savedStatus ? <><CheckCircle2 className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> Save Version</>}
          </button>
          <button
            onClick={handleDelete}
            className="p-2 ml-2 rounded-lg hover:bg-red-500/10 text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
            title="Delete Page"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <TiptapEditor content={content} onChange={handleContentChange} />

      <VersionHistoryPanel
        pageId={pageId}
        currentContent={content}
        open={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </div>
  );
}
