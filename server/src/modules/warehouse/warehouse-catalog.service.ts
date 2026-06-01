import { nanoid } from 'nanoid';
import { prisma } from '../../lib/prisma.js';
import { buildCanonicalVariantKey } from '../../shared/variant-key.js';
import { normalizeName } from '../../shared/normalize-name.js';
import type { OrderTemplateField, OrderTemplateSection } from '../orders/templates.js';

// Keys that are internal order-form mechanics, not catalog attributes
const CATALOG_SKIP_KEYS = new Set([
  'product', 'productName', 'name', 'qty', 'quantity',
  'unitPrice', 'unit_price', 'price', 'itemDiscount',
]);

type OrderFormFieldShape = {
  code: string;
  label: string;
  inputType: string;
  isRequired: boolean;
  affectsAvailability: boolean;
  options: Array<{ value: string; label: string }>;
};

function fieldsFromTemplateSections(sections: OrderTemplateSection[]): OrderFormFieldShape[] {
  const itemsSection = sections.find((s) => s.kind === 'items');
  if (!itemsSection) return [];
  return itemsSection.fields
    .filter((f) => !CATALOG_SKIP_KEYS.has(f.key))
    .map((f) => ({
      code: f.key,
      label: f.label,
      inputType: f.type,
      isRequired: f.required ?? false,
      affectsAvailability: f.affectsAvailability ?? false,
      options: (f.options ?? []).map((v) => ({ value: v, label: v })),
    }));
}

// ── Product Catalog ────────────────────────────────────────────────────────────
// NOTE: P0 — WarehouseFieldDefinition/Option/ProductField were removed in favour
// of the template-driven model (OrderTemplate.sections). Field metadata is now
// derived from `OrderTemplate.sections` directly; per-product field overrides
// will be reintroduced in P4 if needed.

export async function getProductCatalog(
  orgId: string,
  opts?: { templateId?: string | null },
) {
  return prisma.warehouseProductCatalog.findMany({
    where: {
      orgId,
      isActive: true,
      ...(opts?.templateId ? { templateId: opts.templateId } : {}),
    },
    orderBy: { name: 'asc' },
  });
}

export async function createProduct(orgId: string, data: {
  name: string;
  source?: string;
  templateId?: string | null;
  defaultRetailPrice?: number | null;
  defaultWholesalePrice?: number | null;
}) {
  const name = data.name.trim();
  const normalizedName = normalizeName(name);
  return prisma.warehouseProductCatalog.upsert({
    where: { orgId_normalizedName: { orgId, normalizedName } },
    create: {
      orgId,
      name,
      normalizedName,
      source: data.source ?? 'manual',
      templateId: data.templateId ?? null,
      defaultRetailPrice: data.defaultRetailPrice ?? null,
      defaultWholesalePrice: data.defaultWholesalePrice ?? null,
    },
    update: {
      name,
      isActive: true,
      ...(data.templateId !== undefined ? { templateId: data.templateId } : {}),
      ...(data.defaultRetailPrice !== undefined ? { defaultRetailPrice: data.defaultRetailPrice } : {}),
      ...(data.defaultWholesalePrice !== undefined ? { defaultWholesalePrice: data.defaultWholesalePrice } : {}),
    },
  });
}

export async function updateProduct(id: string, data: {
  name?: string;
  templateId?: string | null;
  defaultRetailPrice?: number | null;
  defaultWholesalePrice?: number | null;
}) {
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    patch.name = trimmed;
    patch.normalizedName = normalizeName(trimmed);
  }
  if (data.templateId !== undefined) patch.templateId = data.templateId;
  if (data.defaultRetailPrice !== undefined) patch.defaultRetailPrice = data.defaultRetailPrice;
  if (data.defaultWholesalePrice !== undefined) patch.defaultWholesalePrice = data.defaultWholesalePrice;
  return prisma.warehouseProductCatalog.update({
    where: { id },
    data: patch,
  });
}

export async function deleteProduct(id: string) {
  await prisma.warehouseProductCatalog.delete({ where: { id } });
  return { ok: true };
}

// ── Order-Form Catalog (live dropdowns) ───────────────────────────────────────

