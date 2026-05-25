// P3 multi-business — Catalog-is-source-of-truth warehouse "add item" form.
//
// Hard rules enforced here:
//   1. Поле «Название товара» — только Autocomplete из каталога активного
//      шаблона. Произвольный текст не принимается (защита от дурака).
//   2. Если каталог по активному шаблону пуст — показываем empty-state со
//      ссылкой на /products, форма не рендерится вовсе.
//   3. После выбора товара цены defaultRetailPrice / defaultWholesalePrice
//      автоподставляются в «Цена» (поле остаётся редактируемым).
//
// P1 schema-driven attribute rendering сохранён: дополнительные параметры
// позиции (color/size/concentration/...) подтягиваются из активного
// OrderTemplate.sections.items.fields и проходят через TemplateAttributeRenderer.

import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCreateItem, useOrderFormCatalog } from '@/entities/warehouse/queries';
import type { CreateItemDto, OrderFormProduct } from '@/entities/warehouse/types';
import { useActiveOrderTemplate } from '@/entities/order/templatesApi';
import { getItemsSection, type OrderTemplateField } from '@/entities/order/templates';
import { TemplateAttributeRenderer, type TemplateAttributeValue } from '@/shared/ui/TemplateAttributeRenderer';
import { SearchableSelect, type SearchableSelectOption } from '@/shared/ui/SearchableSelect';
import styles from './Warehouse.module.css';

interface Props {
  onClose: () => void;
}

const LEGACY_AXIS_KEYS = new Set(['color', 'gender', 'size', 'length']);

interface ItemFormState {
  productCatalogId: string;
  name: string;
  qty: number;
  qtyMin: number;
  costPrice: string;
  attributes: Record<string, TemplateAttributeValue>;
}

const INITIAL_FORM: ItemFormState = {
  productCatalogId: '',
  name: '',
  qty: 0,
  qtyMin: 0,
  costPrice: '',
  attributes: {},
};

function toStringValue(v: TemplateAttributeValue): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

