/**
 * P10f integration tests for the invoices module:
 *   - invoices.service.ts (createInvoice, listInvoices, getInvoice,
 *     previewInvoiceDocument)
 *   - invoice.service.ts  (generateInvoiceXlsx / branded style)
 *   - z2-invoice-template.service.ts (generateDefaultInvoiceTemplateXlsx)
 *
 * The whole module sits on top of OrderItem.attributesJson now (P0): the
 * legacy color/size/length/gender columns are gone, so every output that used
 * to read them must read out of the JSON bag instead. These tests pin that
 * contract from end to end.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disconnectDatabase, prisma } from '../../../lib/prisma.js';
import {
  create as createOrder,
  fulfillFromStock,
} from '../../orders/orders.service.js';
import {
  createInvoice,
  getInvoice,
  listInvoices,
  previewInvoiceDocument,
} from '../invoices.service.js';
import { generateInvoiceXlsx } from '../invoice.service.js';
import {
  generateDefaultInvoiceTemplateXlsx,
} from '../z2-invoice-template.service.js';

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
    data: {
      name: `Invoices Org ${token}`,
      slug: `invoices-${token}`,
      bin: '123456789012',
      legalName: 'ТОО Тестовая',
      director: 'Иванов И.И.',
    },
  });
  return {
    orgId: org.id,
    authorId: `author-${token}`,
    authorName: 'Invoice Manager',
  };
}

async function createReadyOrder(ctx: TestContext, opts?: {
  quantity?: number;
  unitPrice?: number;
  size?: string;
  color?: string;
}) {
  const order = await createOrder(ctx.orgId, ctx.authorId, ctx.authorName, {
    clientName: 'Invoice Client',
    clientPhone: '+7 (701) 222-33-44',
    priority: 'normal',
    items: [
      {
        productName: 'Платье',
        size: opts?.size ?? 'M',
        color: opts?.color ?? 'Blue',
        quantity: opts?.quantity ?? 2,
        unitPrice: opts?.unitPrice ?? 5000,
      },
    ],
  });
  // fulfillFromStock skips production and lands the order in 'ready', which
  // is what createInvoice requires.
  await fulfillFromStock(ctx.orgId, order.id, ctx.authorId, ctx.authorName);
  return order;
}

describe('Invoices — service + document generation (integration)', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    vi.clearAllMocks();
    ctx = await createTestContext();
  });

  afterEach(async () => {
    // Invoice → InvoiceOrder → Order has RESTRICT on the order_id FK, so the
    // org cascade can't drop orders that an invoice still points at. Drop
    // invoices first (cascades the junction rows), then the org cascade
    // removes orders/users/etc.
    await prisma.invoice.deleteMany({ where: { orgId: ctx.orgId } });
    await prisma.organization.deleteMany({ where: { id: ctx.orgId } });
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  // ── invoices.service.ts ────────────────────────────────────────────────

  it('createInvoice() builds an Invoice + document payload from a ready order', async () => {
    const order = await createReadyOrder(ctx, { quantity: 3, unitPrice: 5000 });

    const invoice = await createInvoice(
      ctx.orgId,
      ctx.authorId,
      ctx.authorName,
      [order.id],
    );

    expect(invoice).toBeDefined();
    expect(invoice!.invoiceNumber).toBeTruthy();
    expect(invoice!.items).toHaveLength(1);
    expect(invoice!.items[0]!.orderId).toBe(order.id);
    // Seamstress is auto-confirmed on create (issuer = seamstress side).
    expect(invoice!.seamstressConfirmed).toBe(true);
    expect(invoice!.warehouseConfirmed).toBe(false);

    // Document payload: one row aggregated, qty 3 at 5000.
    const doc = invoice!.documentPayload as { rows: Array<{ quantity: number; unitPrice: number; size: string; color: string }> };
    expect(doc.rows).toHaveLength(1);
    expect(doc.rows[0]).toMatchObject({
      quantity: 3,
      unitPrice: 5000,
      size: 'M',
      color: 'Blue',
    });
  });

  it('createInvoice() refuses orders that are not in status=ready', async () => {
    // Order in status='new' — never advanced to ready.
    const order = await createOrder(ctx.orgId, ctx.authorId, ctx.authorName, {
      clientName: 'Not Ready',
      clientPhone: '+7 (701) 000-00-00',
      priority: 'normal',
      items: [{ productName: 'X', size: 'S', quantity: 1, unitPrice: 1000 }],
    });

    await expect(
      createInvoice(ctx.orgId, ctx.authorId, ctx.authorName, [order.id]),
    ).rejects.toThrow(/Готово/);
  });

  it('listInvoices() scopes to org and returns the right count', async () => {
    const a = await createReadyOrder(ctx, { unitPrice: 1000 });
    const b = await createReadyOrder(ctx, { unitPrice: 2000 });
    await createInvoice(ctx.orgId, ctx.authorId, ctx.authorName, [a.id]);
    await createInvoice(ctx.orgId, ctx.authorId, ctx.authorName, [b.id]);

    const { results, count } = await listInvoices(ctx.orgId);
    expect(count).toBe(2);
    expect(results).toHaveLength(2);
    // findMany orderBy createdAt:desc → newest first.
    expect(results[0]!.items[0]!.orderId).toBe(b.id);
    expect(results[1]!.items[0]!.orderId).toBe(a.id);
  });

  it('getInvoice() reads items via OrderItem.attributesJson (P0 contract)', async () => {
    const order = await createReadyOrder(ctx, {
      size: 'XL',
      color: 'Green',
      quantity: 2,
      unitPrice: 7500,
    });

    // Sanity: the underlying OrderItem must carry the attributes in JSON.
    const stored = await prisma.orderItem.findFirst({
      where: { orderId: order.id },
      select: { attributesJson: true, productName: true },
    });
    expect(stored?.attributesJson).toMatchObject({ size: 'XL', color: 'Green' });

    const invoice = await createInvoice(
      ctx.orgId,
      ctx.authorId,
      ctx.authorName,
      [order.id],
    );
    const fetched = await getInvoice(ctx.orgId, invoice!.id);
    const row = (fetched as any).documentPayload.rows[0];
    expect(row.size).toBe('XL');
    expect(row.color).toBe('Green');
  });

  it('previewInvoiceDocument() returns the same shape without creating an Invoice', async () => {
    const order = await createReadyOrder(ctx, { quantity: 4, unitPrice: 2500 });

    const before = await prisma.invoice.count({ where: { orgId: ctx.orgId } });
    const preview = await previewInvoiceDocument(ctx.orgId, [order.id]);
    const after = await prisma.invoice.count({ where: { orgId: ctx.orgId } });

    expect(after).toBe(before); // preview never writes
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]!.quantity).toBe(4);
    expect(preview.rows[0]!.unitPrice).toBe(2500);
  });

  // ── invoice.service.ts (branded XLSX) ──────────────────────────────────

  it('generateInvoiceXlsx() returns a real XLSX buffer (ZIP signature PK\\x03\\x04)', async () => {
    const order = await createReadyOrder(ctx);

    const buffer = await generateInvoiceXlsx(ctx.orgId, order.id, 'branded');

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(100);
    // XLSX files are ZIP archives starting with "PK\x03\x04".
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
    expect(buffer[2]).toBe(0x03);
    expect(buffer[3]).toBe(0x04);
  });

  // ── z2-invoice-template.service.ts ─────────────────────────────────────

  it('generateDefaultInvoiceTemplateXlsx() produces a Z-2 template buffer', async () => {
    const order = await createReadyOrder(ctx);

    const buffer = await generateDefaultInvoiceTemplateXlsx(ctx.orgId, order.id);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000); // template is non-trivial
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });
});
