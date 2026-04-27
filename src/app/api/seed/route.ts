// Dev-only seed API — creates test user rahman@saralvidhya.com
// Only runs in development mode
export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { users, memberships, workspaces, channels, channelMembers } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ensureDefaultWorkspace } from "@/lib/auth";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Only available in development" }, { status: 403 });
  }

  const email = "rahman@saralvidhya.com";
  const password = "rahman@1234";
  const name = "Rahman";

  // Check if exists
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

  let userId: string;

  if (existing.length > 0) {
    userId = existing[0].id;
    // Update password hash
    const hash = await bcrypt.hash(password, 12);
    await db.update(users).set({ passwordHash: hash, status: "active", isGlobalAdmin: true }).where(eq(users.id, userId));
  } else {
    const hash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(users).values({
      email,
      name,
      passwordHash: hash,
      status: "active",
      isGlobalAdmin: true,
      emailVerified: new Date(),
    }).returning();
    userId = user.id;
  }

  // Ensure workspace membership
  const workspaceId = await ensureDefaultWorkspace(userId, name, email);

  // Ensure default channels exist
  if (workspaceId) {
    const defaultChannels = [
      { name: "general", description: "General discussion for the whole team" },
      { name: "engineering", description: "Engineering team channel" },
      { name: "announcements", description: "Important announcements" },
      { name: "random", description: "Fun stuff, water cooler" },
    ];

    for (const ch of defaultChannels) {
      const exists = await db
        .select()
        .from(channels)
        .where(eq(channels.name, ch.name))
        .limit(1);

      let channelId: string;
      if (exists.length === 0) {
        const [created] = await db.insert(channels).values({
          workspaceId,
          name: ch.name,
          description: ch.description,
          createdBy: userId,
        }).returning();
        channelId = created.id;
      } else {
        channelId = exists[0].id;
      }

      // Add user to channel if not member
      const isMember = await db
        .select()
        .from(channelMembers)
        .where(eq(channelMembers.channelId, channelId))
        .limit(1);

      if (isMember.length === 0) {
        await db.insert(channelMembers).values({ channelId, userId });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    message: `Seeded user ${email} with password ${password}`,
    userId,
    workspaceId,
  });
}
