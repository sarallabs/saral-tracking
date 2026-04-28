import { MessageSquare, ArrowLeft } from "lucide-react";

export const metadata = { title: "Chat" };

export default function ChannelsEmptyPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center animate-in">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))]/20 to-violet-500/20 flex items-center justify-center mb-6">
        <MessageSquare className="w-8 h-8 text-[hsl(var(--primary))]" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Channels & Chat</h1>
      <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-sm mx-auto mb-8">
        Communicate with your team in real-time, create threads, and collaborate seamlessly.
      </p>
      
      <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] px-4 py-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30">
        <ArrowLeft className="w-4 h-4" />
        Select a channel from the sidebar to start chatting
      </div>
    </div>
  );
}
