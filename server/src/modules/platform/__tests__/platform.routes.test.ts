/**
 * P10f integration tests for the platform module.
 *
 * The full platform.routes.ts surface is service-to-service: IP allowlist
 * + Bearer service-token. PLATFORM_SERVICE_SECRET is optional in the test
 * environment and the routes are only mounted in app.ts when the secret is
 * set, so we don't try to exercise the auth gates here. Instead:
 *
 *   1. composition.platform.routes.ts is mounted standalone (the child
 *      plugin doesn't add auth hooks of its own; auth lives on the parent
 *      platformRoutes plugin). This exercises real route handlers + real
 *      composition.service writes, which is the high-value coverage.
 *   2. platform.service.getHealth() is invoked directly to pin its shape
 *      (status, version, db, tenantCount) — a thin endpoint but it sits on
 *      the public health-check, so the shape contract matters.
 *   3. platform.auth.ipAllowed() is exercised as a unit since it is pure.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { disconnectDatabase, prisma } from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { compositionPlatformRoutes } from '../composition.platform.routes.js';
import { getHealth } from '../platform.service.js';
import { ipAllowed } from '../platform.auth.js';
import { MANIFEST_VERSION } from '../../composition/manifest.js';

type TestContext = {
  orgId: string;
};

async function createTestContext(): Promise<TestContext> {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const org = await prisma.organization.create({
    data: {
      name: `Platform Org ${token}`,
      slug: `platform-${token}`,
    },
  });
  return { orgId: org.id };
}

/**
 * Stand-alone Fastify app that mounts the composition platform routes
 * directly. The `platformActor` decorator + IP/Bearer hooks live on the
 * parent platformRoutes plugin, so the child by itself has no auth.
 */
async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorateRequest('platformActor', null);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      const status = error.statusCode === 400 ? 422 : error.statusCode;
      return reply.status(status).send({ error: { message: error.message } });
    }
    return reply.status(500).send({ error: { message: String(error) } });
  });

  await app.register(compositionPlatformRoutes, { prefix: '/composition' });
  await app.ready();
  return app;
}

describe('platform — composition routes + health (integration)', () => {
  let ctx: TestContext;
  let app: FastifyInstance;

  beforeEach(async () => {
    ctx = await createTestContext();
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
    await prisma.organization.deleteMany({ where: { id: ctx.orgId } });
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  // ── composition manifest endpoint ──────────────────────────────────────

  it('GET /composition/manifest returns the COMPOSITION_MANIFEST with its content-hash version', async () => {
    const res = await app.inject({ method: 'GET', url: '/composition/manifest' });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { version: string; surfaces: unknown[]; sections: unknown[] };
    expect(body.version).toBe(MANIFEST_VERSION);
    expect(body.version).toMatch(/^[0-9a-f]{12}$/);
    expect(Array.isArray(body.surfaces)).toBe(true);
    expect(Array.isArray(body.sections)).toBe(true);
  });

  // ── composition config endpoint (lazy default seed) ────────────────────

  it('GET /composition/config?tenantId=... seeds + returns the default config for a fresh tenant', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/composition/config?tenantId=${ctx.orgId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { revision: number; manifestVersion: string };
    expect(body.revision).toBe(1);
    expect(body.manifestVersion).toBe(MANIFEST_VERSION);

    // Sanity: row persisted.
    const row = await prisma.tenantConfig.findUnique({ where: { orgId: ctx.orgId } });
    expect(row?.revision).toBe(1);
  });

  it('GET /composition/config rejects when tenantId is missing (zod parse throws)', async () => {
    const res = await app.inject({ method: 'GET', url: '/composition/config' });
    // Standalone mount has no contract envelope, so the raw ZodError bubbles
    // through our generic 500 handler. In production, the parent
    // platformRoutes installs a handler that re-maps ZodError → 422
    // {error:{code:"validation"}} — that mapping is exercised by the
    // composition.platform.* suite (manifest-parity etc.).
    expect(res.statusCode).toBe(500);
  });

  // ── platform.service.getHealth (direct) ────────────────────────────────

  it('getHealth() reports status=ok with a finite tenant count and matching uptime', async () => {
    const health = await getHealth();

    expect(health.status).toBe('ok');
    expect(health.db).toBe('ok');
    expect(Number.isFinite(health.tenantCount)).toBe(true);
    expect(health.tenantCount).toBeGreaterThanOrEqual(1); // our test org at minimum
    expect(typeof health.version).toBe('string');
    expect(health.uptimeSec).toBeGreaterThanOrEqual(0);
  });

  // ── platform.auth.ipAllowed (pure) ─────────────────────────────────────

  it('ipAllowed() matches exact IPv4 and CIDR rules', () => {
    expect(ipAllowed('10.0.0.5', ['10.0.0.5'])).toBe(true);
    expect(ipAllowed('10.0.0.5', ['10.0.0.6'])).toBe(false);
    expect(ipAllowed('10.0.0.5', ['10.0.0.0/24'])).toBe(true);
    expect(ipAllowed('11.0.0.5', ['10.0.0.0/24'])).toBe(false);
    // IPv4-mapped IPv6 normalises down.
    expect(ipAllowed('::ffff:10.0.0.5', ['10.0.0.5'])).toBe(true);
    // /0 matches everything.
    expect(ipAllowed('203.0.113.7', ['0.0.0.0/0'])).toBe(true);
  });
});
