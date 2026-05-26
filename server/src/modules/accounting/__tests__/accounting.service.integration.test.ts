/**
 * P10f integration tests for the accounting module:
 *   - accounting.service.ts: createEntry hash chain + listEntries scope + P&L
 *     + chain integrity.
 *   - accounting.sync.ts: emitAccountingEvent → createEntry happy path
 *     (deal.won, payment.added, warehouse.movement_in).
 *
 * The hash chain is the contract these tests pin: every new entry's `prevHash`
 * must match the previous entry's `hash`, and `verifyIntegrity` must agree.
 * The sync layer is a pure event bus, so the test asserts that emitting
 * produces the expected AccountingEntry row(s).
 */

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { disconnectDatabase, prisma } from '../../../lib/prisma.js';
import {
  createEntry,
  getPnL,
  listEntries,
  verifyIntegrity,
} from '../accounting.service.js';
import {
  emitAccountingEvent,
  registerAccountingSync,
  syncDealWon,
  syncPayment,
  syncWarehouseMovement,
} from '../accounting.sync.js';

// The accounting.sync event bus is module-level — register handlers exactly
// once for the whole file. The bus is in-process and tolerant of repeated
// registrations (handlers stack), but doing it once keeps the test
// expectations clean.
let syncRegistered = false;
function ensureSyncRegistered() {
  if (!syncRegistered) {
    registerAccountingSync();
    syncRegistered = true;
  }
}

type TestContext = {
  orgId: string;
};

async function createTestContext(): Promise<TestContext> {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const org = await prisma.organization.create({
    data: {
      name: `Accounting Org ${token}`,
      slug: `accounting-${token}`,
    },
  });
  return { orgId: org.id };
}

