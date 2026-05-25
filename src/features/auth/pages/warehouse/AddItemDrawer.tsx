// P1 multi-business — schema-driven warehouse "add item" form.
//
// Replaces the previous clothing-hardcoded form (color/gender/length/size) with
// a generic renderer that walks `template.sections.items.fields` and produces
// inputs via `TemplateAttributeRenderer`. The 4 legacy axis keys, when present
// in the active template, are mirrored into the create-item payload so the
// server's still-legacy `createItem` (P4 target) keeps working in P1.

import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useCreateItem, useOrderFormCatalog } from '@/entities/warehouse/queries';
import type { CreateItemDto } from '@/entities/warehouse/types';
import { useActiveOrderTemplate } from '@/entities/order/templatesApi';
import { getItemsSection, type OrderTemplateField } from '@/entities/order/templates';
import { TemplateAttributeRenderer, type TemplateAttributeValue } from '@/shared/ui/TemplateAttributeRenderer';
import styles from './Warehouse.module.css';

interface Props {
  onClose: () => void;
}

const LEGACY_AXIS_KEYS = new Set(['color', 'gender', 'size', 'length']);

interface ItemFormState {
  name: string;
  qty: number;
  qtyMin: number;
  costPrice: string;
  attributes: Record<string, TemplateAttributeValue>;
}

const INITIAL_FORM: ItemFormState = {
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
  const { data: catalog } = useOrderFormCatalog({ templateId: activeTemplate?.id ?? null });
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

  const productNames = useMemo(
    () => catalog?.products.map((p) => p.name) ?? [],
    [catalog],
  );

  const handleAttrChange = (key: string, next: TemplateAttributeValue) =>
    setForm((cur) => ({ ...cur, attributes: { ...cur.attributes, [key]: next } }));

  const handleNameChange = (value: string) =>
    setForm((cur) => ({ ...cur, name: value, attributes: {} }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim()) return;

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

  const templateName = activeTemplate?.name ?? null;
  const hasAttributeFields = attributeFields.length > 0;

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
            {productNames.length > 0 ? (
              <select
                className={styles.input}
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                autoFocus
                aria-label="Название"
              >
                <option value="">— выбрать позицию из каталога —</option>
                {productNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            ) : (
              <input
                className={styles.input}
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Название позиции"
                required
                autoFocus
              />
            )}
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
            <button type="submit" className={styles.submitBtn} disabled={createItem.isPending}>
              {createItem.isPending ? 'Создание...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
