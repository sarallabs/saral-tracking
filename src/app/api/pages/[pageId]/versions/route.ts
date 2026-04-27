export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pageVersions, users } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  const versions = await db
    .select({
      id: pageVersions.id,
      content: pageVersions.content,
      versionNumber: pageVersions.versionNumber,
      createdAt: pageVersions.createdAt,
      authorName: users.name,
      authorEmail: users.email,
      authorImage: users.image,
    })
    .from(pageVersions)
    .leftJoin(users, eq(pageVersions.authorId, users.id))
    .where(eq(pageVersions.pageId, pageId))
    .orderBy(desc(pageVersions.versionNumber));

  return NextResponse.json({ versions });
}
