"use client";

import { useState, useEffect } from "react";
import { X, Clock, ArrowLeft, ArrowRight } from "lucide-react";
import { PageVersion } from "@/lib/types";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import * as Diff from 'diff';

interface VersionHistoryPanelProps {
  pageId: string;
  currentContent: string;
  open: boolean;
  onClose: () => void;
}

export function VersionHistoryPanel({ pageId, currentContent, open, onClose }: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<PageVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<PageVersion | null>(null);

  useEffect(() => {
    if (open) {
      fetchVersions();
    }
  }, [open, pageId]);

  async function fetchVersions() {
    setLoading(true);
    try {
      const res = await fetch(`/api/pages/${pageId}/versions`);
      const data = await res.json();
      setVersions(data.versions ?? []);
      if (data.versions?.length > 0) {
        setSelectedVersion(data.versions[0]);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  let diffElements = null;
  if (selectedVersion) {
    const diffs = Diff.diffWords(selectedVersion.content, currentContent);
    diffElements = diffs.map((part, index) => {
      if (part.added) return <span key={index} className="bg-green-500/20 text-green-700 dark:text-green-300 rounded px-1">{part.value}</span>;
      if (part.removed) return <span key={index} className="bg-red-500/20 text-red-700 dark:text-red-300 rounded px-1 line-through">{part.value}</span>;
      return <span key={index} className="whitespace-pre-wrap">{part.value}</span>;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] shadow-2xl flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            <h2 className="font-semibold text-sm">Version History</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                <div className="h-10 bg-[hsl(var(--secondary))] rounded animate-pulse" />
                <div className="h-10 bg-[hsl(var(--secondary))] rounded animate-pulse" />
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {versions.map((ver) => (
                  <button
                    key={ver.id}
                    onClick={() => setSelectedVersion(ver)}
                    className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${selectedVersion?.id === ver.id ? "bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20" : "hover:bg-[hsl(var(--secondary))] border border-transparent"}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-[hsl(var(--foreground))]">Version {ver.versionNumber}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white shrink-0">
                        {ver.authorImage ? <img src={ver.authorImage} className="w-full h-full rounded-full" /> : <span className="font-medium">{getInitials(ver.authorName ?? ver.authorEmail)}</span>}
                      </div>
                      <span className="truncate">{ver.authorName ?? ver.authorEmail}</span>
                      <span>•</span>
                      <span>{formatRelativeTime(ver.createdAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Diff Viewer */}
          <div className="flex-1 flex flex-col bg-[hsl(var(--background))] overflow-hidden">
            <div className="p-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30 flex items-center justify-between shrink-0">
              <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Comparing with Current</span>
              <div className="flex gap-4 text-xs font-medium">
                <span className="text-red-500 flex items-center gap-1"><ArrowLeft className="w-3 h-3"/> Removed</span>
                <span className="text-green-500 flex items-center gap-1"><ArrowRight className="w-3 h-3"/> Added</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 font-mono text-xs leading-relaxed break-words">
              {diffElements}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
