/**
 * P10e integration tests for `requests.service.ts` (lead-intake flow, P8).
 *
 * Covers:
 *   - submit() writes MaterialRequest + items with attributesJson (no legacy
 *     `size` column survives the multi-business overhaul P0/P8).
 *   - submit() preserves arbitrary attribute keys verbatim into attributesJson.
 *   - submit() with items.attributes missing/empty stores null.
 *   - list() is org-scoped and supports status filtering.
 *   - updateStatus() persists status + createdOrderId; throws NotFound when
 *     the request lives in another org.
 *   - getPublicProfile() returns the org snapshot and product/size catalogs.
 *   - nextRequestNumber rolls RQ-001, RQ-002, … via Organization.requestCounter.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { disconnectDatabase, prisma } from '../../../lib/prisma.js';
import {
  getPublicProfile,
  list,
  submit,
  updateStatus,
} from '../requests.service.js';

type TestContext = {
  orgId: string;
};

async function createTestContext(): Promise<TestContext> {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const org = await prisma.organization.create({
    data: {
      name: `Requests Org ${token}`,
      slug: `requests-org-${token}`,
    },
  });
  return { orgId: org.id };
}

const baseSubmit = (overrides: Partial<Parameters<typeof submit>[1]> = {}) => ({
  customerName: '  Иван Петров  ',
  phone: ' +7 701 555 11 22 ',
  preferredContact: 'phone',
  items: [
    {
      productName: '  Платье вечернее  ',
      attributes: { size: 'M', color: 'red' },
      quantity: 2,
    },
  ],
  ...overrides,
});

describe('production/requests.service — lead intake (P8)', () => {
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

  it('submit() creates a MaterialRequest with items stored in attributesJson (no legacy size column)', async () => {
    const result = await submit(ctx.orgId, baseSubmit());

    expect(result.requestNumber).toBe('RQ-001');
    expect(result.customerName).toBe('Иван Петров');
    expect(result.phone).toBe('+7 701 555 11 22');
    expect(result.source).toBe('public_form');
    expect(result.status).toBe('new');
    expect(result.items).toHaveLength(1);

    const item = result.items[0]!;
    expect(item.productName).toBe('Платье вечернее');
    expect(item.quantity).toBe(2);
    expect(item.attributesJson).toEqual({ size: 'M', color: 'red' });

    // Schema-level evidence: the row no longer carries a flat `size` column.
    expect(Object.keys(item)).not.toContain('size');
  });

  it('submit() with arbitrary attribute keys round-trips them verbatim', async () => {
    const result = await submit(
      ctx.orgId,
      baseSubmit({
        items: [
          {
            productName: 'Кабель UTP',
            attributes: { category: '5e', length: '305m', shielded: 'no' },
            quantity: 3,
          },
        ],
      }),
    );

    expect(result.items[0]!.attributesJson).toEqual({
      category: '5e',
      length: '305m',
      shielded: 'no',
    });
  });

  it('submit() with items missing attributes stores attributesJson as null', async () => {
    const noAttrs = await submit(
      ctx.orgId,
      baseSubmit({
        items: [{ productName: 'Тестовый товар', quantity: 1 }],
      }),
    );
    expect(noAttrs.items[0]!.attributesJson).toBeNull();

    const emptyAttrs = await submit(
      ctx.orgId,
      baseSubmit({
        items: [{ productName: 'Тестовый товар', attributes: {}, quantity: 1 }],
      }),
    );
    expect(emptyAttrs.items[0]!.attributesJson).toBeNull();
  });

  it('list() returns only the requesting org and supports status filtering', async () => {
    // Two requests in ctx.orgId (one will be flipped to "reviewed").
    const first = await submit(ctx.orgId, baseSubmit());
    await submit(
      ctx.orgId,
      baseSubmit({
        customerName: 'Айгуль',
        items: [{ productName: 'Юбка', quantity: 1 }],
      }),
    );
    // A request in another org, must not leak.
    const otherCtx = await createTestContext();
    try {
      await submit(otherCtx.orgId, baseSubmit({ customerName: 'Foreign' }));

      const allMine = await list(ctx.orgId);
      expect(allMine).toHaveLength(2);
      expect(allMine.every((r) => r.orgId === ctx.orgId)).toBe(true);
      expect(allMine.map((r) => r.customerName).sort()).toEqual(
        ['Айгуль', 'Иван Петров'].sort(),
      );

      // Flip one to "reviewed" so we can filter on status.
      await updateStatus(ctx.orgId, first.id, 'reviewed');
      const reviewedOnly = await list(ctx.orgId, 'reviewed');
      expect(reviewedOnly).toHaveLength(1);
      expect(reviewedOnly[0]!.id).toBe(first.id);

      const allFilter = await list(ctx.orgId, 'all');
      expect(allFilter).toHaveLength(2);
    } finally {
      await prisma.organization.deleteMany({ where: { id: otherCtx.orgId } });
    }
  });

  it('updateStatus() persists status + createdOrderId; cross-org call throws NotFound', async () => {
    const req = await submit(ctx.orgId, baseSubmit());

    const updated = await updateStatus(ctx.orgId, req.id, 'converted', 'order-123');
    expect(updated.status).toBe('converted');
    expect(updated.createdOrderId).toBe('order-123');

    const otherCtx = await createTestContext();
    try {
      await expect(
        updateStatus(otherCtx.orgId, req.id, 'archived'),
      ).rejects.toThrow(/MaterialRequest/);
    } finally {
      await prisma.organization.deleteMany({ where: { id: otherCtx.orgId } });
    }
  });

  it('getPublicProfile() returns the org snapshot and bundles product/size catalogs', async () => {
    await prisma.warehouseProductCatalog.create({
      data: {
        orgId: ctx.orgId,
        name: 'Платье вечернее',
        normalizedName: 'платье вечернее',
        isActive: true,
      },
    });
    await prisma.productSize.create({
      data: { orgId: ctx.orgId, name: 'M' },
    });
    await prisma.productSize.create({
      data: { orgId: ctx.orgId, name: 'L' },
    });

    const profile = await getPublicProfile(ctx.orgId);
    expect(profile).not.toBeNull();
    expect(profile!.displayName).toMatch(/Requests Org/);
    expect(profile!.catalogs.products).toEqual(['Платье вечернее']);
    expect(profile!.catalogs.sizes.sort()).toEqual(['L', 'M']);

    // Profile for an unknown org id resolves to null (route maps to 404).
    expect(await getPublicProfile('does-not-exist')).toBeNull();
  });

  it('nextRequestNumber zero-pads sequentially via Organization.requestCounter', async () => {
    const r1 = await submit(ctx.orgId, baseSubmit());
    const r2 = await submit(ctx.orgId, baseSubmit({ customerName: 'B' }));
    const r3 = await submit(ctx.orgId, baseSubmit({ customerName: 'C' }));

    expect(r1.requestNumber).toBe('RQ-001');
    expect(r2.requestNumber).toBe('RQ-002');
    expect(r3.requestNumber).toBe('RQ-003');

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
    expect(org.requestCounter).toBe(3);
  });
});
