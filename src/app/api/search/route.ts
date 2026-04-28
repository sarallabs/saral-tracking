export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { issues, messages, users, pages, channels } from "@/lib/schema";
import { ilike, or, eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// GET /api/search?q=term&types=issues,messages,users
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: {} });

  const types = (url.searchParams.get("types") ?? "issues,messages,users,channels").split(",");

  const results: Record<string, unknown[]> = {};

  await Promise.all([
    // Issues
    types.includes("issues") && (async () => {
      const rows = await db
        .select({
          id: issues.id,
          title: issues.title,
          status: issues.status,
          priority: issues.priority,
          type: issues.type,
          projectId: issues.projectId,
          createdAt: issues.createdAt,
        })
        .from(issues)
        .where(ilike(issues.title, `%${q}%`))
        .orderBy(desc(issues.createdAt))
        .limit(8);
      results.issues = rows;
    })(),

    // Messages
    types.includes("messages") && (async () => {
      const rows = await db
        .select({
          id: messages.id,
          content: messages.content,
          channelId: messages.channelId,
          createdAt: messages.createdAt,
          authorName: users.name,
          authorEmail: users.email,
        })
        .from(messages)
        .leftJoin(users, eq(messages.authorId, users.id))
        .where(ilike(messages.content, `%${q}%`))
        .orderBy(desc(messages.createdAt))
        .limit(8);
      results.messages = rows;
    })(),

    // Users
    types.includes("users") && (async () => {
      const rows = await db
        .select({ id: users.id, name: users.name, email: users.email, image: users.image, status: users.status })
        .from(users)
        .where(or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`)))
        .limit(6);
      results.users = rows;
    })(),

    // Channels
    types.includes("channels") && (async () => {
      const rows = await db
        .select({ id: channels.id, name: channels.name, description: channels.description })
        .from(channels)
        .where(ilike(channels.name, `%${q}%`))
        .limit(5);
      results.channels = rows;
    })(),
  ]);

  return NextResponse.json({ results, query: q });
}
