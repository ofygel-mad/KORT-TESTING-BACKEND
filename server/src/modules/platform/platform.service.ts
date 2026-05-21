// R4.2 — Product Platform API: business logic.
//
// Implements `server/PLATFORM_API_CONTRACT.md` v1 over KORT's existing models
// (Organization = tenant, Subscription = plan/status, Membership/User = people,
// AuditEvent = telemetry). No schema change: provisioning issues a one-time
// bootstrap token via the existing PasswordResetToken flow; impersonation
// issues a short-lived JWT.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';
import { prisma } from '../../lib/prisma.js';
import { hashPassword } from '../../lib/hash.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { recordAuditEvent } from '../../lib/audit.js';
import { signImpersonationToken } from '../../lib/jwt.js';
import { generateUniqueSlug } from '../auth/auth.service.js';
import { changePlan, getPlanDef } from '../subscriptions/subscriptions.service.js';
import { PLAN_CODES, DEFAULT_PLAN_CODE } from '../subscriptions/plans.js';

// ─── Product version (for /health) ────────────────────────────────────────────

const PRODUCT_VERSION: string = (() => {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(resolve(here, '../../../package.json'), 'utf8');
    const version = (JSON.parse(raw) as { version?: unknown }).version;
    return typeof version === 'string' ? version : 'unknown';
  } catch {
    return 'unknown';
  }
})();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the conflicting columns of a P2002 unique-constraint error, else null. */
function uniqueTarget(error: unknown): string[] | null {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = error.meta?.target;
    if (Array.isArray(target)) return target as string[];
    if (typeof target === 'string') return [target];
    return [];
  }
  return null;
}

/** Validates an optional planCode against system plans + PlanDefinition rows. */
async function resolvePlanCode(input?: string): Promise<string> {
  if (!input) return DEFAULT_PLAN_CODE;
  if (PLAN_CODES.includes(input)) return input;
  const known = await prisma.planDefinition.findUnique({ where: { code: input } });
  if (!known) throw new ValidationError(`Неизвестный тарифный план: «${input}».`);
  return input;
}

type SubscriptionRow = {
  planCode: string;
  status: string;
  periodStart: Date;
  periodEnd: Date | null;
  trialEndsAt: Date | null;
};

function serializeSubscription(sub: SubscriptionRow) {
  return {
    planCode: sub.planCode,
    status: sub.status,
    periodStart: sub.periodStart.toISOString(),
    periodEnd: sub.periodEnd?.toISOString() ?? null,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
  };
}

// ─── GET /platform/v1/health ──────────────────────────────────────────────────

export async function getHealth() {
  let db: 'ok' | 'down' = 'ok';
  let tenantCount = 0;
  try {
    await prisma.$queryRaw`SELECT 1`;
    tenantCount = await prisma.organization.count();
  } catch {
    db = 'down';
  }
  return {
    status: (db === 'ok' ? 'ok' : 'down') as 'ok' | 'degraded' | 'down',
    version: PRODUCT_VERSION,
    uptimeSec: Math.round(process.uptime()),
    db,
    tenantCount,
  };
}

// ─── GET /platform/v1/tenants ─────────────────────────────────────────────────

export async function listTenants(params: {
  search?: string;
  status?: string;
  plan?: string;
  page: number;
  limit: number;
}) {
  const where: Prisma.OrganizationWhereInput = {};
  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { slug: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  if (params.plan) where.mode = params.plan;
  if (params.status) where.subscription = { is: { status: params.status } };

  const [count, orgs] = await Promise.all([
    prisma.organization.count({ where }),
    prisma.organization.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      include: {
        subscription: true,
        memberships: {
          where: { status: 'active' },
          include: { user: { select: { email: true } } },
        },
      },
    }),
  ]);

  const orgIds = orgs.map((org) => org.id);
  const activity = orgIds.length
    ? await prisma.auditEvent.groupBy({
        by: ['orgId'],
        where: { orgId: { in: orgIds } },
        _max: { occurredAt: true },
      })
    : [];
  const lastActivity = new Map(
    activity.map((row) => [row.orgId, row._max.occurredAt]),
  );

  return {
    count,
    results: orgs.map((org) => {
      const owner = org.memberships.find((m) => m.isOwner);
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.subscription?.planCode ?? org.mode,
        status: org.subscription?.status ?? 'active',
        userCount: org.memberships.length,
        ownerEmail: owner?.user.email ?? null,
        createdAt: org.createdAt.toISOString(),
        lastActivityAt: lastActivity.get(org.id)?.toISOString() ?? null,
      };
    }),
  };
}

