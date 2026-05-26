/**
 * Integration tests for templates.ts + templates.routes.ts.
 *
 * Scope: covers the multi-business refactor surface for OrderTemplate
 * (P0/P6/P7):
 *   - ensureSystemTemplatesForOrg: idempotent seed (P7 no-silent-overwrite,
 *     refreshSystemTemplates flag)
 *   - SYSTEM_TEMPLATES catalog: 7 known seeds, sections shape,
 *     affectsAvailability axes
 *   - templates.routes DELETE guard (P7 TEMPLATE_IN_USE 409)
 *   - templates.routes PUT version bump (P6)
 *
 * Route tests build a tiny Fastify instance that stubs `authenticate` /
 * `resolveOrg` to inject a known orgId. This keeps test cost low while
 * still exercising the real route handlers + prisma writes.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { disconnectDatabase, prisma } from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import {
  BLANK_TEMPLATE,
  CHEMICALS_TEMPLATE,
  CLOTHING_TEMPLATE,
  FURNITURE_TEMPLATE,
  GROCERY_TEMPLATE,
  SERVICES_TEMPLATE,
  SYSTEM_TEMPLATES,
  WATCHES_TEMPLATE,
  ensureSystemTemplatesForOrg,
} from '../templates.js';
import { orderTemplatesRoutes } from '../templates.routes.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

type TestContext = {
  orgId: string;
};

async function createTestContext(): Promise<TestContext> {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const org = await prisma.organization.create({
    data: {
      name: `Templates Integration Org ${token}`,
      slug: `templates-integration-${token}`,
    },
  });
  return { orgId: org.id };
}

/**
 * Builds a minimal Fastify app that mounts the templates routes with stubbed
 * auth/orgScope decorators. The stubs honour the route hooks' contract
 * (`app.authenticate` and `app.resolveOrg`) and inject a fixed orgId.
 */
async function buildTestApp(orgId: string): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.decorateRequest('orgId', '');
  app.decorateRequest('userId', '');
  app.decorate('authenticate', async (request: any) => {
    request.userId = 'test-user';
  });
  app.decorate('resolveOrg', async (request: any) => {
    request.orgId = orgId;
  });

  // Mirror the production error handler shape so 4xx AppErrors come back as
  // the route declares (e.g. ValidationError → 400, NotFoundError → 404).
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        code: error.code,
        error: error.code,
        message: error.message,
        detail: error.message,
      });
    }
    return reply.status(500).send({ error: 'INTERNAL', message: String(error) });
  });

  await app.register(orderTemplatesRoutes, { prefix: '/api/v1/order-templates' });
  await app.ready();
  return app;
}

