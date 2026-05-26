/**
 * P10d integration tests: ChangeRequest flow.
 *
 * Covers requestItemChange / approveChangeRequest / rejectChangeRequest:
 *   - requestItemChange only works for orders in_production
 *   - approveChangeRequest adds new items with productionTasks and updates
 *     totals
 *   - approveChangeRequest stores axes under attributesJson (P0 — no legacy
 *     `size` column)
 *   - rejectChangeRequest sets status=rejected and logs activity
 *   - a second requestItemChange supersedes the previous pending request
 *
 * Sibling files (orders.integration.test.ts, orders.template-snapshot…)
 * never touch ChangeRequest so this file is non-overlapping.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disconnectDatabase, prisma } from '../../../lib/prisma.js';
import {
  approveChangeRequest,
  confirm,
  create,
  rejectChangeRequest,
  requestItemChange,
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
      name: `ChangeRequest Org ${token}`,
      slug: `change-request-${token}`,
    },
  });
  return {
    orgId: org.id,
    authorId: `author-${token}`,
    authorName: 'CR Manager',
  };
}

async function createInProductionOrder(ctx: TestContext) {
  const order = await create(ctx.orgId, ctx.authorId, ctx.authorName, {
    clientName: 'CR Client',
    clientPhone: '+7 (701) 555-44-33',
    priority: 'normal',
    items: [
      { productName: 'Shirt', size: 'M', quantity: 1, unitPrice: 5000 },
    ],
  });
  await confirm(ctx.orgId, order.id, ctx.authorId, ctx.authorName);
  await updateStatus(ctx.orgId, order.id, 'in_production', ctx.authorId, ctx.authorName);
  return order;
}

describe('Orders — ChangeRequest (requestItemChange / approve / reject)', () => {
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

  it('requestItemChange creates a pending ChangeRequest and a system activity', async () => {
    const order = await createInProductionOrder(ctx);

    const cr = await requestItemChange(
      ctx.orgId,
      order.id,
      ctx.authorId,
      ctx.authorName,
      [
        { productName: 'Pants', size: 'L', quantity: 1, unitPrice: 7000 },
      ],
      'Клиент попросил добавить штаны',
    );

    expect(cr.status).toBe('pending');
    expect(cr.orderId).toBe(order.id);
    expect(cr.managerNote).toBe('Клиент попросил добавить штаны');

    const activities = await prisma.orderActivity.findMany({
      where: { orderId: order.id, type: 'system' },
    });
    const messages = activities.map((a) => a.content);
    expect(messages.some((m) => m.includes('запрос на изменение'))).toBe(true);
  });

  it('requestItemChange refuses orders not in_production', async () => {
    // Order is freshly created → status="new", not in_production.
    const order = await create(ctx.orgId, ctx.authorId, ctx.authorName, {
      clientName: 'Wrong Status',
      clientPhone: '+7 (701) 555-44-44',
      priority: 'normal',
      items: [
        { productName: 'Coat', size: 'M', quantity: 1, unitPrice: 10000 },
      ],
    });

    await expect(
      requestItemChange(
        ctx.orgId,
        order.id,
        ctx.authorId,
        ctx.authorName,
        [
          { productName: 'Hat', size: 'M', quantity: 1, unitPrice: 2000 },
        ],
      ),
    ).rejects.toThrow();
  });

  it('approveChangeRequest adds the new item, creates a queued ProductionTask, and recalculates totalAmount', async () => {
    const order = await createInProductionOrder(ctx);
    const cr = await requestItemChange(
      ctx.orgId,
      order.id,
      ctx.authorId,
      ctx.authorName,
      [
        { productName: 'Hat', size: 'XL', quantity: 2, unitPrice: 3000 },
      ],
    );

    await approveChangeRequest(ctx.orgId, cr.id, ctx.authorId, ctx.authorName);

    const after = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, productionTasks: true },
    });

    // totalAmount = original 1×5000 (Shirt M) + 2×3000 (Hat XL) = 11000.
    expect(after.totalAmount).toBe(11000);
    // Original shirt + new hat = 2 items.
    expect(after.items).toHaveLength(2);
    const hat = after.items.find((i) => i.productName === 'Hat')!;
    expect(hat).toBeDefined();
    // P0: size lives under attributesJson, NOT as its own column.
    const attrs = hat.attributesJson as Record<string, string>;
    expect(attrs.size).toBe('XL');

    // ProductionTask was created in 'queued' state.
    const newTask = after.productionTasks.find((t) => t.orderItemId === hat.id);
    expect(newTask).toBeDefined();
    expect(newTask?.status).toBe('queued');

    // ChangeRequest is marked approved.
    const stored = await prisma.changeRequest.findUniqueOrThrow({ where: { id: cr.id } });
    expect(stored.status).toBe('approved');
    expect(stored.resolvedBy).toBe(ctx.authorName);
  });

  it('rejectChangeRequest marks it rejected, stores reason, and logs activity', async () => {
    const order = await createInProductionOrder(ctx);
    const cr = await requestItemChange(
      ctx.orgId,
      order.id,
      ctx.authorId,
      ctx.authorName,
      [
        { productName: 'Belt', size: 'M', quantity: 1, unitPrice: 1500 },
      ],
    );

    await rejectChangeRequest(
      ctx.orgId,
      cr.id,
      ctx.authorId,
      ctx.authorName,
      'Не успеваем по срокам',
    );

    const stored = await prisma.changeRequest.findUniqueOrThrow({ where: { id: cr.id } });
    expect(stored.status).toBe('rejected');
    expect(stored.rejectReason).toBe('Не успеваем по срокам');
    expect(stored.resolvedBy).toBe(ctx.authorName);

    // Activity trail records the rejection.
    const activities = await prisma.orderActivity.findMany({
      where: { orderId: order.id, type: 'system' },
    });
    const hasReject = activities.some((a) =>
      a.content.includes('отклонен') || a.content.includes('отклонён'),
    );
    expect(hasReject).toBe(true);

    // No new OrderItem / ProductionTask was created — original 1 item only.
    const itemCount = await prisma.orderItem.count({ where: { orderId: order.id } });
    expect(itemCount).toBe(1);
  });

  it('a second requestItemChange supersedes the previous pending request', async () => {
    const order = await createInProductionOrder(ctx);

    const first = await requestItemChange(
      ctx.orgId,
      order.id,
      ctx.authorId,
      ctx.authorName,
      [
        { productName: 'Hat', size: 'M', quantity: 1, unitPrice: 2500 },
      ],
    );

    const second = await requestItemChange(
      ctx.orgId,
      order.id,
      ctx.authorId,
      ctx.authorName,
      [
        { productName: 'Scarf', size: 'OS', quantity: 1, unitPrice: 1800 },
      ],
    );

    const firstAfter = await prisma.changeRequest.findUniqueOrThrow({ where: { id: first.id } });
    const secondAfter = await prisma.changeRequest.findUniqueOrThrow({ where: { id: second.id } });

    expect(firstAfter.status).toBe('rejected');
    expect(firstAfter.rejectReason).toContain('Запрос заменен новым');
    expect(secondAfter.status).toBe('pending');
  });
});