// ─── GET /platform/v1/tenants/:id ─────────────────────────────────────────────

export async function getTenant(id: string) {
  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      subscription: true,
      memberships: {
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true,
              status: true,
              lastLoginAt: true,
            },
          },
          role: { select: { key: true, name: true } },
        },
      },
    },
  });
  if (!org) throw new NotFoundError('Tenant', id);

  const planCode = org.subscription?.planCode ?? org.mode;
  const plan = await getPlanDef(planCode);
  const active = org.memberships.filter((m) => m.status === 'active');

  const serializeMember = (m: (typeof active)[number]) => ({
    membershipId: m.id,
    userId: m.user.id,
    fullName: m.user.fullName,
    email: m.user.email,
    phone: m.user.phone,
    isOwner: m.isOwner,
    role: m.role ? { key: m.role.key, name: m.role.name } : null,
    accountStatus: m.employeeAccountStatus,
    lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
  });

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: planCode,
    status: org.subscription?.status ?? 'active',
    createdAt: org.createdAt.toISOString(),
    subscription: org.subscription ? serializeSubscription(org.subscription) : null,
    planDetail: {
      code: plan.code,
      name: plan.name,
      description: plan.description,
      rank: plan.rank,
      maxUsers: plan.maxUsers,
      features: plan.features,
    },
    userCount: active.length,
    owners: active.filter((m) => m.isOwner).map(serializeMember),
    employees: active.filter((m) => !m.isOwner).map(serializeMember),
  };
}

// ─── PATCH /platform/v1/tenants/:id ───────────────────────────────────────────

export async function patchTenant(
  id: string,
  body: { planCode?: string; status?: 'active' | 'suspended' },
  actor: string | null,
) {
  const org = await prisma.organization.findUnique({
    where: { id },
    include: { subscription: true },
  });
  if (!org) throw new NotFoundError('Tenant', id);

  // changePlan validates the planCode, upserts the Subscription and keeps
  // Organization.mode in sync (throws ValidationError on an unknown plan).
  if (body.planCode) {
    await changePlan(id, body.planCode);
  }

  if (body.status) {
    await prisma.subscription.upsert({
      where: { orgId: id },
      create: {
        orgId: id,
        planCode: body.planCode ?? org.subscription?.planCode ?? org.mode,
        status: body.status,
      },
      update: { status: body.status },
    });
  }

  recordAuditEvent({
    type: 'business',
    action: 'platform.tenant.update',
    orgId: id,
    metadata: {
      planCode: body.planCode ?? null,
      status: body.status ?? null,
      actor,
    },
  });

  return getTenant(id);
}

// ─── POST /platform/v1/tenants (provisioning) ─────────────────────────────────

export async function createTenant(
  body: {
    companyName: string;
    ownerEmail: string;
    ownerFullName: string;
    planCode?: string;
  },
  actor: string | null,
) {
  const email = body.ownerEmail.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('Пользователь с таким email уже существует.');
  }

  const planCode = await resolvePlanCode(body.planCode);
  // The owner cannot log in until they consume the bootstrap token — seed an
  // unguessable random password so the account is inert in the meantime.
  const inertPassword = await hashPassword(nanoid(32));

  let provisioned: { orgId: string; bootstrapToken: string } | null = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      provisioned = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName: body.ownerFullName.trim(),
            email,
            password: inertPassword,
            status: 'pending',
          },
        });

        const slug = await generateUniqueSlug(body.companyName, tx);
        const org = await tx.organization.create({
          data: {
            name: body.companyName.trim(),
            slug,
            mode: planCode,
            currency: 'KZT',
          },
        });

        await tx.subscription.create({ data: { orgId: org.id, planCode } });

        await tx.membership.create({
          data: {
            userId: user.id,
            orgId: org.id,
            isOwner: true,
            status: 'active',
            source: 'company_registration',
            joinedAt: new Date(),
            employeeAccountStatus: 'active',
          },
        });

        // One-time bootstrap token: a PasswordResetToken the owner consumes via
        // POST /api/v1/auth/reset-password to set their first password.
        const bootstrapToken = nanoid(48);
        await tx.passwordResetToken.create({
          data: {
            userId: user.id,
            token: bootstrapToken,
            expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72h
          },
        });

        return { orgId: org.id, bootstrapToken };
      });
      break;
    } catch (error) {
      const target = uniqueTarget(error);
      if (target) {
        if (target.some((t) => t.includes('email'))) {
          throw new ConflictError('Пользователь с таким email уже существует.');
        }
        if (target.some((t) => t.includes('slug')) && attempt < 3) continue;
      }
      throw error;
    }
  }

  if (!provisioned) {
    throw new ConflictError('Не удалось создать тенанта. Попробуйте ещё раз.');
  }

  recordAuditEvent({
    type: 'business',
    action: 'platform.tenant.create',
    orgId: provisioned.orgId,
    metadata: { ownerEmail: email, planCode, actor },
  });

  return {
    tenant: await getTenant(provisioned.orgId),
    bootstrapToken: provisioned.bootstrapToken,
  };
}

