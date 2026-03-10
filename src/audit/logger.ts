import { prisma } from "@/db/prisma";

interface AuditPayload {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  before?: unknown;
  after?: unknown;
}

export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: payload.actorId ?? null,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId ?? null,
        ipAddress: payload.ipAddress ?? null,
        userAgent: payload.userAgent ?? null,
        before: payload.before ? JSON.parse(JSON.stringify(payload.before)) : null,
        after: payload.after ? JSON.parse(JSON.stringify(payload.after)) : null,
      },
    });
  } catch (err) {
    // Never let audit failures break the main flow
    console.error("Audit log write failed:", err);
  }
}
