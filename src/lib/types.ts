// Shared types used across issue components

export type IssueStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done" | "cancelled";
export type IssuePriority = "urgent" | "high" | "medium" | "low" | "none";
export type IssueType = "task" | "bug" | "story" | "epic";

export interface Issue {
  id: string;
  title: string;
  description: string | null;
  type: IssueType;
  status: IssueStatus;
  priority: IssuePriority;
  sortOrder: number | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  assigneeId: string | null;
  reporterId: string | null;
  parentId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  assigneeImage: string | null;
}

export interface Member {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
}

export interface Comment {
  id: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  authorId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  authorImage: string | null;
}

export const STATUS_CONFIG: Record<IssueStatus, { label: string; color: string; bg: string; dot: string }> = {
  backlog:     { label: "Backlog",     color: "text-slate-400",  bg: "bg-slate-500/10",  dot: "bg-slate-500" },
  todo:        { label: "Todo",        color: "text-blue-400",   bg: "bg-blue-500/10",   dot: "bg-blue-500" },
  in_progress: { label: "In Progress", color: "text-violet-400", bg: "bg-violet-500/10", dot: "bg-violet-500" },
  in_review:   { label: "In Review",   color: "text-amber-400",  bg: "bg-amber-500/10",  dot: "bg-amber-500" },
  done:        { label: "Done",        color: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
  cancelled:   { label: "Cancelled",   color: "text-red-400",    bg: "bg-red-500/10",    dot: "bg-red-500" },
};

export const PRIORITY_CONFIG: Record<IssuePriority, { label: string; color: string; icon: string }> = {
  urgent: { label: "Urgent", color: "text-red-400",    icon: "🔴" },
  high:   { label: "High",   color: "text-orange-400", icon: "🟠" },
  medium: { label: "Medium", color: "text-blue-400",   icon: "🔵" },
  low:    { label: "Low",    color: "text-slate-400",  icon: "⚪" },
  none:   { label: "None",   color: "text-slate-500",  icon: "⚫" },
};

export const TYPE_CONFIG: Record<IssueType, { label: string; icon: string; color: string }> = {
  task:  { label: "Task",  icon: "☑️",  color: "text-blue-400" },
  bug:   { label: "Bug",   icon: "🐛",  color: "text-red-400" },
  story: { label: "Story", icon: "📖", color: "text-violet-400" },
  epic:  { label: "Epic",  icon: "⚡", color: "text-amber-400" },
};

export const KANBAN_COLUMNS: IssueStatus[] = ["todo", "in_progress", "in_review", "done"];
export const ALL_STATUSES: IssueStatus[] = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"];

export interface Page {
  id: string;
  workspaceId: string;
  projectId: string | null;
  title: string;
  content: string | null;
  authorId: string | null;
  parentId: string | null;
  slug: string | null;
  isPublished: boolean;
  emoji: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageVersion {
  id: string;
  content: string;
  versionNumber: number;
  createdAt: string;
  authorName: string | null;
  authorEmail: string | null;
  authorImage: string | null;
}

export interface Channel {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  isDm: boolean;
  createdAt: string;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  userName?: string | null;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string | null;
  content: string;
  threadParentId: string | null;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  authorName: string | null;
  authorEmail: string | null;
  authorImage: string | null;
  reactions?: MessageReaction[];
  replyCount?: number;
}

