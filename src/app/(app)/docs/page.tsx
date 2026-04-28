import { FileText, ArrowLeft } from "lucide-react";

export const metadata = { title: "Docs" };

export default function DocsEmptyPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center animate-in">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))]/20 to-blue-500/20 flex items-center justify-center mb-6">
        <FileText className="w-8 h-8 text-[hsl(var(--primary))]" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Knowledge Base</h1>
      <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-sm mx-auto mb-8">
        Create nested documents, collaborate with your team, and track changes over time.
      </p>
      
      <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] px-4 py-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30">
        <ArrowLeft className="w-4 h-4" />
        Select a page from the sidebar to begin
      </div>
    </div>
  );
}
