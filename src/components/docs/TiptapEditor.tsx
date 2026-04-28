"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Extension } from "@tiptap/core";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Image } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";
import { Underline } from "@tiptap/extension-underline";
import { Highlight } from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Placeholder } from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Link as LinkIcon,
  List, ListOrdered, CheckSquare, Heading1, Heading2, Heading3,
  Quote, Code, CodeSquare, Minus, Table as TableIcon, Image as ImageIcon,
  Undo, Redo, Highlighter, AlignLeft
} from "lucide-react";
import { useEffect, useRef, useCallback, useState } from "react";

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  editable?: boolean;
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function ToolbarButton({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-lg transition-all duration-150 disabled:opacity-30 ${
        active
          ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]"
          : "hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-[hsl(var(--border))] mx-1 shrink-0" />;
}

function MenuBar({ editor, onImageUpload }: { editor: ReturnType<typeof useEditor>; onImageUpload: () => void }) {
  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Enter URL:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30 rounded-t-xl sticky top-0 z-10">
      {/* History */}
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
        <Undo className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
        <Redo className="w-4 h-4" />
      </ToolbarButton>
      <Divider />

      {/* Headings */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
        <Heading1 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
        <Heading2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
        <Heading3 className="w-4 h-4" />
      </ToolbarButton>
      <Divider />

      {/* Text formatting */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
        <UnderlineIcon className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
        <Strikethrough className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} title="Highlight">
        <Highlighter className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={setLink} active={editor.isActive("link")} title="Link">
        <LinkIcon className="w-4 h-4" />
      </ToolbarButton>
      <Divider />

      {/* Lists */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List">
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Ordered List">
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} title="Task List">
        <CheckSquare className="w-4 h-4" />
      </ToolbarButton>
      <Divider />

      {/* Blocks */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
        <Quote className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline Code">
        <Code className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code Block">
        <CodeSquare className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Horizontal Rule">
        <Minus className="w-4 h-4" />
      </ToolbarButton>
      <Divider />

      {/* Table */}
      <ToolbarButton onClick={insertTable} active={editor.isActive("table")} title="Insert Table">
        <TableIcon className="w-4 h-4" />
      </ToolbarButton>

      {/* Image */}
      <ToolbarButton onClick={onImageUpload} active={false} title="Insert Image">
        <ImageIcon className="w-4 h-4" />
      </ToolbarButton>
    </div>
  );
}

// ─── Table Controls ───────────────────────────────────────────────────────────

function TableControls({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor || !editor.isActive("table")) return null;

  return (
    <div className="flex items-center gap-1 p-1.5 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-lg text-xs">
      <button onClick={() => editor.chain().focus().addColumnBefore().run()} className="px-2 py-1 rounded hover:bg-[hsl(var(--primary))]/10 transition-colors">+ Col Before</button>
      <button onClick={() => editor.chain().focus().addColumnAfter().run()} className="px-2 py-1 rounded hover:bg-[hsl(var(--primary))]/10 transition-colors">+ Col After</button>
      <button onClick={() => editor.chain().focus().addRowBefore().run()} className="px-2 py-1 rounded hover:bg-[hsl(var(--primary))]/10 transition-colors">+ Row Before</button>
      <button onClick={() => editor.chain().focus().addRowAfter().run()} className="px-2 py-1 rounded hover:bg-[hsl(var(--primary))]/10 transition-colors">+ Row After</button>
      <div className="w-px h-4 bg-[hsl(var(--border))]" />
      <button onClick={() => editor.chain().focus().deleteColumn().run()} className="px-2 py-1 rounded hover:bg-red-500/10 text-red-400 transition-colors">- Col</button>
      <button onClick={() => editor.chain().focus().deleteRow().run()} className="px-2 py-1 rounded hover:bg-red-500/10 text-red-400 transition-colors">- Row</button>
      <button onClick={() => editor.chain().focus().deleteTable().run()} className="px-2 py-1 rounded hover:bg-red-500/10 text-red-400 transition-colors">Delete Table</button>
    </div>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export function TiptapEditor({ content, onChange, editable = true }: TiptapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number } | null>(null);
  const [showBubble, setShowBubble] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-[hsl(var(--primary))] underline underline-offset-2" } }),
      Image.configure({ HTMLAttributes: { class: "rounded-lg max-w-full my-2" } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Start writing… type '/' for commands" }),
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[500px] p-6",
      },
    },
  });

  // Re-sync content if it changes externally (e.g., switching versions)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return;
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (res.ok) {
      const { url } = await res.json();
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    if (e.target) e.target.value = "";
  }, [handleImageUpload]);

  // Handle paste/drop images
  useEffect(() => {
    if (!editor) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) { e.preventDefault(); handleImageUpload(file); }
        }
      }
    };
    const el = editor.view.dom;
    el.addEventListener("paste", handlePaste);
    return () => el.removeEventListener("paste", handlePaste);
  }, [editor, handleImageUpload]);

  // Track text selection for bubble menu
  useEffect(() => {
    if (!editor || !editable) return;

    const updateBubble = () => {
      const { from, to } = editor.state.selection;
      if (from === to) { setShowBubble(false); return; }
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) { setShowBubble(false); return; }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0) { setShowBubble(false); return; }
      setSelectionRect({ top: rect.top + window.scrollY - 48, left: rect.left + rect.width / 2 });
      setShowBubble(true);
    };

    editor.on("selectionUpdate", updateBubble);
    document.addEventListener("selectionchange", updateBubble);
    return () => {
      editor.off("selectionUpdate", updateBubble);
      document.removeEventListener("selectionchange", updateBubble);
    };
  }, [editor, editable]);

  return (
    <div className="border border-[hsl(var(--border))] rounded-xl overflow-hidden bg-[hsl(var(--card))]">
      {editable && editor && (
        <>
          <MenuBar editor={editor} onImageUpload={() => fileInputRef.current?.click()} />
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
          {editor.isActive("table") && (
            <div className="px-3 py-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/20">
              <TableControls editor={editor} />
            </div>
          )}
        </>
      )}

      {/* Floating bubble menu on text selection */}
      {editable && editor && showBubble && selectionRect && (
        <div
          className="fixed z-50 flex items-center gap-0.5 p-1 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-xl animate-in"
          style={{
            top: selectionRect.top,
            left: selectionRect.left,
            transform: "translateX(-50%)",
          }}
        >
          <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }} className={`p-1.5 rounded text-sm font-bold transition-colors ${editor.isActive("bold") ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--secondary))]"}`}>B</button>
          <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }} className={`p-1.5 rounded text-sm italic transition-colors ${editor.isActive("italic") ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--secondary))]"}`}>I</button>
          <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }} className={`p-1.5 rounded text-sm underline transition-colors ${editor.isActive("underline") ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--secondary))]"}`}>U</button>
          <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }} className={`p-1.5 rounded text-sm line-through transition-colors ${editor.isActive("strike") ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--secondary))]"}`}>S</button>
          <div className="w-px h-4 bg-[hsl(var(--border))] mx-0.5" />
          <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHighlight().run(); }} className={`p-1.5 rounded transition-colors ${editor.isActive("highlight") ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--secondary))]"}`} title="Highlight">
            <Highlighter className="w-3.5 h-3.5" />
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              const url = window.prompt("URL:");
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }}
            className={`p-1.5 rounded transition-colors ${editor.isActive("link") ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--secondary))]"}`}
            title="Link"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <EditorContent editor={editor} />

      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground));
          opacity: 0.5;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror table {
          border-collapse: collapse;
          width: 100%;
          margin: 1rem 0;
          overflow-x: auto;
          display: block;
        }
        .ProseMirror table td, .ProseMirror table th {
          border: 1px solid hsl(var(--border));
          padding: 0.5rem 0.75rem;
          min-width: 60px;
          vertical-align: top;
          position: relative;
        }
        .ProseMirror table th {
          background: hsl(var(--secondary));
          font-weight: 600;
        }
        .ProseMirror table .selectedCell:after {
          background: hsl(var(--primary) / 0.15);
          content: "";
          left: 0; right: 0; top: 0; bottom: 0;
          pointer-events: none;
          position: absolute;
          z-index: 2;
        }
        .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
        }
        .ProseMirror ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }
        .ProseMirror ul[data-type="taskList"] li > label {
          flex: 0 0 auto;
          margin-top: 0.15rem;
          cursor: pointer;
        }
        .ProseMirror ul[data-type="taskList"] li > div {
          flex: 1 1 auto;
        }
        .ProseMirror ul[data-type="taskList"] input[type="checkbox"] {
          width: 1rem;
          height: 1rem;
          accent-color: hsl(var(--primary));
          cursor: pointer;
        }
        .ProseMirror a {
          color: hsl(var(--primary));
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .ProseMirror blockquote {
          border-left: 3px solid hsl(var(--primary));
          padding-left: 1rem;
          color: hsl(var(--muted-foreground));
          font-style: italic;
        }
        .ProseMirror code {
          background: hsl(var(--secondary));
          border-radius: 0.25rem;
          padding: 0.1em 0.3em;
          font-family: monospace;
          font-size: 0.85em;
        }
        .ProseMirror pre {
          background: hsl(var(--secondary));
          border-radius: 0.5rem;
          padding: 1rem;
          overflow-x: auto;
        }
        .ProseMirror pre code {
          background: none;
          padding: 0;
        }
        .ProseMirror img {
          border-radius: 0.5rem;
          max-width: 100%;
        }
      `}</style>
    </div>
  );
}
