import type { FastifyRequest } from 'fastify';
import { prisma } from './prisma.js';

// R4.1 — telemetry/audit layer. Events are written to the local `AuditEvent`
// stream; the Control Plane shipper (R4.4) later pushes unshipped rows out.

export type AuditEventType = 'login' | 'login_failed' | 'request' | 'business' | 'security';

export interface AuditEventInput {
  type: AuditEventType;
  action: string;
  orgId?: string | null;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget audit write. NEVER throws and NEVER blocks the caller —
 * a failure to record audit must not break the request path.
 */
export function recordAuditEvent(input: AuditEventInput): void {
  void prisma.auditEvent
    .create({
      data: {
        type: input.type,
        action: input.action,
        orgId: input.orgId ?? null,
        userId: input.userId ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        metadata: (input.metadata ?? undefined) as object | undefined,
      },
    })
    .catch(() => {
      /* audit failure is non-fatal — intentionally swallowed */
    });
}

/** Extracts IP + user-agent from a request for audit context. */
export function auditContext(request: FastifyRequest): {
  ip: string;
  userAgent: string | null;
} {
  const ua = request.headers['user-agent'];
  return {
    ip: request.ip,
    userAgent: typeof ua === 'string' ? ua : null,
  };
}
