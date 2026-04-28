// Dev-only seed API — creates test user rahman@saralvidhya.com
// Only runs in development mode
export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { users, workspaces, channels, channelMembers, spaces, spaceMembers, pages, pageVersions, messages, projects, projectMembers, issues } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
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

  if (workspaceId) {
    // Ensure default channels exist
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
        .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)))
        .limit(1);

      if (isMember.length === 0) {
        await db.insert(channelMembers).values({ channelId, userId });
      }

      // Add a dummy message
      const existingMsgs = await db.select().from(messages).where(eq(messages.channelId, channelId)).limit(1);
      if (existingMsgs.length === 0) {
        await db.insert(messages).values({
          channelId,
          authorId: userId,
          content: `<p>Welcome to the <strong>#${ch.name}</strong> channel!</p>`,
        });
      }
    }

    // Ensure spaces exist
    const defaultSpaces = [
      { name: "Engineering", slug: "engineering", description: "Tech specs and architecture", icon: "🛠️", color: "#3b82f6", categories: '["Engineering"]', tags: '["tech", "code"]' },
      { name: "Marketing", slug: "marketing", description: "Campaigns and assets", icon: "📢", color: "#ec4899", categories: '["Marketing"]', tags: '["campaigns", "assets"]' },
      { name: "HR & People", slug: "hr", description: "Policies and onboarding", icon: "👥", color: "#22c55e", categories: '["HR"]', tags: '["policies"]' }
    ];

    for (const sp of defaultSpaces) {
      const existingSpace = await db.select().from(spaces).where(eq(spaces.slug, sp.slug)).limit(1);
      let spaceId: string;
      if (existingSpace.length === 0) {
        const [created] = await db.insert(spaces).values({
          workspaceId,
          name: sp.name,
          slug: sp.slug,
          description: sp.description,
          icon: sp.icon,
          color: sp.color,
          categories: sp.categories,
          tags: sp.tags,
          createdBy: userId,
        }).returning();
        spaceId = created.id;
      } else {
        spaceId = existingSpace[0].id;
      }

      // Add member
      const isSpaceMember = await db.select().from(spaceMembers).where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, userId))).limit(1);
      if (isSpaceMember.length === 0) {
        await db.insert(spaceMembers).values({ spaceId, userId, role: "admin" });
      }

      // Create some pages in this space
      const existingPages = await db.select().from(pages).where(eq(pages.spaceId, spaceId)).limit(1);
      if (existingPages.length === 0) {
        const [mainPage] = await db.insert(pages).values({
          workspaceId,
          spaceId,
          title: `${sp.name} Overview`,
          content: `<h1>${sp.name} Overview</h1><p>Welcome to the ${sp.name} space. Here is the documentation.</p>`,
          authorId: userId,
          status: "published",
          isPublished: true,
          accessLevel: "workspace",
          depth: 0,
          emoji: "📚"
        }).returning();

        await db.insert(pageVersions).values({
          pageId: mainPage.id,
          content: mainPage.content!,
          authorId: userId,
          versionNumber: 1
        });

        // Subpage
        const [subPage] = await db.insert(pages).values({
          workspaceId,
          spaceId,
          title: `Project Architecture`,
          content: `<h1>Project Architecture</h1><p>System design documents.</p><ul><li>Frontend: React</li><li>Backend: Next.js</li></ul>`,
          authorId: userId,
          parentId: mainPage.id,
          status: "published",
          isPublished: true,
          accessLevel: "workspace",
          depth: 1,
          emoji: "🏗️"
        }).returning();

        await db.insert(pageVersions).values({
          pageId: subPage.id,
          content: subPage.content!,
          authorId: userId,
          versionNumber: 1
        });

        // Blog post
        const [blogPost] = await db.insert(pages).values({
          workspaceId,
          spaceId,
          title: `Welcome to ${sp.name}`,
          content: `<h1>Welcome!</h1><p>We are launching our new space today.</p>`,
          authorId: userId,
          status: "published",
          isPublished: true,
          accessLevel: "workspace",
          depth: 0,
          isBlogPost: true,
          emoji: "📢"
        }).returning();

        await db.insert(pageVersions).values({
          pageId: blogPost.id,
          content: blogPost.content!,
          authorId: userId,
          versionNumber: 1
        });
      }
    }

    // Ensure projects and issues exist
    const defaultProjects = [
      { name: "Frontend Overhaul", key: "FE", description: "Revamping the web interface", color: "#8b5cf6" },
      { name: "Backend APIs", key: "API", description: "Building core microservices", color: "#f59e0b" },
    ];

    for (const proj of defaultProjects) {
      const existingProj = await db.select().from(projects).where(eq(projects.key, proj.key)).limit(1);
      let projectId: string;
      
      if (existingProj.length === 0) {
        const [created] = await db.insert(projects).values({
          workspaceId,
          name: proj.name,
          key: proj.key,
          description: proj.description,
          coverColor: proj.color,
          ownerId: userId,
        }).returning();
        projectId = created.id;
      } else {
        projectId = existingProj[0].id;
      }

      // Add project member
      const isProjectMember = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))).limit(1);
      if (isProjectMember.length === 0) {
        await db.insert(projectMembers).values({ projectId, userId, role: "admin" });
      }

      // Add some sample issues
      const existingIssues = await db.select().from(issues).where(eq(issues.projectId, projectId)).limit(1);
      if (existingIssues.length === 0) {
        await db.insert(issues).values([
          {
            projectId,
            title: `Setup Initial Architecture for ${proj.name}`,
            description: "Define the core file structure and basic dependencies.",
            type: "epic",
            status: "in_progress",
            priority: "high",
            assigneeId: userId,
            reporterId: userId,
          },
          {
            projectId,
            title: `Implement authentication logic`,
            description: "Use NextAuth to securely log users in.",
            type: "task",
            status: "todo",
            priority: "urgent",
            assigneeId: userId,
            reporterId: userId,
          },
          {
            projectId,
            title: `Fix UI glitch on mobile`,
            description: "The navigation bar overflows on screens smaller than 320px.",
            type: "bug",
            status: "backlog",
            priority: "medium",
            assigneeId: userId,
            reporterId: userId,
          }
        ]);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    message: `Seeded user ${email} with password ${password}, spaces, pages, channels, projects, and issues.`,
    userId,
    workspaceId,
  });
}
