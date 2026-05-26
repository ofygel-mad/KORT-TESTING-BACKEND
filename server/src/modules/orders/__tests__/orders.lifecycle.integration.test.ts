/**
 * P10d integration tests: Order lifecycle edges + trash flow.
 *
 * orders.integration.test.ts already covers:
 *   - close(ready) → completed → restore back to 'new'
 *   - cancel from confirmed → restore back to 'new'
 *   - in_production → ready gate (production must be done)
 *
 * This file adds:
 *   - restore() refuses an order that is neither cancelled nor archived.
 *   - archive() refuses an order whose status is not completed/cancelled.
 *   - lifecycle on_warehouse → ready via returnToReady() with reason.
 *   - invalid lifecycle jump: new → ready is rejected by the status validator.
 *   - trashOrder + permanentDelete: gate requires deletedAt first, then the
 *     row is hard-deleted with its items.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disconnectDatabase, prisma } from '../../../lib/prisma.js';
import {
  addPayment,
  archive,
  confirm,
  create,
  fulfillFromStock,
  permanentDelete,
  restore,
  returnToReady,
  setRequiresInvoice,
  trashOrder,
  updateStatus,
} from '../orders.service.js';

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
      name: `Lifecycle Org ${token}`,
      slug: `lifecycle-${token}`,
    },
  });
  return {
    orgId: org.id,
    authorId: `author-${token}`,
    authorName: 'Life Manager',
  };
}

async function createBasicOrder(ctx: TestContext) {
  return create(ctx.orgId, ctx.authorId, ctx.authorName, {
    clientName: 'Lifecycle Client',
    clientPhone: '+7 (701) 777-88-99',
    priority: 'normal',
    items: [
      { productName: 'Item', size: 'M', quantity: 1, unitPrice: 6000 },
    ],
  });
}

describe('Orders — lifecycle edges + trash flow', () => {
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

  it('restore() refuses an order that is neither cancelled nor archived', async () => {
    const order = await createBasicOrder(ctx); // status='new', isArchived=false

    await expect(
      restore(ctx.orgId, order.id, ctx.authorId, ctx.authorName),
    ).rejects.toThrow(/только отменен.*или архив/);

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe('new');
    expect(after.isArchived).toBe(false);
  });

  it('archive() refuses orders whose status is neither completed nor cancelled', async () => {
    const order = await createBasicOrder(ctx);
    await confirm(ctx.orgId, order.id, ctx.authorId, ctx.authorName);

    await expect(
      archive(ctx.orgId, order.id, ctx.authorId, ctx.authorName),
    ).rejects.toThrow(/завершенный или отмененный/);

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.isArchived).toBe(false);
  });

  it('returnToReady() moves on_warehouse → ready and records reason in activity', async () => {
    const order = await createBasicOrder(ctx);
    // Drop the requiresInvoice gate so ready → on_warehouse is allowed.
    await setRequiresInvoice(ctx.orgId, order.id, false);
    // fulfillFromStock skips production and lands the order in 'ready'.
    await fulfillFromStock(ctx.orgId, order.id, ctx.authorId, ctx.authorName);

    // ready → on_warehouse is a valid transition for clothing_workshop.
    await updateStatus(ctx.orgId, order.id, 'on_warehouse', ctx.authorId, ctx.authorName);

    // Now call returnToReady with a reason.
    await returnToReady(ctx.orgId, order.id, ctx.authorId, ctx.authorName, 'Брак упаковки');

    const after = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { activities: { orderBy: { createdAt: 'asc' } } },
    });
    expect(after.status).toBe('ready');
    const last = after.activities.at(-1)!;
    expect(last.type).toBe('status_change');
    expect(last.content).toContain('Брак упаковки');
  });

  it('updateStatus refuses an invalid jump: new → ready (must go through confirmed/in_production)', async () => {
    const order = await createBasicOrder(ctx);

    await expect(
      updateStatus(ctx.orgId, order.id, 'ready', ctx.authorId, ctx.authorName),
    ).rejects.toThrow();

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe('new');
  });

  it('trashOrder + permanentDelete: order must be trashed first, then it hard-deletes with items', async () => {
    const order = await createBasicOrder(ctx);

    // Cannot permanent-delete an order that isn't in trash.
    await expect(permanentDelete(ctx.orgId, order.id)).rejects.toThrow(
      /должен быть в корзине/,
    );

    // Trash it first.
    await trashOrder(ctx.orgId, order.id, ctx.authorId, ctx.authorName);
    const trashed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(trashed.deletedAt).not.toBeNull();

    // Cannot trash again.
    await expect(
      trashOrder(ctx.orgId, order.id, ctx.authorId, ctx.authorName),
    ).rejects.toThrow(/уже в корзине/);

    // Now hard-delete.
    await permanentDelete(ctx.orgId, order.id);

    const gone = await prisma.order.findUnique({ where: { id: order.id } });
    expect(gone).toBeNull();

    // Cascade: the OrderItems must also be gone.
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    expect(items).toHaveLength(0);
  });

  it('close() on a paid ready order, then archive() is a no-op (already archived)', async () => {
    const order = await createBasicOrder(ctx);
    await fulfillFromStock(ctx.orgId, order.id, ctx.authorId, ctx.authorName);
    await addPayment(ctx.orgId, order.id, ctx.authorId, ctx.authorName, {
      amount: 6000,
      method: 'transfer',
    });

    // First close → status=completed, isArchived=true.
    const { close } = await import('../orders.service.js');
    await close(ctx.orgId, order.id, ctx.authorId, ctx.authorName);

    const closed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(closed.status).toBe('completed');
    expect(closed.isArchived).toBe(true);

    // close() again: must reject because order is already archived.
    await expect(
      close(ctx.orgId, order.id, ctx.authorId, ctx.authorName),
    ).rejects.toThrow(/уже в архив/);
  });
});