export async function getOrderFormCatalog(
  orgId: string,
  opts?: { templateId?: string | null },
) {
  const products = await prisma.warehouseProductCatalog.findMany({
    where: {
      orgId,
      isActive: true,
      ...(opts?.templateId ? { templateId: opts.templateId } : {}),
    },
    orderBy: { name: 'asc' },
  });

  // Batch-load the templates needed for field derivation
  const templateIds = [...new Set(products.map((p) => p.templateId).filter(Boolean) as string[])];
  const templates = templateIds.length > 0
    ? await prisma.orderTemplate.findMany({
        where: { id: { in: templateIds }, orgId },
        select: { id: true, sections: true },
      })
    : [];
  const tplMap = new Map(templates.map((t) => [t.id, t.sections as unknown as OrderTemplateSection[]]));

  return {
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      templateId: p.templateId ?? null,
      defaultRetailPrice: p.defaultRetailPrice ? Number(p.defaultRetailPrice) : null,
      defaultWholesalePrice: p.defaultWholesalePrice ? Number(p.defaultWholesalePrice) : null,
      fields: p.templateId ? fieldsFromTemplateSections(tplMap.get(p.templateId) ?? []) : [],
    })),
  };
}

// ── Catalog Field Definitions (virtual layer over OrderTemplate.sections) ─────
// P4: field definitions are stored as JSON inside OrderTemplate.sections.items.fields[].
// These helpers expose a WarehouseFieldDefinition-compatible CRUD surface so the
// CatalogTemplateSettings UI can create/edit/delete fields without knowing about templates.
//
// The "active" template for definition edits = the org's default template
// (isDefault:true) or the first template alphabetically if none is flagged default.

type FieldDefShape = {
  id: string;
  orgId: string;
  templateId: string;
  code: string;
  label: string;
  entityScope: string;
  inputType: string;
  isRequired: boolean;
  isVariantAxis: boolean;
  showInWarehouseForm: boolean;
  showInOrderForm: boolean;
  showInDocuments: boolean;
  affectsAvailability: boolean;
  sortOrder: number;
  isSystem: boolean;
  options: Array<{
    id: string;
    definitionId: string;
    value: string;
    label: string;
    sortOrder: number;
    colorHex: null;
    isActive: boolean;
  }>;
};

function fieldToDefShape(orgId: string, templateId: string, field: OrderTemplateField, idx: number, isSystem: boolean): FieldDefShape {
  return {
    id: field.id,
    orgId,
    templateId,
    code: field.key,
    label: field.label,
    entityScope: 'product',
    inputType: field.type,
    isRequired: field.required ?? false,
    isVariantAxis: field.affectsAvailability ?? false,
    showInWarehouseForm: true,
    showInOrderForm: true,
    showInDocuments: false,
    affectsAvailability: field.affectsAvailability ?? false,
    sortOrder: idx,
    isSystem,
    options: (field.options ?? []).map((v, oi) => ({
      id: `${field.id}_${oi}`,
      definitionId: field.id,
      value: v,
      label: v,
      sortOrder: oi,
      colorHex: null,
      isActive: true,
    })),
  };
}

