import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "pending",
  "suspended",
]);

export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "archived",
  "completed",
]);

export const issueTypeEnum = pgEnum("issue_type", [
  "task",
  "bug",
  "story",
  "epic",
]);

export const issueStatusEnum = pgEnum("issue_status", [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "cancelled",
]);

export const issuePriorityEnum = pgEnum("issue_priority", [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
]);

export const entityTypeEnum = pgEnum("entity_type", [
  "issue",
  "page",
  "message",
  "project",
  "channel",
]);

export const spaceRoleEnum = pgEnum("space_role", [
  "admin",
  "editor",
  "viewer",
]);

export const pageStatusEnum = pgEnum("page_status", [
  "draft",
  "published",
]);

export const pageAccessEnum = pgEnum("page_access", [
  "workspace",
  "space",
  "restricted",
]);

// ─── Workspaces ──────────────────────────────────────────────────────────────

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Spaces ───────────────────────────────────────────────────────────────────

export const spaces = pgTable(
  "spaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    icon: text("icon").default("📁"),
    color: text("color").default("#6366f1"),
    isPrivate: boolean("is_private").notNull().default(false),
    categories: text("categories").default("[]"), // JSON array of category strings
    tags: text("tags").default("[]"), // JSON array of tag strings
    homepageId: uuid("homepage_id"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("space_workspace_idx").on(t.workspaceId)]
);

export const spaceMembers = pgTable(
  "space_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: spaceRoleEnum("role").notNull().default("viewer"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => [
    index("space_member_idx").on(t.spaceId, t.userId),
    uniqueIndex("space_member_unique").on(t.spaceId, t.userId),
  ]
);

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash"),
  status: userStatusEnum("status").notNull().default("pending"),
  isGlobalAdmin: boolean("is_global_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── NextAuth Accounts ───────────────────────────────────────────────────────

export const accounts = pgTable("accounts", {
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (account) => [
  {
    pk: { columns: [account.provider, account.providerAccountId], name: "accounts_provider_pk" }
  }
]);

// ─── NextAuth Sessions ────────────────────────────────────────────────────────

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

// ─── NextAuth Verification Tokens ────────────────────────────────────────────

export const verificationTokens = pgTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [{ pk: { columns: [vt.identifier, vt.token], name: "verification_tokens_pk" } }]
);

// ─── Memberships ─────────────────────────────────────────────────────────────

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => [index("membership_user_workspace_idx").on(t.userId, t.workspaceId)]
);

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    key: text("key").notNull(), // e.g. "SOPS", "DEV"
    description: text("description"),
    status: projectStatusEnum("status").notNull().default("active"),
    ownerId: uuid("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    coverColor: text("cover_color").default("#6366f1"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("project_workspace_idx").on(t.workspaceId)]
);

export const projectMembers = pgTable("project_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: workspaceRoleEnum("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// ─── Issues ───────────────────────────────────────────────────────────────────

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    type: issueTypeEnum("type").notNull().default("task"),
    status: issueStatusEnum("status").notNull().default("backlog"),
    priority: issuePriorityEnum("priority").notNull().default("medium"),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reporterId: uuid("reporter_id").references(() => users.id, {
      onDelete: "set null",
    }),
    parentId: uuid("parent_id"),
    dueDate: timestamp("due_date"),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("issue_project_idx").on(t.projectId)]
);

export const issueLabels = pgTable("issue_labels", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueId: uuid("issue_id")
    .notNull()
    .references(() => issues.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  color: text("color").default("#6366f1"),
});

// ─── Pages ────────────────────────────────────────────────────────────────────

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull().default("Untitled"),
    content: text("content").default(""),
    draftContent: text("draft_content"),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    parentId: uuid("parent_id"),
    slug: text("slug"),
    isPublished: boolean("is_published").notNull().default(false),
    status: pageStatusEnum("status").notNull().default("draft"),
    accessLevel: pageAccessEnum("access_level").notNull().default("workspace"),
    depth: integer("depth").notNull().default(0), // 0=root, 1=sub, 2=sub-sub (max)
    isBlogPost: boolean("is_blog_post").notNull().default(false),
    emoji: text("emoji").default("📄"),
    coverImage: text("cover_image"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("page_workspace_idx").on(t.workspaceId),
    index("page_space_idx").on(t.spaceId),
  ]
);

// ─── Page Access Grants (for restricted pages) ────────────────────────────────