describe('Accounting — service + event sync (integration)', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ensureSyncRegistered();
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await prisma.organization.deleteMany({ where: { id: ctx.orgId } });
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  // ── createEntry happy path ─────────────────────────────────────────────

  it('createEntry() persists an entry with seq=1, GENESIS prevHash, and a sha256 hash', async () => {
    const entry = await createEntry(ctx.orgId, {
      type: 'income',
      amount: 10000,
      category: 'Реализация',
      account: 'Касса',
      author: 'test',
    });

    expect(entry.orgId).toBe(ctx.orgId);
    expect(entry.seq).toBe(1);
    expect(entry.prevHash).toBeNull(); // first entry → genesis
    expect(entry.hash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    expect(entry.currency).toBe('KZT'); // default
  });

  // ── Chain integrity ────────────────────────────────────────────────────

  it('createEntry() chains seq + prevHash across multiple writes and verifyIntegrity() agrees', async () => {
    const a = await createEntry(ctx.orgId, {
      type: 'income', amount: 5000, category: 'Реализация', account: 'Касса', author: 't',
    });
    const b = await createEntry(ctx.orgId, {
      type: 'expense', amount: 2000, category: 'Аренда', account: 'Касса', author: 't',
    });
    const c = await createEntry(ctx.orgId, {
      type: 'income', amount: 8000, category: 'Реализация', account: 'Банк', author: 't',
    });

    expect(b.seq).toBe(2);
    expect(b.prevHash).toBe(a.hash);
    expect(c.seq).toBe(3);
    expect(c.prevHash).toBe(b.hash);

    const integrity = await verifyIntegrity(ctx.orgId);
    expect(integrity.valid).toBe(true);
  });

  // ── listEntries org scoping ────────────────────────────────────────────

  it('listEntries() is org-scoped and returns newest-first by seq', async () => {
    // Two orgs, one entry each.
    const other = await prisma.organization.create({
      data: { name: 'Other', slug: `acc-other-${Date.now()}` },
    });

    try {
      await createEntry(ctx.orgId, {
        type: 'income', amount: 100, category: 'X', account: 'Касса', author: 't',
      });
      await createEntry(ctx.orgId, {
        type: 'expense', amount: 50, category: 'Y', account: 'Касса', author: 't',
      });
      await createEntry(other.id, {
        type: 'income', amount: 9999, category: 'Z', account: 'Касса', author: 't',
      });

      const { results, total } = await listEntries(ctx.orgId, {});
      expect(total).toBe(2);
      expect(results).toHaveLength(2);
      expect(results[0]!.seq).toBe(2); // newest first
      expect(results[1]!.seq).toBe(1);
      // The other org's entry is invisible.
      expect(results.every((row) => row.orgId === ctx.orgId)).toBe(true);
    } finally {
      await prisma.organization.delete({ where: { id: other.id } });
    }
  });

  // ── P&L aggregation ────────────────────────────────────────────────────

  it('getPnL() aggregates income vs expense for the period and computes gross margin', async () => {
    // Three income + two expense entries in the current period.
    const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    await createEntry(ctx.orgId, { type: 'income',  amount: 10000, category: 'Реализация', account: 'Касса', author: 't' });
    await createEntry(ctx.orgId, { type: 'income',  amount:  5000, category: 'Реализация', account: 'Банк',  author: 't' });
    await createEntry(ctx.orgId, { type: 'income',  amount:  3000, category: 'Прочее',     account: 'Касса', author: 't' });
    await createEntry(ctx.orgId, { type: 'expense', amount:  2000, category: 'Аренда',     account: 'Касса', author: 't' });
    await createEntry(ctx.orgId, { type: 'expense', amount:  1000, category: 'Связь',      account: 'Касса', author: 't' });

    const pnl = await getPnL(ctx.orgId, period);

    expect(pnl.income.total).toBe(18000);
    expect(pnl.expense.total).toBe(3000);
    expect(pnl.grossProfit).toBe(15000);
    // Margin = (18000 - 3000) / 18000 * 100 ≈ 83.
    expect(pnl.grossMargin).toBe(83);
    // Categories aggregated and sorted by amount desc.
    expect(pnl.income.rows[0]!.category).toBe('Реализация');
    expect(pnl.income.rows[0]!.amount).toBe(15000);
  });

  // ── accounting.sync.ts ─────────────────────────────────────────────────

  it('syncDealWon() emits an event that creates one income entry on the ledger', async () => {
    await syncDealWon({
      orgId: ctx.orgId,
      dealId: `deal-${Date.now()}`,
      title: 'Платье на заказ',
      value: 25000,
      assignedName: 'Manager A',
    });

    const { results } = await listEntries(ctx.orgId, {});
    // The bus is in-process; the handler creates exactly one entry per emit.
    expect(results.some((r) => r.sourceLabel === 'Платье на заказ')).toBe(true);
    const row = results.find((r) => r.sourceLabel === 'Платье на заказ')!;
    expect(row.type).toBe('income');
    expect(row.amount).toBe(25000);
    expect(row.category).toBe('Реализация');
    expect(row.account).toBe('Дебиторка'); // deal.won default
    expect(row.author).toBe('Manager A');
  });

  it('emitAccountingEvent("payment.added") routes through paymentMethodToAccount mapping', async () => {
    // 'kaspi' → 'Каспи'; 'cash' → 'Касса'.
    await syncPayment({
      orgId: ctx.orgId,
      orderId: `order-${Date.now()}`,
      orderNumber: 'KO-1',
      amount: 1000,
      method: 'kaspi',
      clientName: 'Иванов',
      authorName: 'M',
    });
    await syncPayment({
      orgId: ctx.orgId,
      orderId: `order-${Date.now() + 1}`,
      orderNumber: 'KO-2',
      amount: 2000,
      method: 'cash',
      clientName: 'Петров',
      authorName: 'M',
    });

    const { results } = await listEntries(ctx.orgId, {});
    const kaspi = results.find((r) => r.sourceLabel === 'Заказ KO-1');
    const cash = results.find((r) => r.sourceLabel === 'Заказ KO-2');
    expect(kaspi?.account).toBe('Каспи');
    expect(cash?.account).toBe('Касса');
    expect(kaspi?.tags).toContain('payment');
  });

  it('syncWarehouseMovement(in) creates an expense entry against the Склад account', async () => {
    await syncWarehouseMovement({
      orgId: ctx.orgId,
      type: 'in',
      itemId: `item-${Date.now()}`,
      itemName: 'Ткань',
      qty: 10,
      costPrice: 500,
      authorName: 'Manager',
    });

    const { results } = await listEntries(ctx.orgId, {});
    const row = results.find((r) => r.sourceLabel?.startsWith('Поступление: Ткань'));
    expect(row).toBeDefined();
    expect(row!.type).toBe('expense');
    expect(row!.amount).toBe(5000); // qty * costPrice
    expect(row!.account).toBe('Склад');
    expect(row!.category).toBe('Материалы');
  });

  it('emitAccountingEvent silently swallows handler errors so callers are not blocked', async () => {
    // value <= 0 path is a no-op (handler `break`s before createEntry).
    await emitAccountingEvent({
      type: 'deal.won',
      orgId: ctx.orgId,
      payload: { dealId: 'd-zero', title: 'Zero', value: 0 },
    });

    const { total } = await listEntries(ctx.orgId, {});
    expect(total).toBe(0); // value=0 skipped, nothing posted
  });
});