describe('OrderTemplate — integration', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await prisma.organization.deleteMany({ where: { id: ctx.orgId } });
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  // ── ensureSystemTemplatesForOrg (P7 idempotency) ──────────────────────────

  describe('ensureSystemTemplatesForOrg', () => {
    it('first call: seeds all 7 system templates and returns Clothing default id', async () => {
      const defaultId = await ensureSystemTemplatesForOrg(ctx.orgId);
      const rows = await prisma.orderTemplate.findMany({
        where: { orgId: ctx.orgId, isSystem: true },
      });
      expect(rows).toHaveLength(7);
      const clothing = rows.find((r) => r.name === CLOTHING_TEMPLATE.name);
      expect(clothing).toBeTruthy();
      expect(defaultId).toBe(clothing!.id);
    });

    it('P7 idempotency: re-running does NOT overwrite existing sections and keeps count at 7', async () => {
      await ensureSystemTemplatesForOrg(ctx.orgId);

      // Mutate one system template to a known sentinel — second seed must
      // leave it untouched.
      const clothing = await prisma.orderTemplate.findFirstOrThrow({
        where: { orgId: ctx.orgId, name: CLOTHING_TEMPLATE.name },
      });
      const sentinelSections = [
        {
          id: 'sentinel',
          kind: 'client',
          title: 'Sentinel',
          fields: [{ id: 'f_x', key: 'x', label: 'X', type: 'text' }],
        },
      ];
      await prisma.orderTemplate.update({
        where: { id: clothing.id },
        data: { sections: sentinelSections as unknown as object },
      });

      const defaultIdAgain = await ensureSystemTemplatesForOrg(ctx.orgId);
      expect(defaultIdAgain).toBe(clothing.id);

      const after = await prisma.orderTemplate.findMany({
        where: { orgId: ctx.orgId, isSystem: true },
      });
      expect(after).toHaveLength(7);

      const clothingAfter = await prisma.orderTemplate.findUniqueOrThrow({
        where: { id: clothing.id },
      });
      expect(clothingAfter.sections).toEqual(sentinelSections);
    });

    it('refreshSystemTemplates=true: forces re-seed of sections and bumps version', async () => {
      await ensureSystemTemplatesForOrg(ctx.orgId);
      const before = await prisma.orderTemplate.findFirstOrThrow({
        where: { orgId: ctx.orgId, name: CLOTHING_TEMPLATE.name },
      });

      // Stomp the sections with a sentinel so we can detect the refresh.
      await prisma.orderTemplate.update({
        where: { id: before.id },
        data: {
          sections: [{ id: 'sentinel', kind: 'items', title: 'X', fields: [] }] as unknown as object,
        },
      });

      await ensureSystemTemplatesForOrg(ctx.orgId, prisma, {
        refreshSystemTemplates: true,
      });

      const after = await prisma.orderTemplate.findUniqueOrThrow({
        where: { id: before.id },
      });
      expect(after.version).toBe(before.version + 1);
      // Sections must equal the seed shape, not the sentinel.
      expect(after.sections).toEqual(CLOTHING_TEMPLATE.sections);
    });
  });

  // ── SYSTEM_TEMPLATES catalog ──────────────────────────────────────────────

  describe('SYSTEM_TEMPLATES seed contract', () => {
    it('exposes exactly the 7 expected templates', () => {
      const names = SYSTEM_TEMPLATES.map((t) => t.name).sort();
      expect(names).toEqual(
        [
          BLANK_TEMPLATE.name,
          CLOTHING_TEMPLATE.name,
          WATCHES_TEMPLATE.name,
          CHEMICALS_TEMPLATE.name,
          FURNITURE_TEMPLATE.name,
          GROCERY_TEMPLATE.name,
          SERVICES_TEMPLATE.name,
        ].sort(),
      );
    });

    it('each template has at least one client and one items section', () => {
      for (const tpl of SYSTEM_TEMPLATES) {
        const kinds = tpl.sections.map((s) => s.kind);
        expect(kinds, `template "${tpl.name}" missing client section`).toContain('client');
        expect(kinds, `template "${tpl.name}" missing items section`).toContain('items');
      }
    });

    it('CLOTHING marks gender/color/length/size as affectsAvailability=true', () => {
      const items = CLOTHING_TEMPLATE.sections.find((s) => s.kind === 'items');
      expect(items).toBeTruthy();
      const byKey = Object.fromEntries(items!.fields.map((f) => [f.key, f]));
      expect(byKey.gender?.affectsAvailability).toBe(true);
      expect(byKey.color?.affectsAvailability).toBe(true);
      expect(byKey.length?.affectsAvailability).toBe(true);
      expect(byKey.size?.affectsAvailability).toBe(true);
    });

    it('CHEMICALS marks concentration as affectsAvailability=true', () => {
      const items = CHEMICALS_TEMPLATE.sections.find((s) => s.kind === 'items');
      const byKey = Object.fromEntries(items!.fields.map((f) => [f.key, f]));
      expect(byKey.concentration?.affectsAvailability).toBe(true);
    });

    it('FURNITURE marks width/height/depth/material as affectsAvailability=true', () => {
      const items = FURNITURE_TEMPLATE.sections.find((s) => s.kind === 'items');
      const byKey = Object.fromEntries(items!.fields.map((f) => [f.key, f]));
      expect(byKey.width?.affectsAvailability).toBe(true);
      expect(byKey.height?.affectsAvailability).toBe(true);
      expect(byKey.depth?.affectsAvailability).toBe(true);
      expect(byKey.material?.affectsAvailability).toBe(true);
    });
  });

  // ── DELETE guard (P7) ─────────────────────────────────────────────────────

  describe('DELETE /api/v1/order-templates/:id — P7 in-use guard', () => {
    it('happy: deletes a non-system template that no order references', async () => {
      const app = await buildTestApp(ctx.orgId);
      try {
        const tpl = await prisma.orderTemplate.create({
          data: {
            orgId: ctx.orgId,
            name: 'Custom Disposable',
            isSystem: false,
            sections: [
              { id: 'items', kind: 'items', title: 'Позиции', fields: [
                { id: 'f_product', key: 'product', label: 'Товар', type: 'text', required: true },
              ] },
            ],
          },
        });

        const res = await app.inject({
          method: 'DELETE',
          url: `/api/v1/order-templates/${tpl.id}`,
        });
        expect(res.statusCode).toBe(204);

        const still = await prisma.orderTemplate.findUnique({ where: { id: tpl.id } });
        expect(still).toBeNull();
      } finally {
        await app.close();
      }
    });

    it('guard: returns 409 TEMPLATE_IN_USE when at least one order references the template', async () => {
      const app = await buildTestApp(ctx.orgId);
      try {
        const tpl = await prisma.orderTemplate.create({
          data: {
            orgId: ctx.orgId,
            name: 'Custom In Use',
            isSystem: false,
            sections: [
              { id: 'items', kind: 'items', title: 'Позиции', fields: [
                { id: 'f_product', key: 'product', label: 'Товар', type: 'text', required: true },
              ] },
            ],
          },
        });

        // Two orders bound to this template — guard should surface count=2.
        const customer = await prisma.customer.create({
          data: {
            orgId: ctx.orgId,
            fullName: 'Guard Test Customer',
            phone: '70000000000',
          },
        });
        await prisma.order.create({
          data: {
            orgId: ctx.orgId,
            orderNumber: `TPL-A-${Date.now()}`,
            clientId: customer.id,
            templateId: tpl.id,
            clientName: 'Client A',
            clientPhone: '7000000001',
            status: 'new',
          },
        });
        await prisma.order.create({
          data: {
            orgId: ctx.orgId,
            orderNumber: `TPL-B-${Date.now()}`,
            clientId: customer.id,
            templateId: tpl.id,
            clientName: 'Client B',
            clientPhone: '7000000002',
            status: 'new',
          },
        });

        const res = await app.inject({
          method: 'DELETE',
          url: `/api/v1/order-templates/${tpl.id}`,
        });
        expect(res.statusCode).toBe(409);
        const body = res.json();
        expect(body.error).toBe('TEMPLATE_IN_USE');
        expect(body.count).toBe(2);
        expect(body.message).toMatch(/Вид деятельности используется в 2 заказах/);

        // Template must still exist.
        const still = await prisma.orderTemplate.findUnique({ where: { id: tpl.id } });
        expect(still).toBeTruthy();
      } finally {
        await app.close();
      }
    });

    it('guard: refuses to delete system templates with a 400 validation error', async () => {
      const app = await buildTestApp(ctx.orgId);
      try {
        await ensureSystemTemplatesForOrg(ctx.orgId);
        const sys = await prisma.orderTemplate.findFirstOrThrow({
          where: { orgId: ctx.orgId, isSystem: true, name: CLOTHING_TEMPLATE.name },
        });
        const res = await app.inject({
          method: 'DELETE',
          url: `/api/v1/order-templates/${sys.id}`,
        });
        expect(res.statusCode).toBe(400);
        const body = res.json();
        expect(body.message).toMatch(/Системные шаблоны нельзя удалить/);
      } finally {
        await app.close();
      }
    });
  });

  // ── PUT version bump (P6) ─────────────────────────────────────────────────

  describe('PUT /api/v1/order-templates/:id — P6 version bump', () => {
    it('every successful update increments version', async () => {
      const app = await buildTestApp(ctx.orgId);
      try {
        const tpl = await prisma.orderTemplate.create({
          data: {
            orgId: ctx.orgId,
            name: 'Editable',
            isSystem: false,
            itemNoun: 'позицию',
            primaryUnit: 'шт',
            primaryPrecision: 0,
            sections: [
              { id: 'items', kind: 'items', title: 'Позиции', fields: [
                { id: 'f_product', key: 'product', label: 'Товар', type: 'text', required: true },
              ] },
            ],
          },
        });
        const beforeVersion = tpl.version;

        const res = await app.inject({
          method: 'PUT',
          url: `/api/v1/order-templates/${tpl.id}`,
          payload: {
            name: 'Editable v2',
            itemNoun: 'позицию',
            primaryUnit: 'шт',
            primaryPrecision: 0,
            sections: [
              {
                id: 'items',
                kind: 'items',
                title: 'Позиции v2',
                fields: [
                  { id: 'f_product', key: 'product', label: 'Товар', type: 'text', required: true },
                  { id: 'f_color',   key: 'color',   label: 'Цвет',  type: 'text', affectsAvailability: true },
                ],
              },
            ],
          },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.name).toBe('Editable v2');
        expect(body.version).toBe(beforeVersion + 1);

        // And another edit bumps again.
        const res2 = await app.inject({
          method: 'PUT',
          url: `/api/v1/order-templates/${tpl.id}`,
          payload: {
            name: 'Editable v3',
            itemNoun: 'позицию',
            primaryUnit: 'шт',
            primaryPrecision: 0,
            sections: [
              { id: 'items', kind: 'items', title: 'Позиции v3', fields: [
                { id: 'f_product', key: 'product', label: 'Товар', type: 'text', required: true },
              ] },
            ],
          },
        });
        expect(res2.statusCode).toBe(200);
        expect(res2.json().version).toBe(beforeVersion + 2);
      } finally {
        await app.close();
      }
    });

    it('refuses to edit a system template', async () => {
      const app = await buildTestApp(ctx.orgId);
      try {
        await ensureSystemTemplatesForOrg(ctx.orgId);
        const sys = await prisma.orderTemplate.findFirstOrThrow({
          where: { orgId: ctx.orgId, isSystem: true, name: BLANK_TEMPLATE.name },
        });
        const res = await app.inject({
          method: 'PUT',
          url: `/api/v1/order-templates/${sys.id}`,
          payload: {
            name: 'hacked',
            itemNoun: 'x',
            primaryUnit: 'y',
            primaryPrecision: 0,
            sections: [
              { id: 'items', kind: 'items', title: 'X', fields: [
                { id: 'f_p', key: 'p', label: 'P', type: 'text' },
              ] },
            ],
          },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().message).toMatch(/Системные шаблоны нельзя редактировать/);
      } finally {
        await app.close();
      }
    });
  });
});