export const pageAccessGrants = pgTable(
  "page_access_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    canEdit: boolean("can_edit").notNull().default(false),
    grantedAt: timestamp("granted_at").defaultNow().notNull(),
  },
  (t) => [
    index("page_grant_idx").on(t.pageId, t.userId),
    uniqueIndex("page_grant_unique").on(t.pageId, t.userId),
  ]
);

// ─── Page Comments ────────────────────────────────────────────────────────────

export const pageComments = pgTable(
  "page_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    content: text("content").notNull(),
    parentId: uuid("parent_id"), // for thread replies
    // Inline anchor
    anchorText: text("anchor_text"), // selected text this comment refers to
    anchorId: text("anchor_id"),    // optional unique id stamped on the selection
    isResolved: boolean("is_resolved").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("page_comment_page_idx").on(t.pageId)]
);

export const pageVersions = pgTable("page_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  pageId: uuid("page_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  authorId: uuid("author_id").references(() => users.id, {
    onDelete: "set null",
  }),
  versionNumber: integer("version_number").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Channels ─────────────────────────────────────────────────────────────────

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    isPrivate: boolean("is_private").notNull().default(false),
    isDm: boolean("is_dm").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("channel_workspace_idx").on(t.workspaceId)]
);

export const channelMembers = pgTable("channel_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// ─── Messages ─────────────────────────────────────────────────────────────────

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    content: text("content").notNull(),
    threadParentId: uuid("thread_parent_id"),
    isEdited: boolean("is_edited").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("message_channel_idx").on(t.channelId)]
);

export const messageReactions = pgTable("message_reactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Channel Reads (unread tracking) ─────────────────────────────────────────

export const channelReads = pgTable(
  "channel_reads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at").defaultNow().notNull(),
  },
  (t) => [
    index("channel_reads_idx").on(t.channelId, t.userId),
    uniqueIndex("channel_reads_unique").on(t.channelId, t.userId),
  ]
);

// ─── User Presence ────────────────────────────────────────────────────────────

export const userPresence = pgTable("user_presence", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("offline"),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
});


export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: entityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    content: text("content").notNull(),
    parentId: uuid("parent_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("comment_entity_idx").on(t.entityType, t.entityId)]
);

// ─── Attachments ──────────────────────────────────────────────────────────────

export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: entityTypeEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  filename: text("filename").notNull(),
  url: text("url").notNull(),
  size: integer("size"),
  mimeType: text("mime_type"),
  uploadedBy: uuid("uploaded_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Notifications ────────────────────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    entityType: entityTypeEnum("entity_type"),
    entityId: uuid("entity_id"),
    title: text("title").notNull(),
    body: text("body"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("notification_user_idx").on(t.userId)]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  memberships: many(memberships),
  projectMembers: many(projectMembers),
  spaceMembers: many(spaceMembers),
  notifications: many(notifications),
}));

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  memberships: many(memberships),
  projects: many(projects),
  pages: many(pages),
  channels: many(channels),
  spaces: many(spaces),
}));

export const spacesRelations = relations(spaces, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [spaces.workspaceId], references: [workspaces.id] }),
  createdBy: one(users, { fields: [spaces.createdBy], references: [users.id] }),
  members: many(spaceMembers),
  pages: many(pages),
}));

export const spaceMembersRelations = relations(spaceMembers, ({ one }) => ({
  space: one(spaces, { fields: [spaceMembers.spaceId], references: [spaces.id] }),
  user: one(users, { fields: [spaceMembers.userId], references: [users.id] }),
}));

export const pageCommentsRelations = relations(pageComments, ({ one }) => ({
  page: one(pages, { fields: [pageComments.pageId], references: [pages.id] }),
  author: one(users, { fields: [pageComments.authorId], references: [users.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  issues: many(issues),
  members: many(projectMembers),
  pages: many(pages),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  project: one(projects, {
    fields: [issues.projectId],
    references: [projects.id],
  }),
  assignee: one(users, {
    fields: [issues.assigneeId],
    references: [users.id],
  }),
  reporter: one(users, {
    fields: [issues.reporterId],
    references: [users.id],
  }),
  labels: many(issueLabels),
  comments: many(comments),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [channels.workspaceId],
    references: [workspaces.id],
  }),
  members: many(channelMembers),
  messages: many(messages),
}));

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorEmail: text("actor_email"),
    action: text("action").notNull(), // e.g. user.approve, user.suspend, project.create
    entityType: text("entity_type"), // user | project | issue | channel | workspace
    entityId: text("entity_id"),
    entityName: text("entity_name"),
    metadata: text("metadata"), // JSON string for extra context
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("audit_logs_workspace_idx").on(t.workspaceId)]
);

// ─── Password Reset Tokens ────────────────────────────────────────────────────

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
