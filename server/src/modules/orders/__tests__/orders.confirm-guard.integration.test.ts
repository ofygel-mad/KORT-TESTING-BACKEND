/**
 * P10d integration tests: confirm + stock-availability guard (P9).
 *
 * Covers behavior NOT covered by orders.integration.test.ts:
 *   - confirm() on an order that is already confirmed → ValidationError
 *     (idempotency guard inside applyItemRouting).
 *   - create() that needs more stock than the warehouse has → ValidationError
 *     bubbles from reserveNewOrderItems (P9 guard) at create time.
 *   - cancel after confirm releases the warehouse reservation
 *     (and confirm itself does not eat the stock — reservations only).
 *
 * This file does NOT duplicate the existing "confirm routes all items" or
 * "fulfillFromStock skips production" cases.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disconnectDatabase, prisma } from '../../../lib/prisma.js';
import { confirm, create, fulfillFromStock, updateStatus } from '../orders.service.js';
import { buildCanonicalVariantKey } from '../../../shared/variant-key.js';

vi.mock('../../integrations/sheets/sheets.sync.js', () => ({
  syncOrderToSheets: vi.fn().mockResolvedValue({ ok: true }),
}));

type TestContext = {
  orgId: string;
  authorId: string;
  authorName: string;
};

async function createTestContext(): Promise<TestContext> {
  const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const org = await prisma.organization.create({
    data: {
      name: `ConfirmGuard Org ${token}`,
      slug: `confirm-guard-${token}`,
    },
  });
  return {
    orgId: org.id,
    authorId: `author-${token}`,
    authorName: 'CG Manager',
  };
}

/**
 * Pre-seed a WarehouseItem whose variantKey matches what orders.create will
 * compute for an item with the same productName + size attribute. P0/P4:
 * size flows into attributesJson, so the canonical key is built from it.
 */
async function seedStockForSize(
  orgId: string,
  args: { name: string; size: string; qty: number; qtyReserved?: number },
) {
  const attrs = { size: args.size };
  const variantKey = buildCanonicalVariantKey(
    args.name,
    attrs,
    Object.keys(attrs).map((code) => ({ code, affectsAvailability: true })),
  );
  return prisma.warehouseItem.create({
    data: {
      orgId,
      name: args.name,
      unit: 'шт',
      qty: args.qty,
      qtyReserved: args.qtyReserved ?? 0,
      qtyMin: 0,
      verificationRequired: false, // bypass off → P9 guard is active
      variantKey,
      attributesJson: attrs,
      qrCode: `KORT-CG-TEST-${Math.random().toString(36).slice(2, 12)}`,
      tags: [],
    },
  });
}

describe('Orders — confirm + stock-availability guard (P9)', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    vi.clearAllMocks();
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await prisma.organization.deleteMany({ where: { id: ctx.orgId } });
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('confirm() is not idempotent — a second call on a confirmed order rejects', async () => {
    const order = await create(ctx.orgId, ctx.authorId, ctx.authorName, {
      clientName: 'Confirm Twice',
      clientPhone: '+7 (701) 999-88-77',
      priority: 'normal',
      items: [
        { productName: 'Coat', size: 'M', quantity: 1, unitPrice: 10000 },
      ],
    });

    await confirm(ctx.orgId, order.id, ctx.authorId, ctx.authorName);

    // Second call: status is now 'confirmed', applyItemRouting requires 'new'.
    await expect(
      confirm(ctx.orgId, order.id, ctx.authorId, ctx.authorName),
    ).rejects.toThrow();
  });

  it('create() throws ValidationError when the requested qty exceeds available stock (P9 guard)', async () => {
    // Pre-seed: only 2 units on hand. Order requests 5 → guard must fire.
    await seedStockForSize(ctx.orgId, {
      name: 'GuardedShirt',
      size: 'M',
      qty: 2,
    });

    await expect(
      create(ctx.orgId, ctx.authorId, ctx.authorName, {
        clientName: 'Overrequest Client',
        clientPhone: '+7 (701) 111-22-33',
        priority: 'normal',
        items: [
          { productName: 'GuardedShirt', size: 'M', quantity: 5, unitPrice: 4000 },
        ],
      }),
    ).rejects.toThrow(/Недостаточно товара на складе/);

    // Reservation must not have been written; qtyReserved stays at 0.
    const items = await prisma.warehouseItem.findMany({
      where: { orgId: ctx.orgId, name: 'GuardedShirt' },
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.qtyReserved).toBe(0);
  });

  it('cancel after confirm releases the warehouse reservation', async () => {
    // Seed enough stock; create an order that reserves exactly all of it.
    const seeded = await seedStockForSize(ctx.orgId, {
      name: 'Releasable',
      size: 'L',
      qty: 3,
    });

    const order = await create(ctx.orgId, ctx.authorId, ctx.authorName, {
      clientName: 'Cancel Path',
      clientPhone: '+7 (701) 222-33-44',
      priority: 'normal',
      items: [
        { productName: 'Releasable', size: 'L', quantity: 3, unitPrice: 5000 },
      ],
    });

    // After create: reservation is up, item.qtyReserved bumped.
    const afterCreate = await prisma.warehouseItem.findUniqueOrThrow({ where: { id: seeded.id } });
    expect(afterCreate.qtyReserved).toBe(3);

    // Route everything to warehouse so cancellation can release the reservations.
    await fulfillFromStock(ctx.orgId, order.id, ctx.authorId, ctx.authorName);

    // Cancel: must release the warehouse reservation (P3 hook in updateStatus).
    await updateStatus(
      ctx.orgId,
      order.id,
      'cancelled',
      ctx.authorId,
      ctx.authorName,
      'Тест',
    );

    const afterCancel = await prisma.warehouseItem.findUniqueOrThrow({ where: { id: seeded.id } });
    expect(afterCancel.qtyReserved).toBe(0);

    // And the WarehouseReservation row is no longer 'active'.
    const reservations = await prisma.warehouseReservation.findMany({
      where: { orgId: ctx.orgId, itemId: seeded.id, sourceId: order.id, status: 'active' },
    });
    expect(reservations).toHaveLength(0);
  });
});
