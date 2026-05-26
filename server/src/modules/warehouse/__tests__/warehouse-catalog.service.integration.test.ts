/**
 * Integration tests for warehouse-catalog.service.ts.
 *
 * Scope: covers the catalog logic after the multi-business refactor
 * (P0/P1/P3/P4):
 *   - createProduct + updateProduct (normalization, upsert, price/template
 *     updates)
 *   - getOrderFormCatalog (templateId scoping, empty fields contract)
 *   - checkVariantAvailability (single variant, custom axes, name
 *     normalization)
 *
 * Runs against the real test DB, mirroring warehouse.service.integration.test.ts
 * and orders.integration.test.ts. Each test creates a throwaway org and lets
 * the Organization cascade clean up.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { disconnectDatabase, prisma } from '../../../lib/prisma.js';
import {
  checkVariantAvailability,
  createProduct,
  getOrderFormCatalog,
  updateProduct,
} from '../warehouse-catalog.service.js';
import { normalizeName } from '../../../shared/normalize-name.js';
import { buildCanonicalVariantKey } from '../../../shared/variant-key.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

type TestContext = {
  orgId: string;
  templateId: string;
  otherTemplateId: string;
};

async function createTestContext(): Promise<TestContext> {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const org = await prisma.organization.create({
    data: {
      name: `Catalog Integration Org ${token}`,
      slug: `catalog-integration-${token}`,
    },
  });
  const template = await prisma.orderTemplate.create({
    data: {
      orgId: org.id,
      name: `Primary ${token}`,
      isDefault: true,
      sections: [],
    },
  });
  const other = await prisma.orderTemplate.create({
    data: {
      orgId: org.id,
      name: `Other ${token}`,
      isDefault: false,
      sections: [],
    },
  });
  return {
    orgId: org.id,
    templateId: template.id,
    otherTemplateId: other.id,
  };
}

/**
 * Direct prisma write of a WarehouseItem with a precomputed variantKey so
 * checkVariantAvailability has something to find. Mirrors the helper used by
 * warehouse.service.integration.test.ts.
 */
async function provisionVariant(
  orgId: string,
  args: {
    name: string;
    attributes?: Record<string, string>;
    qty?: number;
    qtyReserved?: number;
    qtyMin?: number;
  },
) {
  const attrs = args.attributes ?? {};
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
      qty: args.qty ?? 0,
      qtyReserved: args.qtyReserved ?? 0,
      qtyMin: args.qtyMin ?? 0,
      verificationRequired: false,
      variantKey,
      attributesJson: Object.keys(attrs).length > 0 ? attrs : undefined,
      qrCode: `KORT-CAT-TEST-${Math.random().toString(36).slice(2, 12)}`,
      tags: [],
    },
  });
}

