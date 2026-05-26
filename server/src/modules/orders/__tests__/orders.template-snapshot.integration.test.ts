/**
 * P10d integration tests: Order.templateSnapshot edge cases (P6).
 *
 * Covers:
 *   - Order created WITH a templateId → templateSnapshot is a deep copy of
 *     OrderTemplate.sections (mutating live template later does NOT change
 *     the snapshot — read-priority contract).
 *   - Order created WITHOUT a templateId → fallback Clothing template is
 *     auto-attached and snapshot is populated from it.
 *   - Order.update with a NEW templateId → snapshot is re-frozen + OrderActivity
 *     edit event is recorded.
 *   - Order.update WITHOUT changing templateId → snapshot is left intact.
 *   - OrderItem.attributesJson is the single source of truth: no legacy
 *     top-level color/gender/length/size columns on the table.
 *
 * These complement the existing orders.integration.test.ts (which never
 * exercises templateId at all) and templates.integration.test.ts (which
 * tests templates in isolation).
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disconnectDatabase, prisma } from '../../../lib/prisma.js';
import { create, update } from '../orders.service.js';
import {
  CHEMICALS_TEMPLATE,
  CLOTHING_TEMPLATE,
  ensureSystemTemplatesForOrg,
} from '../templates.js';

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
      name: `TemplateSnapshot Org ${token}`,
      slug: `template-snapshot-${token}`,
    },
  });
  return {
    orgId: org.id,
    authorId: `author-${token}`,
    authorName: 'TS Manager',
  };
}

async function getSystemTemplateByName(orgId: string, name: string) {
  return prisma.orderTemplate.findFirstOrThrow({
    where: { orgId, isSystem: true, name },
  });
}

describe('Orders — templateSnapshot (P6) integration', () => {
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

  it('create with explicit templateId: persists templateId and a deep-copy templateSnapshot', async () => {
    await ensureSystemTemplatesForOrg(ctx.orgId);
    const chem = await getSystemTemplateByName(ctx.orgId, CHEMICALS_TEMPLATE.name);

    const order = await create(ctx.orgId, ctx.authorId, ctx.authorName, {
      clientName: 'Завод КазХим',
      clientPhone: '+7 (777) 111-22-33',
      priority: 'normal',
      templateId: chem.id,
      items: [
        {
          productName: 'Аммиак',
          quantity: 2,
          unitPrice: 50000,
          attributes: { concentration: '25%' },
        },
      ],
    });

    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.templateId).toBe(chem.id);
    expect(row.templateSnapshot).not.toBeNull();
    // Snapshot must equal the *live* template at create time.
    expect(row.templateSnapshot).toEqual(chem.sections);
  });

  it('create without templateId: falls back to system Clothing template and freezes its snapshot', async () => {
    const order = await create(ctx.orgId, ctx.authorId, ctx.authorName, {
      clientName: 'No Template Client',
      clientPhone: '+7 (701) 000-00-00',
      priority: 'normal',
      items: [
        { productName: 'Coat', size: 'M', quantity: 1, unitPrice: 10000 },
      ],
    });

    // ensureSystemTemplatesForOrg ran inside create and seeded all 7.
    const clothing = await getSystemTemplateByName(ctx.orgId, CLOTHING_TEMPLATE.name);

    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.templateId).toBe(clothing.id);
    expect(row.templateSnapshot).not.toBeNull();
    expect(row.templateSnapshot).toEqual(clothing.sections);
  });

  it('snapshot is immutable to live-template edits (read-priority contract)', async () => {
    await ensureSystemTemplatesForOrg(ctx.orgId);
    const chem = await getSystemTemplateByName(ctx.orgId, CHEMICALS_TEMPLATE.name);

    const order = await create(ctx.orgId, ctx.authorId, ctx.authorName, {
      clientName: 'Frozen Snapshot Co',
      clientPhone: '+7 (702) 999-88-77',
      priority: 'normal',
      templateId: chem.id,
      items: [
        { productName: 'Кислота', quantity: 1, unitPrice: 30000, attributes: { concentration: '10%' } },
      ],
    });

    const original = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const originalSnapshot = original.templateSnapshot;

    // Mutate live template's sections — order's snapshot must NOT follow.
    await prisma.orderTemplate.update({
      where: { id: chem.id },
      data: {
        sections: [
          { id: 'sentinel', kind: 'items', title: 'CHANGED', fields: [] },
        ] as unknown as object,
      },
    });

    const reread = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(reread.templateSnapshot).toEqual(originalSnapshot);
    expect(reread.templateSnapshot).not.toEqual([
      { id: 'sentinel', kind: 'items', title: 'CHANGED', fields: [] },
    ]);
  });

  it('update with NEW templateId: re-freezes snapshot and writes an edit activity', async () => {
    await ensureSystemTemplatesForOrg(ctx.orgId);
    const clothing = await getSystemTemplateByName(ctx.orgId, CLOTHING_TEMPLATE.name);
    const chem = await getSystemTemplateByName(ctx.orgId, CHEMICALS_TEMPLATE.name);

    const order = await create(ctx.orgId, ctx.authorId, ctx.authorName, {
      clientName: 'Switcher',
      clientPhone: '+7 (705) 222-33-44',
      priority: 'normal',
      templateId: clothing.id,
      items: [
        { productName: 'Shirt', size: 'M', quantity: 1, unitPrice: 5000 },
      ],
    });

    await update(ctx.orgId, order.id, ctx.authorId, ctx.authorName, {
      templateId: chem.id,
    });

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.templateId).toBe(chem.id);
    expect(after.templateSnapshot).toEqual(chem.sections);

    const editActivities = await prisma.orderActivity.findMany({
      where: { orderId: order.id, type: 'edit' },
    });
    const messages = editActivities.map((a) => a.content);
    expect(messages).toContain('Вид деятельности заказа изменён');
  });

  it('update WITHOUT templateId change: snapshot is preserved verbatim', async () => {
    await ensureSystemTemplatesForOrg(ctx.orgId);
    const clothing = await getSystemTemplateByName(ctx.orgId, CLOTHING_TEMPLATE.name);

    const order = await create(ctx.orgId, ctx.authorId, ctx.authorName, {
      clientName: 'Stable Snapshot',
      clientPhone: '+7 (707) 555-66-77',
      priority: 'normal',
      templateId: clothing.id,
      items: [
        { productName: 'Pants', size: 'L', quantity: 1, unitPrice: 7000 },
      ],
    });

    const before = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const beforeSnapshot = before.templateSnapshot;

    // Edit something unrelated (clientName / priority) — must not touch snapshot.
    await update(ctx.orgId, order.id, ctx.authorId, ctx.authorName, {
      clientName: 'Stable Snapshot Renamed',
      priority: 'urgent',
    });

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.templateId).toBe(clothing.id);
    expect(after.templateSnapshot).toEqual(beforeSnapshot);

    // And no 'Вид деятельности' edit activity should have been logged.
    const editActivities = await prisma.orderActivity.findMany({
      where: { orderId: order.id, type: 'edit' },
    });
    const tplSwitchMessages = editActivities
      .map((a) => a.content)
      .filter((c) => c === 'Вид деятельности заказа изменён');
    expect(tplSwitchMessages).toHaveLength(0);
  });

  it('OrderItem has no legacy color/gender/length/size top-level columns — attributesJson is single source', async () => {
    await ensureSystemTemplatesForOrg(ctx.orgId);
    const clothing = await getSystemTemplateByName(ctx.orgId, CLOTHING_TEMPLATE.name);

    const order = await create(ctx.orgId, ctx.authorId, ctx.authorName, {
      clientName: 'Single Source Client',
      clientPhone: '+7 (700) 111-11-11',
      priority: 'normal',
      templateId: clothing.id,
      items: [
        {
          productName: 'Платье',
          color: 'красный',
          gender: 'жен',
          length: 'миди',
          size: 'M',
          quantity: 1,
          unitPrice: 18000,
        },
      ],
    });

    const itemRow = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: order.id },
    });

    // The Prisma model object must NOT expose any of these as own fields.
    expect(Object.prototype.hasOwnProperty.call(itemRow, 'color')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(itemRow, 'gender')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(itemRow, 'length')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(itemRow, 'size')).toBe(false);

    // The DTO axes must instead live inside attributesJson.
    const attrs = itemRow.attributesJson as Record<string, string>;
    expect(attrs.color).toBe('красный');
    expect(attrs.gender).toBe('жен');
    expect(attrs.length).toBe('миди');
    expect(attrs.size).toBe('M');

    // Cross-check at the DB level: the physical column does not exist.
    const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'order_items'
    `;
    const colNames = new Set(cols.map((c) => c.column_name));
    expect(colNames.has('color')).toBe(false);
    expect(colNames.has('gender')).toBe(false);
    expect(colNames.has('length')).toBe(false);
    expect(colNames.has('size')).toBe(false);
    // Sanity: the attributes column must exist.
    expect(colNames.has('attributes_json')).toBe(true);
  });

  it('items update with active templateSnapshot keeps variantKey aligned to the snapshot axes', async () => {
    await ensureSystemTemplatesForOrg(ctx.orgId);
    const chem = await getSystemTemplateByName(ctx.orgId, CHEMICALS_TEMPLATE.name);

    const order = await create(ctx.orgId, ctx.authorId, ctx.authorName, {
      clientName: 'Variant Key Co',
      clientPhone: '+7 (708) 333-44-55',
      priority: 'normal',
      templateId: chem.id,
      items: [
        { productName: 'Хлорид', quantity: 1, unitPrice: 12000, attributes: { concentration: '40%' } },
      ],
    });

    const firstItem = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: order.id },
    });
    const firstKey = firstItem.variantKey;
    expect(firstKey).toBeTruthy();

    // Update with a different concentration → variantKey must change because
    // CHEMICALS marks `concentration` as affectsAvailability.
    await update(ctx.orgId, order.id, ctx.authorId, ctx.authorName, {
      items: [
        { productName: 'Хлорид', quantity: 1, unitPrice: 12000, attributes: { concentration: '60%' } },
      ],
    });

    const updatedItem = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: order.id },
    });
    expect(updatedItem.variantKey).toBeTruthy();
    expect(updatedItem.variantKey).not.toBe(firstKey);
  });
});
