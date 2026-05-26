/**
 * P10f integration tests for service.routes.ts.
 *
 * serviceRoutes is a dev-only backdoor (only mounted when
 * ENABLE_SERVICE_ROUTES=true) with two endpoints:
 *   POST /access     — exchange the CONSOLE_SERVICE_PASSWORD for an owner
 *                      session (access + refresh JWT, capabilities, org).
 *   POST /clean-org  — admin reset for a single org's data (orders, leads,
 *                      deals, customers, accounting).
 *
 * Both endpoints share a constant-time password compare. These tests cover
 * the happy paths + the password-rejection path. The "no active owner" 401
 * branch in /access is tricky to isolate cleanly because the prisma test DB
 * is shared between suites, so we instead pin the wrong-password rejection.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { disconnectDatabase, prisma } from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { provisionOrganization } from '../../../lib/provisioning.js';
import { config } from '../../../config.js';
import { serviceRoutes } from '../service.routes.js';

type TestContext = {
  orgId: string;
  userId: string;
};

const createdOrgIds: string[] = [];
const createdUserIds: string[] = [];

async function createOwnerCtx(): Promise<TestContext> {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const result = await prisma.$transaction((tx) => provisionOrganization(tx, {
    ownerEmail: `svc-${token}@example.test`,
    ownerFullName: `Svc Owner ${token}`,
    ownerPasswordHash: 'hashed',
    ownerStatus: 'active',
    ownerPhone: null,
    companyName: `Svc Co ${token}`,
    planCode: 'free',
    membershipSource: 'company_registration',
  }));
  createdOrgIds.push(result.org.id);
  createdUserIds.push(result.user.id);
  return { orgId: result.org.id, userId: result.user.id };
}

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
      });
    }
    if (typeof error === 'object' && error !== null && 'validation' in error) {
      return reply.status(400).send({ message: 'validation' });
    }
    return reply.status(500).send({ error: String(error) });
  });
  await app.register(serviceRoutes, { prefix: '/api/v1/service' });
  await app.ready();
  return app;
}

describe('service.routes — access + clean-org', () => {
  let app: FastifyInstance;

  beforeAll(() => {
    // CONSOLE_SERVICE_PASSWORD is required for /access to ever succeed. The
    // test env sets it to 'test1234' (see .env.test).
    expect(config.CONSOLE_SERVICE_PASSWORD).toBeTruthy();
  });

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    if (createdOrgIds.length > 0) {
      await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
      createdOrgIds.length = 0;
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
    await disconnectDatabase();
  });

  // ── POST /access ───────────────────────────────────────────────────────

  it('POST /access rejects a wrong password with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/service/access',
      payload: { password: 'definitely-not-right' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /access with the right password returns a session for the first owner', async () => {
    // Seed at least one active owner so the route has someone to resolve.
    await createOwnerCtx();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/service/access',
      payload: { password: config.CONSOLE_SERVICE_PASSWORD },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json() as {
      access: string;
      refresh: string;
      user: { is_owner: boolean; account_status: string };
      org: { id: string; name: string };
      capabilities: unknown;
    };
    expect(body.access).toMatch(/^eyJ/);
    expect(body.refresh).toMatch(/^eyJ/);
    expect(body.user.is_owner).toBe(true);
    expect(body.user.account_status).toBe('active');
    expect(body.org.id).toBeTruthy();
    expect(body.capabilities).toBeDefined();
  });

  // ── POST /clean-org ────────────────────────────────────────────────────

  it('POST /clean-org rejects a wrong password with 401', async () => {
    const ctx = await createOwnerCtx();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/service/clean-org',
      payload: { password: 'nope', orgId: ctx.orgId },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /clean-org with right password wipes orders + accounting for the target org', async () => {
    const ctx = await createOwnerCtx();

    // Seed one order + one accounting entry.
    const { create: createOrderSvc } = await import('../../orders/orders.service.js');
    const { createEntry } = await import('../../accounting/accounting.service.js');
    await createOrderSvc(ctx.orgId, ctx.userId, 'Tester', {
      clientName: 'Clean Client',
      clientPhone: '+7 (701) 999-99-99',
      priority: 'normal',
      items: [{ productName: 'Item', size: 'M', quantity: 1, unitPrice: 1000 }],
    });
    await createEntry(ctx.orgId, {
      type: 'income', amount: 100, category: 'X', account: 'Касса', author: 't',
    });

    const before = {
      orders: await prisma.order.count({ where: { orgId: ctx.orgId } }),
      entries: await prisma.accountingEntry.count({ where: { orgId: ctx.orgId } }),
    };
    expect(before.orders).toBe(1);
    expect(before.entries).toBe(1);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/service/clean-org',
      payload: {
        password: config.CONSOLE_SERVICE_PASSWORD,
        orgId: ctx.orgId,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; deleted: Record<string, number> };
    expect(body.ok).toBe(true);
    expect(body.deleted.orders).toBe(1);
    expect(body.deleted.accountingEntries).toBe(1);

    // Verify the data is gone but the org itself remains.
    const after = {
      orders: await prisma.order.count({ where: { orgId: ctx.orgId } }),
      entries: await prisma.accountingEntry.count({ where: { orgId: ctx.orgId } }),
      org: await prisma.organization.count({ where: { id: ctx.orgId } }),
    };
    expect(after.orders).toBe(0);
    expect(after.entries).toBe(0);
    expect(after.org).toBe(1); // org NOT deleted — clean-org only wipes data
  });

  it('POST /clean-org returns 404 for an unknown org id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/service/clean-org',
      payload: {
        password: config.CONSOLE_SERVICE_PASSWORD,
        orgId: 'org-that-does-not-exist',
      },
    });
    expect(res.statusCode).toBe(404);
  });
});