describe('warehouse-catalog.service — integration', () => {
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

  // ── createProduct + updateProduct ─────────────────────────────────────────

  describe('createProduct', () => {
    it('happy path: creates a row with normalizedName, template binding, and prices', async () => {
      const product = await createProduct(ctx.orgId, {
        name: '  Худи Premium  ',
        templateId: ctx.templateId,
        defaultRetailPrice: 12000,
        defaultWholesalePrice: 9000,
      });

      expect(product.name).toBe('Худи Premium');
      expect(product.normalizedName).toBe(normalizeName('Худи Premium'));
      expect(product.templateId).toBe(ctx.templateId);
      expect(Number(product.defaultRetailPrice)).toBe(12000);
      expect(Number(product.defaultWholesalePrice)).toBe(9000);
      expect(product.source).toBe('manual');
      expect(product.isActive).toBe(true);
    });

    it('upserts on normalizedName collision within an org (re-create with same name → same row)', async () => {
      const first = await createProduct(ctx.orgId, {
        name: 'Свитер',
        templateId: ctx.templateId,
        defaultRetailPrice: 5000,
      });
      const again = await createProduct(ctx.orgId, {
        name: 'свитер',  // different casing → same normalizedName
        defaultRetailPrice: 7000,
      });

      expect(again.id).toBe(first.id);
      // upsert update path overwrites name to the new trimmed form.
      expect(again.name).toBe('свитер');
      expect(Number(again.defaultRetailPrice)).toBe(7000);
    });

    it('cross-template collision in same org: same normalizedName cannot live under two templates', async () => {
      // The unique constraint is @@unique([orgId, normalizedName]) — independent
      // of templateId. The second call therefore upserts the existing row and
      // moves it to the new templateId (overwrite semantics).
      await createProduct(ctx.orgId, {
        name: 'Перчатки',
        templateId: ctx.templateId,
      });
      const moved = await createProduct(ctx.orgId, {
        name: 'Перчатки',
        templateId: ctx.otherTemplateId,
      });

      expect(moved.templateId).toBe(ctx.otherTemplateId);
      // Confirm there is exactly one row, not two.
      const all = await prisma.warehouseProductCatalog.findMany({
        where: { orgId: ctx.orgId, normalizedName: normalizeName('Перчатки') },
      });
      expect(all).toHaveLength(1);
    });
  });

  describe('updateProduct', () => {
    it('updates default retail + wholesale prices', async () => {
      const product = await createProduct(ctx.orgId, {
        name: 'Куртка',
        templateId: ctx.templateId,
        defaultRetailPrice: 10000,
        defaultWholesalePrice: 7000,
      });
      const updated = await updateProduct(product.id, {
        defaultRetailPrice: 15000,
        defaultWholesalePrice: 11000,
      });
      expect(Number(updated.defaultRetailPrice)).toBe(15000);
      expect(Number(updated.defaultWholesalePrice)).toBe(11000);
    });

    it('updates templateId to a different one', async () => {
      const product = await createProduct(ctx.orgId, {
        name: 'Шапка',
        templateId: ctx.templateId,
      });
      const updated = await updateProduct(product.id, {
        templateId: ctx.otherTemplateId,
      });
      expect(updated.templateId).toBe(ctx.otherTemplateId);
    });

    it('updating name also recomputes normalizedName', async () => {
      const product = await createProduct(ctx.orgId, {
        name: 'Брюки',
        templateId: ctx.templateId,
      });
      const updated = await updateProduct(product.id, { name: '  Шорты  ' });
      expect(updated.name).toBe('Шорты');
      expect(updated.normalizedName).toBe(normalizeName('Шорты'));
    });
  });

  // ── getOrderFormCatalog ────────────────────────────────────────────────────

  describe('getOrderFormCatalog', () => {
    it('without templateId: returns all active products of the org', async () => {
      await createProduct(ctx.orgId, { name: 'Альфа', templateId: ctx.templateId });
      await createProduct(ctx.orgId, { name: 'Бета', templateId: ctx.otherTemplateId });
      await createProduct(ctx.orgId, { name: 'Гамма' }); // no template binding

      const result = await getOrderFormCatalog(ctx.orgId);
      const names = result.products.map((p) => p.name).sort();
      expect(names).toEqual(['Альфа', 'Бета', 'Гамма']);
    });

    it('with templateId: only returns products bound to that template', async () => {
      await createProduct(ctx.orgId, { name: 'Альфа', templateId: ctx.templateId });
      await createProduct(ctx.orgId, { name: 'Бета', templateId: ctx.otherTemplateId });
      await createProduct(ctx.orgId, { name: 'Гамма' });

      const result = await getOrderFormCatalog(ctx.orgId, { templateId: ctx.templateId });
      const names = result.products.map((p) => p.name).sort();
      expect(names).toEqual(['Альфа']);
    });

    it('each product exposes empty fields[] until P4 wires sections into the catalog', async () => {
      await createProduct(ctx.orgId, {
        name: 'Тестовый',
        templateId: ctx.templateId,
        defaultRetailPrice: 999,
      });
      const result = await getOrderFormCatalog(ctx.orgId, { templateId: ctx.templateId });
      expect(result.products).toHaveLength(1);
      expect(result.products[0]?.fields).toEqual([]);
      expect(result.products[0]?.defaultRetailPrice).toBe(999);
    });
  });

  // ── checkVariantAvailability ───────────────────────────────────────────────

  describe('checkVariantAvailability (singular, catalog-side)', () => {
    it('returns qty and in_stock status for a single matching variant', async () => {
      await provisionVariant(ctx.orgId, {
        name: 'Парфюм',
        attributes: { concentration: '10%' },
        qty: 7,
      });
      const result = await checkVariantAvailability(ctx.orgId, {
        productName: 'Парфюм',
        attributes: { concentration: '10%' },
      });
      expect(result.qty).toBe(7);
      expect(result.status).toBe('in_stock');
      expect(result.variantKey).toBeTruthy();
    });

    it('isolates variants by axis values: 10% and 20% have distinct qty', async () => {
      await provisionVariant(ctx.orgId, {
        name: 'Реактив',
        attributes: { concentration: '10%', material: 'сталь' },
        qty: 4,
      });
      await provisionVariant(ctx.orgId, {
        name: 'Реактив',
        attributes: { concentration: '20%', material: 'сталь' },
        qty: 9,
      });

      const a = await checkVariantAvailability(ctx.orgId, {
        productName: 'Реактив',
        attributes: { concentration: '10%', material: 'сталь' },
      });
      const b = await checkVariantAvailability(ctx.orgId, {
        productName: 'Реактив',
        attributes: { concentration: '20%', material: 'сталь' },
      });

      expect(a.qty).toBe(4);
      expect(b.qty).toBe(9);
      expect(a.variantKey).not.toBe(b.variantKey);
    });

    it('low status when available qty is at or below qtyMin', async () => {
      await provisionVariant(ctx.orgId, {
        name: 'Лимит',
        attributes: { size: 'M' },
        qty: 2,
        qtyMin: 5,
      });
      const result = await checkVariantAvailability(ctx.orgId, {
        productName: 'Лимит',
        attributes: { size: 'M' },
      });
      // qty(2) - reserved(0) = 2 ≤ qtyMin(5) → low (not out_of_stock since qty > 0).
      expect(result.qty).toBe(2);
      expect(result.status).toBe('low');
    });

    it('out_of_stock when reservations consume the entire qty', async () => {
      await provisionVariant(ctx.orgId, {
        name: 'Распродано',
        attributes: { size: 'L' },
        qty: 5,
        qtyReserved: 5,
      });
      const result = await checkVariantAvailability(ctx.orgId, {
        productName: 'Распродано',
        attributes: { size: 'L' },
      });
      expect(result.qty).toBe(0);
      expect(result.status).toBe('out_of_stock');
    });

    it('productName normalization: variations in case/whitespace resolve to the same variant', async () => {
      await provisionVariant(ctx.orgId, {
        name: 'Хайнекен',
        attributes: { volume: '0.5л' },
        qty: 12,
      });
      const result = await checkVariantAvailability(ctx.orgId, {
        productName: '  хайнекен  ',
        attributes: { volume: '0.5л' },
      });
      expect(result.qty).toBe(12);
      expect(result.status).toBe('in_stock');
    });

    it('unknown variant for an existing name falls back to name-contains lookup (qty from any same-name item)', async () => {
      // No variant match — service falls back to WarehouseItem name search.
      await provisionVariant(ctx.orgId, {
        name: 'Базовый',
        attributes: { size: 'M' },
        qty: 10,
        qtyReserved: 3,
      });
      const result = await checkVariantAvailability(ctx.orgId, {
        productName: 'Базовый',
        attributes: { size: '999' },
      });
      // status is 'unknown' because no exact variant match.
      expect(result.status).toBe('unknown');
      // qty falls back to the name-based item's available (qty - reserved).
      expect(result.qty).toBe(7);
    });

    it('completely unknown name and attributes returns unknown with qty=null', async () => {
      const result = await checkVariantAvailability(ctx.orgId, {
        productName: 'Никогда не существовавший',
        attributes: { size: 'M' },
      });
      expect(result.status).toBe('unknown');
      expect(result.qty).toBeNull();
    });
  });
});
