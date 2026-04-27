import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens, workspaces, memberships } from "@/lib/schema";
import { isAutoApprovedEmail } from "@/lib/utils";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: { params: { prompt: "select_account" } },
    }),
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user?.passwordHash) return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
        if (user.status === "suspended") return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      // Credentials provider — skip DrizzleAdapter flow
      if (account?.provider === "credentials") return true;

      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);

      if (existing.length === 0) {
        const status = isAutoApprovedEmail(user.email) ? "active" : "pending";
        (user as { pendingStatus?: string }).pendingStatus = status;
      } else {
        const dbUser = existing[0];
        if (dbUser.status === "suspended") return false;
      }
      return true;
    },

    async jwt({ token, user }) {
      // On sign-in, persist user id into the JWT
      if (user?.id) token.sub = user.id;
      return token;
    },

    async session({ session, token }) {
      // token.sub is the user id (set by jwt callback above)
      const userId = token?.sub;
      if (!userId) return session;

      const dbUser = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (dbUser.length === 0) return session;
      const u = dbUser[0];

      if (u.status === "pending" && isAutoApprovedEmail(u.email)) {
        await db.update(users).set({ status: "active" }).where(eq(users.id, u.id));
        await ensureDefaultWorkspace(u.id, u.name ?? u.email, u.email);
      } else if (u.status === "active") {
        await ensureDefaultWorkspace(u.id, u.name ?? u.email, u.email);
      }

      session.user.id = u.id;
      session.user.name = u.name;
      session.user.image = u.image ?? u.avatarUrl ?? null;
      (session.user as { status?: string }).status = u.status;
      (session.user as { isGlobalAdmin?: boolean }).isGlobalAdmin = u.isGlobalAdmin;
      return session;
    },
  },
});

// ─── Ensure user has a workspace ─────────────────────────────────────────────

export async function ensureDefaultWorkspace(userId: string, name: string, email: string) {
  const existing = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);

  if (existing.length > 0) return existing[0].workspaceId;

  const domain = email.split("@")[1] ?? "saralvidhya.com";
  const slug = domain.replace(/\./g, "-");
  const workspaceName = domain.includes("sarallabs") ? "Saral Labs" : "Saral Vidhya";

  let workspace = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);

  if (workspace.length === 0) {
    const [created] = await db.insert(workspaces).values({ name: workspaceName, slug }).returning();
    workspace = [created];
  }

  const memberCount = await db.select().from(memberships).where(eq(memberships.workspaceId, workspace[0].id));

  await db.insert(memberships).values({
    userId,
    workspaceId: workspace[0].id,
    role: memberCount.length === 0 ? "owner" : "member",
  });

  return workspace[0].id;
}