async function getDefaultTemplate(orgId: string) {
  return prisma.orderTemplate.findFirst({
    where: { orgId },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
}

async function findTemplateWithField(orgId: string, fieldId: string) {
  const templates = await prisma.orderTemplate.findMany({
    where: { orgId },
    select: { id: true, isSystem: true, sections: true },
  });
  for (const tpl of templates) {
    const sections = tpl.sections as unknown as OrderTemplateSection[];
    const itemsSection = sections.find((s) => s.kind === 'items');
    const field = itemsSection?.fields.find((f) => f.id === fieldId);
    if (field) return { tpl, sections, itemsSection: itemsSection!, field };
  }
  return null;
}

export async function listFieldDefinitions(orgId: string): Promise<FieldDefShape[]> {
  const templates = await prisma.orderTemplate.findMany({
    where: { orgId },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    select: { id: true, isSystem: true, sections: true },
  });

  const defs: FieldDefShape[] = [];
  const seenCodes = new Set<string>();

  for (const tpl of templates) {
    const sections = tpl.sections as unknown as OrderTemplateSection[];
    const itemsSection = sections.find((s) => s.kind === 'items');
    if (!itemsSection) continue;
    const nonSystemFields = itemsSection.fields.filter((f) => !CATALOG_SKIP_KEYS.has(f.key));
    nonSystemFields.forEach((f, idx) => {
      if (!seenCodes.has(f.key)) {
        seenCodes.add(f.key);
        defs.push(fieldToDefShape(orgId, tpl.id, f, idx, tpl.isSystem));
      }
    });
  }

  return defs;
}

export async function createFieldDefinition(orgId: string, data: {
  code: string;
  label: string;
  inputType: string;
  isVariantAxis?: boolean;
  affectsAvailability?: boolean;
  showInWarehouseForm?: boolean;
  showInOrderForm?: boolean;
  sortOrder?: number;
}): Promise<FieldDefShape> {
  const tpl = await getDefaultTemplate(orgId);
  if (!tpl) throw new Error('Нет шаблонов заказов. Сначала создайте хотя бы один шаблон.');

  const sections = tpl.sections as unknown as OrderTemplateSection[];
  let itemsSection = sections.find((s) => s.kind === 'items');
  if (!itemsSection) {
    itemsSection = { id: `sec_items_${nanoid(8)}`, kind: 'items', title: 'Позиции', fields: [] };
    sections.push(itemsSection);
  }

  const newField: OrderTemplateField = {
    id: `f_${nanoid(10)}`,
    key: data.code.trim().toLowerCase().replace(/\s+/g, '_'),
    label: data.label.trim(),
    type: data.inputType as OrderTemplateField['type'],
    required: false,
    options: [],
    affectsAvailability: data.affectsAvailability ?? data.isVariantAxis ?? false,
  };

  itemsSection.fields.push(newField);

  await prisma.orderTemplate.update({
    where: { id: tpl.id },
    data: { sections: sections as unknown as import('@prisma/client').Prisma.JsonArray },
  });

  const idx = itemsSection.fields.length - 1;
  return fieldToDefShape(orgId, tpl.id, newField, idx, tpl.isSystem);
}

export async function updateFieldDefinition(orgId: string, fieldId: string, patch: {
  label?: string;
  affectsAvailability?: boolean;
  isVariantAxis?: boolean;
  inputType?: string;
}): Promise<FieldDefShape> {
  const found = await findTemplateWithField(orgId, fieldId);
  if (!found) throw new Error('Поле не найдено');
  const { tpl, sections, itemsSection, field } = found;

  if (patch.label !== undefined) field.label = patch.label.trim();
  if (patch.affectsAvailability !== undefined) field.affectsAvailability = patch.affectsAvailability;
  if (patch.isVariantAxis !== undefined) field.affectsAvailability = patch.isVariantAxis;
  if (patch.inputType !== undefined) field.type = patch.inputType as OrderTemplateField['type'];

  await prisma.orderTemplate.update({
    where: { id: tpl.id },
    data: { sections: sections as unknown as import('@prisma/client').Prisma.JsonArray },
  });

  const idx = itemsSection.fields.findIndex((f) => f.id === fieldId);
  return fieldToDefShape(orgId, tpl.id, field, idx, tpl.isSystem);
}

export async function deleteFieldDefinition(orgId: string, fieldId: string): Promise<{ ok: boolean }> {
  const found = await findTemplateWithField(orgId, fieldId);
  if (!found) return { ok: true };
  const { tpl, sections, itemsSection } = found;

  itemsSection.fields = itemsSection.fields.filter((f) => f.id !== fieldId);

  await prisma.orderTemplate.update({
    where: { id: tpl.id },
    data: { sections: sections as unknown as import('@prisma/client').Prisma.JsonArray },
  });

  return { ok: true };
}

export async function addFieldOption(orgId: string, fieldId: string, value: string, label: string): Promise<{
  id: string; definitionId: string; value: string; label: string; sortOrder: number; colorHex: null; isActive: boolean;
}> {
  const found = await findTemplateWithField(orgId, fieldId);
  if (!found) throw new Error('Поле не найдено');
  const { tpl, sections, field } = found;

  const options = field.options ?? [];
  if (!options.includes(value.trim())) {
    options.push(value.trim());
    field.options = options;
    await prisma.orderTemplate.update({
      where: { id: tpl.id },
      data: { sections: sections as unknown as import('@prisma/client').Prisma.JsonArray },
    });
  }

  const idx = field.options!.indexOf(value.trim());
  return {
    id: `${fieldId}_${idx}`,
    definitionId: fieldId,
    value: value.trim(),
    label: label.trim() || value.trim(),
    sortOrder: idx,
    colorHex: null,
    isActive: true,
  };
}

export async function deleteFieldOption(orgId: string, fieldId: string, optId: string): Promise<{ ok: boolean }> {
  const found = await findTemplateWithField(orgId, fieldId);
  if (!found) return { ok: true };
  const { tpl, sections, field } = found;

  // optId format: `${fieldId}_${index}` — extract the value from the index
  const idxStr = optId.startsWith(`${fieldId}_`) ? optId.slice(fieldId.length + 1) : null;
  const idx = idxStr !== null ? parseInt(idxStr, 10) : -1;
  const options = field.options ?? [];

  let valueToRemove: string | undefined;
  if (idx >= 0 && idx < options.length) {
    valueToRemove = options[idx];
  } else {
    // Fallback: try to match by value directly (legacy compatibility)
    valueToRemove = options.find((o) => o === optId);
  }

  if (valueToRemove !== undefined) {
    field.options = options.filter((o) => o !== valueToRemove);
    await prisma.orderTemplate.update({
      where: { id: tpl.id },
      data: { sections: sections as unknown as import('@prisma/client').Prisma.JsonArray },
    });
  }

  return { ok: true };
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
