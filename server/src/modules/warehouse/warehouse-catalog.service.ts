import { prisma } from '../../lib/prisma.js';
import { buildCanonicalVariantKey } from '../../shared/variant-key.js';
import { normalizeName } from '../../shared/normalize-name.js';

// ── Product Catalog ────────────────────────────────────────────────────────────
// NOTE: P0 — WarehouseFieldDefinition/Option/ProductField were removed in favour
// of the template-driven model (OrderTemplate.sections). Field metadata is now
// derived from `OrderTemplate.sections` directly; per-product field overrides
// will be reintroduced in P4 if needed.

export async function getProductCatalog(orgId: string) {
  return prisma.warehouseProductCatalog.findMany({
    where: { orgId, isActive: true },
    orderBy: { name: 'asc' },
  });
}

export async function createProduct(orgId: string, data: {
  name: string;
  source?: string;
}) {
  const name = data.name.trim();
  const normalizedName = normalizeName(name);
  return prisma.warehouseProductCatalog.upsert({
    where: { orgId_normalizedName: { orgId, normalizedName } },
    create: { orgId, name, normalizedName, source: data.source ?? 'manual' },
    update: { name, isActive: true },
  });
}

export async function updateProduct(id: string, data: { name: string }) {
  const name = data.name.trim();
  const normalizedName = normalizeName(name);
  return prisma.warehouseProductCatalog.update({
    where: { id },
    data: { name, normalizedName },
  });
}

export async function deleteProduct(id: string) {
  await prisma.warehouseProductCatalog.delete({ where: { id } });
  return { ok: true };
}

// ── Order-Form Catalog (live dropdowns) ───────────────────────────────────────
// TODO(P4): rewrite to surface `OrderTemplate.sections` field options instead
// of the removed WarehouseFieldDefinition table. For P0 we expose products
// only — the order form will fall back to free-text attributes.

export async function getOrderFormCatalog(orgId: string) {
  const products = await prisma.warehouseProductCatalog.findMany({
    where: { orgId, isActive: true },
    orderBy: { name: 'asc' },
  });

  return {
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      fields: [] as Array<{
        code: string;
        label: string;
        inputType: string;
        isRequired: boolean;
        affectsAvailability: boolean;
        options: Array<{ value: string; label: string }>;
      }>,
    })),
  };
}

// ── Variant Availability ───────────────────────────────────────────────────────

export async function checkVariantAvailability(orgId: string, data: {
  productName: string;
  attributes: Record<string, string>;
}) {
  // P0: no WarehouseFieldDefinition link table — fall back to treating every
  // attribute as a variant axis (matches legacy write path in upsertVariant).
  // TODO(P4): derive `fieldsForKey` from OrderTemplate.sections so that
  // non-axis attributes are excluded from the canonical variant fingerprint.
  const fieldsForKey = Object.keys(data.attributes).map((code) => ({
    code,
    affectsAvailability: true,
  }));

  const variantKey = buildCanonicalVariantKey(data.productName, data.attributes, fieldsForKey);

  const canonicalVariant = await prisma.warehouseVariant.findFirst({
    where: { orgId, variantKey },
    select: { id: true },
  });

  if (canonicalVariant) {
    const [canonicalBalances, compatibilityItem] = await Promise.all([
      prisma.warehouseStockBalance.aggregate({
        where: {
          orgId,
          variantId: canonicalVariant.id,
          stockStatus: 'available',
        },
        _sum: {
          qtyAvailable: true,
        },
      }),
      prisma.warehouseItem.findFirst({
        where: { orgId, variantKey },
        select: { id: true, qtyMin: true },
      }),
    ]);

    const available = canonicalBalances._sum.qtyAvailable ?? 0;
    const status: 'in_stock' | 'low' | 'out_of_stock' =
      available <= 0
        ? 'out_of_stock'
        : compatibilityItem && available <= compatibilityItem.qtyMin
          ? 'low'
          : 'in_stock';

    return {
      status,
      variantKey,
      qty: available,
      itemId: compatibilityItem?.id,
    };
  }

  const item = await prisma.warehouseItem.findFirst({
    where: { orgId, variantKey },
    select: { id: true, qty: true, qtyReserved: true, qtyMin: true, name: true },
  });

  if (!item) {

    // Fallback: search by product name only (no variant match)
    const byName = await prisma.warehouseItem.findFirst({
      where: {
        orgId,
        name: { contains: data.productName.trim(), mode: 'insensitive' },
      },
      select: { qty: true, qtyReserved: true, qtyMin: true },
    });
    return {
      status: 'unknown' as const,
      variantKey,
      qty: byName ? byName.qty - byName.qtyReserved : null,
    };
  }

  const available = item.qty - item.qtyReserved;
  const status =
    available <= 0
      ? 'out_of_stock'
      : available <= item.qtyMin
        ? 'low'
        : 'in_stock';

  return { status, variantKey, qty: available, itemId: item.id };
}

// ── Smart import (one-click robot) ────────────────────────────────────────────

export async function smartImportProducts(
  orgId: string,
  rows: string[],
): Promise<{ fields: { created: string[]; skipped: string[] }; products: { created: number; skipped: number; errors: string[] } }> {
  // P0: field-definition table removed. Smart import now only upserts products.
  // TODO(P4): seed default fields into OrderTemplate.sections for new orgs.
  const fields = { created: [] as string[], skipped: [] as string[] };

  const BATCH = 50;
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];
  const productIds: string[] = [];

  const validRows = rows.map((r) => r.trim()).filter(Boolean);
  skipped += rows.length - validRows.length;

  for (let i = 0; i < validRows.length; i += BATCH) {
    const chunk = validRows.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      chunk.map((name) => {
        const normalizedName = normalizeName(name);
        return prisma.warehouseProductCatalog.upsert({
          where: { orgId_normalizedName: { orgId, normalizedName } },
          create: { orgId, name, normalizedName, source: 'excel_import' },
          update: { name, isActive: true },
          select: { id: true },
        });
      }),
    );
    for (const [j, r] of results.entries()) {
      if (r.status === 'fulfilled') {
        productIds.push(r.value.id);
        created++;
      } else {
        errors.push(`"${chunk[j] ?? ''}": ${(r.reason as any)?.message ?? 'unknown error'}`);
      }
    }
  }

  return { fields, products: { created, skipped, errors } };
}

export async function smartImportColors(
  _orgId: string,
  rows: string[],
): Promise<{ field: string; created: number; skipped: number; errors: string[] }> {
  // P0: field-option table removed; nothing to import.
  // TODO(P4): write into OrderTemplate.sections color-field options instead.
  const skipped = rows.map((r) => r.trim()).filter(Boolean).length;
  return { field: 'color', created: 0, skipped, errors: [] };
}

export async function importProductsFromRows(
  orgId: string,
  rows: string[],
): Promise<{ created: number; skipped: number; errors: string[] }> {
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const raw of rows) {
    const name = raw.trim();
    if (!name) { skipped++; continue; }
    const normalizedName = normalizeName(name);
    try {
      await prisma.warehouseProductCatalog.upsert({
        where: { orgId_normalizedName: { orgId, normalizedName } },
        create: { orgId, name, normalizedName, source: 'excel_import' },
        update: { name, isActive: true },
      });
      created++;
    } catch (e: any) {
      errors.push(`"${name}": ${e?.message ?? 'unknown error'}`);
    }
  }

  return { created, skipped, errors };
}
