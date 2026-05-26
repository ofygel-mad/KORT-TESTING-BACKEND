/**
 * P10f smoke tests for documents.routes.ts.
 *
 * documents.routes.ts is a single endpoint that proxies `generateInvoiceXlsx`
 * (re-exported from `invoices/invoice.service.ts`) and serves the resulting
 * .xlsx with the right Content-Type / Content-Disposition. The XLSX
 * generator itself is covered in detail by
 * `modules/invoices/__tests__/invoices.service.integration.test.ts`; this
 * file pins the route shim — headers + status — so a regression in the
 * Content-Disposition / Cache-Control plumbing trips a test.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disconnectDatabase, prisma } from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import {
  create as createOrder,
  fulfillFromStock,
} from '../../orders/orders.service.js';
import { documentsRoutes } from '../documents.routes.js';

vi.mock('../../integrations/sheets/sheets.sync.js', () => ({
  syncOrderToSheets: vi.fn().mockResolvedValue({ ok: true }),
}));

type TestContext = {
  orgId: string;
  authorId: string;
  authorName: string;
};

async function createTestContext(): Promise<TestContext> {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const org = await prisma.organization.create({
    data: { name: `Docs Org ${token}`, slug: `docs-${token}` },
  });
  return { orgId: org.id, authorId: `author-${token}`, authorName: 'Doc Manager' };
}

async function buildTestApp(orgId: string): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorateRequest('orgId', '');
  app.decorateRequest('userId', '');
  app.decorate('authenticate', async (request: any) => { request.userId = 'test-user'; });
  app.decorate('resolveOrg', async (request: any) => { request.orgId = orgId; });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ code: error.code, message: error.message });
    }
    return reply.status(500).send({ error: String(error) });
  });

  await app.register(documentsRoutes, { prefix: '/api/v1/documents' });
  await app.ready();
  return app;
}

describe('documents.routes — /invoice/:orderId smoke', () => {
  let ctx: TestContext;
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    ctx = await createTestContext();
    app = await buildTestApp(ctx.orgId);
  });

  afterEach(async () => {
    await app.close();
    await prisma.organization.deleteMany({ where: { id: ctx.orgId } });
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('GET /invoice/:orderId returns an .xlsx with the right Content-Type + Cache-Control', async () => {
    const order = await createOrder(ctx.orgId, ctx.authorId, ctx.authorName, {
      clientName: 'Doc Client',
      clientPhone: '+7 (701) 333-44-55',
      priority: 'normal',
      items: [{ productName: 'Платье', size: 'L', color: 'Red', quantity: 1, unitPrice: 5000 }],
    });
    await fulfillFromStock(ctx.orgId, order.id, ctx.authorId, ctx.authorName);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/documents/invoice/${order.id}?style=branded`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers['cache-control']).toBe('no-store');
    expect(String(res.headers['content-disposition'])).toContain('attachment');
    expect(String(res.headers['content-disposition'])).toContain(`nakladnaya-${order.id.slice(0, 8)}.xlsx`);

    // Body is a real ZIP-wrapped XLSX (starts with "PK").
    expect(res.rawPayload[0]).toBe(0x50);
    expect(res.rawPayload[1]).toBe(0x4b);
  });

  it('GET /invoice/:orderId surfaces a 404 for an unknown order id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/documents/invoice/order-that-does-not-exist',
    });
    expect(res.statusCode).toBe(404);
  });
});
