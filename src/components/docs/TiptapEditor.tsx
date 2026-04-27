"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Quote, Undo, Redo, Code } from "lucide-react";
import { useEffect } from "react";

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  editable?: boolean;
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30 rounded-t-xl">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive("bold") ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--secondary))]"}`}
        title="Bold"
      ><Bold className="w-4 h-4" /></button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive("italic") ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--secondary))]"}`}
        title="Italic"
      ><Italic className="w-4 h-4" /></button>
      <button
        onClick={() => editor.chain().focus().toggleCode().run()}
        disabled={!editor.can().chain().focus().toggleCode().run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive("code") ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--secondary))]"}`}
        title="Code"
      ><Code className="w-4 h-4" /></button>
      
      <div className="w-px h-4 bg-[hsl(var(--border))] mx-1" />
      
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive("heading", { level: 1 }) ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--secondary))]"}`}
        title="Heading 1"
      ><Heading1 className="w-4 h-4" /></button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive("heading", { level: 2 }) ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--secondary))]"}`}
        title="Heading 2"
      ><Heading2 className="w-4 h-4" /></button>
      
      <div className="w-px h-4 bg-[hsl(var(--border))] mx-1" />
      
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive("bulletList") ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--secondary))]"}`}
        title="Bullet List"
      ><List className="w-4 h-4" /></button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive("orderedList") ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--secondary))]"}`}
        title="Ordered List"
      ><ListOrdered className="w-4 h-4" /></button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`p-1.5 rounded-lg transition-colors ${editor.isActive("blockquote") ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--secondary))]"}`}
        title="Blockquote"
      ><Quote className="w-4 h-4" /></button>
      
      <div className="flex-1" />
      
      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors disabled:opacity-30"
        title="Undo"
      ><Undo className="w-4 h-4" /></button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors disabled:opacity-30"
        title="Redo"
      ><Redo className="w-4 h-4" /></button>
    </div>
  );
};

export function TiptapEditor({ content, onChange, editable = true }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[400px] p-5",
      },
    },
  });

  // Re-sync content if it changes externally (like switching versions)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  return (
    <div className="border border-[hsl(var(--border))] rounded-xl overflow-hidden bg-[hsl(var(--card))]">
      {editable && <MenuBar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
