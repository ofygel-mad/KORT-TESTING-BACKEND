import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { config } from '../../config.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { signAccessToken, signRefreshToken } from '../../lib/jwt.js';
import { prisma } from '../../lib/prisma.js';
import { buildCapabilities } from '../auth/auth.service.js';

function safeCompare(provided: string, expected: string): boolean {
  const pa = Buffer.allocUnsafe(128);
  const pb = Buffer.allocUnsafe(128);
  pa.fill(0);
  pb.fill(0);
  Buffer.from(provided).copy(pa);
  Buffer.from(expected).copy(pb);
  return timingSafeEqual(pa, pb) && provided === expected;
}

const accessSchema = z.object({ password: z.string().min(1) });
const cleanOrgSchema = z.object({ password: z.string().min(1), orgId: z.string().min(1) });

type ServiceAccessBody = z.infer<typeof accessSchema>;
type ServiceAccessRequest = FastifyRequest<{ Body: ServiceAccessBody }>;

// R4.0 — the hardcoded `admin@kort.local` / `demo1234` bootstrap fallback was
// removed. The owner identity is now plain data: seed it via `prisma/seed.ts`
// (env-driven) or register a company. Service access only resolves an existing
// owner; it never conjures one from constants.
//
// R5 — this whole module is a dev-only backdoor superseded by the Control
// Plane (impersonation). It is registered only when ENABLE_SERVICE_ROUTES is
// explicitly set (see app.ts); production deploys never mount it.

export async function serviceRoutes(app: FastifyInstance) {
  const servicePassword = config.CONSOLE_SERVICE_PASSWORD;

  // POST /api/v1/service/access
  app.post('/access', async (request: ServiceAccessRequest, reply: FastifyReply) => {
    const body = accessSchema.parse(request.body);
    const expected = servicePassword;
    if (!expected || !safeCompare(body.password, expected)) {
      throw new UnauthorizedError('Access denied.');
    }

    const membership = await prisma.membership.findFirst({
      where: { isOwner: true, status: 'active' },
      include: { user: true, org: true },
      orderBy: { joinedAt: 'asc' },
    });

    if (!membership) {
      throw new UnauthorizedError(
        'No active owner found. Seed the database or create the first company before using service access.',
      );
    }

    const { user, org } = membership;
    const jti = nanoid();
    const access = signAccessToken({ sub: user.id, email: user.email ?? '' });
    const refresh = signRefreshToken({ sub: user.id, jti });

    await prisma.refreshToken.create({
      data: {
        id: jti,
        token: refresh,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const caps = buildCapabilities(true, true, []);

    return reply.send({
      access,
      refresh,
      user: {
        id: user.id,
        full_name: user.fullName,
        email: user.email,
        phone: user.phone,
        avatar_url: user.avatarUrl,
        status: user.status,
        is_owner: true,
        employee_permissions: [],
        account_status: 'active',
      },
      org: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        mode: org.mode,
        currency: org.currency,
        onboarding_completed: org.onboardingCompleted,
      },
      capabilities: caps,
      membership: {
        companyId: org.id,
        companyName: org.name,
        companySlug: org.slug,
        status: 'active',
        source: 'manual',
        requestId: null,
        inviteToken: null,
        joinedAt: membership.joinedAt?.toISOString() ?? new Date().toISOString(),
        updatedAt: membership.updatedAt.toISOString(),
      },
    });
  });

  // POST /api/v1/service/clean-org
  app.post('/clean-org', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = cleanOrgSchema.parse(request.body);
    if (!servicePassword || !safeCompare(body.password, servicePassword)) {
      throw new UnauthorizedError('Access denied.');
    }

    const org = await prisma.organization.findUnique({
      where: { id: body.orgId },
      select: { id: true, name: true },
    });
    if (!org) {
      return reply.status(404).send({ error: 'Org not found' });
    }

    // Delete in FK-safe order:
    // 1. chapanInvoice → cascades chapanInvoiceOrder (junction has no cascade from order side)
    // 2. chapanOrder → cascades items, payments, activities, productionTasks, unpaidAlerts, changeRequests
    // 3. leads, deals, tasks (have orgId directly)
    // 4. customers
    // 5. accounting
    const [invoices, orders, leads, deals, tasks, customers, entries, gaps] =
      await prisma.$transaction([
        prisma.invoice.deleteMany({ where: { orgId: body.orgId } }),
        prisma.order.deleteMany({ where: { orgId: body.orgId } }),
        prisma.lead.deleteMany({ where: { orgId: body.orgId } }),
        prisma.deal.deleteMany({ where: { orgId: body.orgId } }),
        prisma.task.deleteMany({ where: { orgId: body.orgId } }),
        prisma.customer.deleteMany({ where: { orgId: body.orgId } }),
        prisma.accountingEntry.deleteMany({ where: { orgId: body.orgId } }),
        prisma.accountingGap.deleteMany({ where: { orgId: body.orgId } }),
      ]);

    return reply.send({
      ok: true,
      org: org.name,
      deleted: {
        invoices: invoices.count,
        orders: orders.count,
        leads: leads.count,
        deals: deals.count,
        tasks: tasks.count,
        customers: customers.count,
        accountingEntries: entries.count,
        accountingGaps: gaps.count,
      },
    });
  });
}