export function AddItemDrawer({ onClose }: Props) {
  const createItem = useCreateItem();
  const { data: activeTemplate } = useActiveOrderTemplate();
  const { data: catalog, isLoading: catalogLoading } = useOrderFormCatalog({
    templateId: activeTemplate?.id ?? null,
  });
  const [form, setForm] = useState<ItemFormState>(INITIAL_FORM);

  const itemsSection = useMemo(() => getItemsSection(activeTemplate), [activeTemplate]);

  // Template-driven attribute fields: skip identity/qty/price fields (the form
  // owns Name/Qty/CostPrice explicitly). `product`/`name`/`qty`/`unitPrice`
  // are conventional keys that map onto top-level columns instead of attrs.
  const attributeFields: OrderTemplateField[] = useMemo(() => {
    const fields = itemsSection?.fields ?? [];
    const SKIP = new Set(['product', 'name', 'qty', 'quantity', 'unitPrice', 'unit_price', 'price']);
    return fields.filter((f) => !SKIP.has(f.key));
  }, [itemsSection]);

  const products: OrderFormProduct[] = useMemo(
    () => catalog?.products ?? [],
    [catalog],
  );

  const productOptions: SearchableSelectOption[] = useMemo(
    () => products.map((p) => p.name),
    [products],
  );

  const productByName = useMemo(() => {
    const m = new Map<string, OrderFormProduct>();
    for (const p of products) m.set(p.name, p);
    return m;
  }, [products]);

  const templateName = activeTemplate?.name ?? null;
  const hasAttributeFields = attributeFields.length > 0;
  const catalogEmpty = !catalogLoading && products.length === 0;

  // When the active template changes (or first load completes), reset the
  // form so we never carry over stale selections from another вид деятельности.
  useEffect(() => {
    setForm(INITIAL_FORM);
  }, [activeTemplate?.id]);

  const handleAttrChange = (key: string, next: TemplateAttributeValue) =>
    setForm((cur) => ({ ...cur, attributes: { ...cur.attributes, [key]: next } }));

  // Strict autocomplete commit: only accept names present in the catalog.
  // If the user types free text and the SearchableSelect commits it onBlur,
  // we ignore the value (leave the form name empty) and force a re-pick.
  const handleNameChange = (value: string) => {
    const trimmed = value.trim();
    const product = productByName.get(trimmed);
    if (!product) {
      setForm((cur) => ({
        ...cur,
        productCatalogId: '',
        name: '',
        // Wipe attributes on name-clear so old axes don't leak into a new pick.
        attributes: {},
      }));
      return;
    }
    const autoPrice =
      product.defaultRetailPrice ?? product.defaultWholesalePrice ?? null;
    setForm((cur) => ({
      ...cur,
      productCatalogId: product.id,
      name: product.name,
      // Only auto-fill the price if it's currently empty — never overwrite a
      // value the user has already typed manually.
      costPrice:
        cur.costPrice.trim() === '' && autoPrice != null
          ? String(autoPrice)
          : cur.costPrice,
      attributes: {},
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.productCatalogId || !form.name.trim()) return;

    // Build attributesJson from template fields (skip empty values).
    const attributesJson: Record<string, string> = {};
    for (const f of attributeFields) {
      const str = toStringValue(form.attributes[f.key]).trim();
      if (str) attributesJson[f.key] = str;
    }

    // Backward-compat: mirror canonical legacy keys (color/gender/size/length)
    // onto top-level CreateItemDto fields so the still-legacy server createItem
    // (full schema-driven write happens in P4) computes the variantKey correctly.
    const legacyMirror: Pick<CreateItemDto, 'color' | 'gender' | 'size' | 'length'> = {};
    for (const k of LEGACY_AXIS_KEYS) {
      const v = attributesJson[k];
      if (v) (legacyMirror as Record<string, string>)[k] = v;
    }

    const rawCostPrice = form.costPrice.trim();
    await createItem.mutateAsync({
      productCatalogId: form.productCatalogId,
      name: form.name.trim(),
      unit: 'шт',
      qty: Number(form.qty ?? 0),
      qtyMin: Number(form.qtyMin ?? 0),
      costPrice: rawCostPrice === '' ? undefined : Number(rawCostPrice),
      ...legacyMirror,
      attributesJson: Object.keys(attributesJson).length > 0 ? attributesJson : undefined,
    });
    onClose();
  };

  // ── Empty catalog state ────────────────────────────────────────────────
  // Hard block: if the org's catalog for the active template has zero
  // entries, we don't even show the form — there's nothing the user could
  // legally pick. Send them to /products to seed the catalog first.
  if (catalogEmpty) {
    const productsHref = activeTemplate?.id
      ? `/products?templateId=${encodeURIComponent(activeTemplate.id)}`
      : '/products';

    return (
      <div className={styles.drawerOverlay} onClick={onClose}>
        <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
          <div className={styles.drawerHeader}>
            <span className={styles.drawerTitle}>
              Добавить позицию
              {templateName && (
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                  · {templateName}
                </span>
              )}
            </span>
            <button type="button" className={styles.drawerClose} onClick={onClose} title="Закрыть" aria-label="Закрыть">
              <X size={14} />
            </button>
          </div>

          <div className={styles.drawerBody}>
            <div className={styles.empty}>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Каталог по виду деятельности «{templateName ?? '—'}» пуст.
                <br />
                Сначала добавьте позиции в раздел Каталог.
              </div>
              <Link
                to={productsHref}
                className={styles.emptyBtn}
                onClick={onClose}
              >
                Перейти в Каталог
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>
            Добавить позицию
            {templateName && (
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                · {templateName}
              </span>
            )}
          </span>
          <button type="button" className={styles.drawerClose} onClick={onClose} title="Закрыть" aria-label="Закрыть">
            <X size={14} />
          </button>
        </div>

        <form className={styles.drawerBody} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>
              Название <span className={styles.req}>*</span>
            </label>
            <SearchableSelect
              options={productOptions}
              value={form.name}
              onChange={handleNameChange}
              placeholder="— выбрать позицию из каталога —"
              className={styles.input}
              ariaLabel="Название"
            />
            {!hasAttributeFields && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                В шаблоне «{templateName ?? '—'}» нет дополнительных параметров позиции.
              </div>
            )}
          </div>

          {/* Schema-driven attribute fields from the active template. */}
          {hasAttributeFields && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {attributeFields.map((field) => (
                <TemplateAttributeRenderer
                  key={field.id}
                  field={field}
                  value={form.attributes[field.key] ?? null}
                  onChange={(next) => handleAttrChange(field.key, next)}
                />
              ))}
            </div>
          )}

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>Остаток</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                value={form.qty}
                onChange={(e) => setForm((cur) => ({ ...cur, qty: Number(e.target.value) }))}
                onFocus={(e) => e.target.select()}
                aria-label="Остаток"
                placeholder="0"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Минимум (алерт)</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                value={form.qtyMin}
                onChange={(e) => setForm((cur) => ({ ...cur, qtyMin: Number(e.target.value) }))}
                onFocus={(e) => e.target.select()}
                aria-label="Минимум"
                placeholder="0"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Цена (₸)</label>
            <input
              className={styles.input}
              type="number"
              min="0"
              value={form.costPrice}
              onChange={(e) => setForm((cur) => ({ ...cur, costPrice: e.target.value }))}
              placeholder="0"
              aria-label="Цена"
            />
          </div>

          <div className={styles.drawerActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Отмена
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={createItem.isPending || !form.productCatalogId}
              title={!form.productCatalogId ? 'Сначала выберите позицию из каталога' : undefined}
            >
              {createItem.isPending ? 'Создание...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