// ─── POST /platform/v1/tenants/:id/impersonate ────────────────────────────────

export async function impersonateTenant(
  id: string,
  body: { actorPlatformUserId: string; reason: string; ttlSec?: number },
) {
  const org = await prisma.organization.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!org) throw new NotFoundError('Tenant', id);

  const owner = await prisma.membership.findFirst({
    where: { orgId: id, isOwner: true, status: 'active' },
    orderBy: { joinedAt: 'asc' },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!owner) throw new NotFoundError('Tenant owner', id);

  const ttlSec = Math.min(Math.max(body.ttlSec ?? 900, 60), 3600);
  const token = signImpersonationToken(
    {
      sub: owner.user.id,
      email: owner.user.email ?? '',
      orgId: id,
      act: body.actorPlatformUserId,
    },
    ttlSec,
  );
  const expiresAt = new Date(Date.now() + ttlSec * 1000);

  recordAuditEvent({
    type: 'security',
    action: 'platform.impersonate',
    orgId: id,
    userId: owner.user.id,
    metadata: {
      actorPlatformUserId: body.actorPlatformUserId,
      reason: body.reason,
      ttlSec,
    },
  });

  return {
    token,
    impersonated: true as const,
    tenantId: id,
    userId: owner.user.id,
    expiresAt: expiresAt.toISOString(),
  };
}

// ─── GET /platform/v1/metrics ─────────────────────────────────────────────────

export async function getMetrics(fromInput?: string, toInput?: string) {
  const to = toInput ? new Date(toInput) : new Date();
  const from = fromInput
    ? new Date(fromInput)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ValidationError('Параметры from/to должны быть датами ISO-8601.');
  }

  const range = { gte: from, lte: to };
  const [logins, failedLogins, requests, tenants, userPairs, loginByOrg, requestByOrg] =
    await Promise.all([
      prisma.auditEvent.count({ where: { type: 'login', occurredAt: range } }),
      prisma.auditEvent.count({ where: { type: 'login_failed', occurredAt: range } }),
      prisma.auditEvent.count({ where: { type: 'request', occurredAt: range } }),
      prisma.organization.count(),
      prisma.auditEvent.groupBy({
        by: ['orgId', 'userId'],
        where: { occurredAt: range, userId: { not: null } },
      }),
      prisma.auditEvent.groupBy({
        by: ['orgId'],
        where: { type: 'login', occurredAt: range },
        _count: { _all: true },
      }),
      prisma.auditEvent.groupBy({
        by: ['orgId'],
        where: { type: 'request', occurredAt: range },
        _count: { _all: true },
      }),
    ]);

  const activeUsers = new Set(userPairs.map((p) => p.userId)).size;

  // Per-tenant rollup.
  const byOrg = new Map<string, { logins: number; requests: number; activeUsers: number }>();
  const bucket = (orgId: string) => {
    let entry = byOrg.get(orgId);
    if (!entry) {
      entry = { logins: 0, requests: 0, activeUsers: 0 };
      byOrg.set(orgId, entry);
    }
    return entry;
  };
  for (const row of loginByOrg) if (row.orgId) bucket(row.orgId).logins = row._count._all;
  for (const row of requestByOrg) if (row.orgId) bucket(row.orgId).requests = row._count._all;
  for (const pair of userPairs) if (pair.orgId) bucket(pair.orgId).activeUsers += 1;

  const orgIds = [...byOrg.keys()];
  const orgRows = orgIds.length
    ? await prisma.organization.findMany({
        where: { id: { in: orgIds } },
        select: { id: true, name: true },
      })
    : [];
  const orgName = new Map(orgRows.map((o) => [o.id, o.name]));

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    totals: { tenants, activeUsers, logins, failedLogins, requests },
    byTenant: orgIds
      .map((orgId) => {
        const entry = byOrg.get(orgId)!;
        return {
          tenantId: orgId,
          name: orgName.get(orgId) ?? null,
          logins: entry.logins,
          requests: entry.requests,
          activeUsers: entry.activeUsers,
        };
      })
      .sort((a, b) => b.requests - a.requests),
  };
}
