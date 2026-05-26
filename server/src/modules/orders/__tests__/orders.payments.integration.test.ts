/**
 * P10d integration tests: payment edge cases (addPayment).
 *
 * orders.integration.test.ts covers ONE happy path (two partial→paid
 * payments + alert resolution). This file covers the remaining edge cases:
 *   - overpayment (amount > due) → paymentStatus still 'paid'
 *   - partial payment landing in 'partial' status
 *   - mixed payment breakdown persists on Order.paymentBreakdown at create
 *   - addPayment writes Activity entries (type='payment') for each call
 *   - default Payment.verifiedAt / verificationSource are null (manual
 *     manager-entered payments are unverified until matched against an
 *     external receipt — P2 contract).
 *
 * Sacred: no overlap with existing payment cases in
 * orders.integration.test.ts (which tests 12000+20000 over a 32000 order).
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disconnectDatabase, prisma } from '../../../lib/prisma.js';
import { addPayment, create } from '../orders.service.js';

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
      name: `Payments Org ${token}`,
      slug: `payments-${token}`,
    },
  });
  return {
    orgId: org.id,
    authorId: `author-${token}`,
    authorName: 'Payments Manager',
  };
}

async function createOrder(ctx: TestContext, total: number) {
  return create(ctx.orgId, ctx.authorId, ctx.authorName, {
    clientName: 'Pay Client',
    clientPhone: '+7 (701) 444-55-66',
    priority: 'normal',
    items: [
      { productName: 'Item', size: 'M', quantity: 1, unitPrice: total },
    ],
  });
}

describe('Orders — payment edge cases (addPayment)', () => {
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

  it('overpayment (amount > due) lands the order in paymentStatus=paid', async () => {
    const order = await createOrder(ctx, 5000);

    await addPayment(ctx.orgId, order.id, ctx.authorId, ctx.authorName, {
      amount: 8000, // 3000 over the 5000 due
      method: 'cash',
    });

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.paidAmount).toBe(8000);
    expect(after.paymentStatus).toBe('paid');
  });

  it('partial payment lands the order in paymentStatus=partial', async () => {
    const order = await createOrder(ctx, 10000);

    await addPayment(ctx.orgId, order.id, ctx.authorId, ctx.authorName, {
      amount: 3000,
      method: 'transfer',
    });

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.paidAmount).toBe(3000);
    expect(after.paymentStatus).toBe('partial');
  });

  it('mixed paymentBreakdown at create time persists exactly on Order.paymentBreakdown', async () => {
    const order = await create(ctx.orgId, ctx.authorId, ctx.authorName, {
      clientName: 'Mixed Client',
      clientPhone: '+7 (701) 333-44-55',
      priority: 'normal',
      prepayment: 9000,
      paymentMethod: 'mixed',
      paymentBreakdown: {
        cash: 3000,
        transfer: 4000,
        kaspi_qr: 2000,
      },
      items: [
        { productName: 'MixedItem', size: 'L', quantity: 1, unitPrice: 10000 },
      ],
    });

    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const breakdown = row.paymentBreakdown as Record<string, number>;
    expect(breakdown).toEqual({ cash: 3000, transfer: 4000, kaspi_qr: 2000 });
    expect(breakdown.cash + breakdown.transfer + breakdown.kaspi_qr).toBe(9000);

    // And the initial Payment row was created with method='mixed' and a
    // human-readable summary in `notes` (buildInitialPaymentNote contract).
    const payments = await prisma.payment.findMany({ where: { orderId: order.id } });
    expect(payments).toHaveLength(1);
    expect(payments[0]?.method).toBe('mixed');
    expect(payments[0]?.notes).toContain('Наличные');
    expect(payments[0]?.notes).toContain('Перевод');
    expect(payments[0]?.notes).toContain('Kaspi QR');
  });

  it('each addPayment writes a payment-typed OrderActivity entry', async () => {
    const order = await createOrder(ctx, 12000);

    await addPayment(ctx.orgId, order.id, ctx.authorId, ctx.authorName, {
      amount: 5000,
      method: 'cash',
      notes: 'first',
    });
    await addPayment(ctx.orgId, order.id, ctx.authorId, ctx.authorName, {
      amount: 7000,
      method: 'card',
      notes: 'second',
    });

    const activities = await prisma.orderActivity.findMany({
      where: { orderId: order.id, type: 'payment' },
      orderBy: { createdAt: 'asc' },
    });
    // 2 from addPayment (the create-time prepayment was 0, so no third entry).
    expect(activities).toHaveLength(2);
    expect(activities[0]?.content).toContain('5');
    expect(activities[1]?.content).toContain('7');
    expect(activities.every((a) => a.authorId === ctx.authorId)).toBe(true);
  });

  it('Payment rows from addPayment default verifiedAt/verificationSource to null (P2 unverified contract)', async () => {
    const order = await createOrder(ctx, 4000);

    await addPayment(ctx.orgId, order.id, ctx.authorId, ctx.authorName, {
      amount: 4000,
      method: 'cash',
    });

    const payments = await prisma.payment.findMany({ where: { orderId: order.id } });
    // Only the addPayment call (no prepayment was passed at create).
    expect(payments).toHaveLength(1);
    expect(payments[0]?.verifiedAt).toBeNull();
    expect(payments[0]?.verificationSource).toBeNull();
  });
});
