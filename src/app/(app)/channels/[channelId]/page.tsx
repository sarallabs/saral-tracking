import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { channels } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { ChatArea } from "@/components/chat/ChatArea";

export default async function ChannelPage({ params }: { params: Promise<{ channelId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { channelId } = await params;
  
  const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
  if (!channel) notFound();

  return <ChatArea channel={channel as any} currentUserId={session.user.id} />;
}
