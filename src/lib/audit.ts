// Shared audit log helper
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/schema";

export async function logAudit({
  workspaceId,
  actorId,
  actorEmail,
  action,
  entityType,
  entityId,
  entityName,
  metadata,
}: {
  workspaceId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    workspaceId: workspaceId ?? null,
    actorId: actorId ?? null,
    actorEmail: actorEmail ?? null,
    action,
    entityType: entityType ?? null,
    entityId: entityId ?? null,
    entityName: entityName ?? null,
    metadata: metadata ? JSON.stringify(metadata) : null,
  }).catch(() => {});
}
