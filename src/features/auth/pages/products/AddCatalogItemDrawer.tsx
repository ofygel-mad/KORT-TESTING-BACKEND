// P1 multi-business — modal for adding a single catalog entry (Каталог).
//
// Different from the warehouse-side AddItemDrawer: this one creates a row in
// `WarehouseProductCatalog` (i.e. a *catalog product*, not a stock balance).
// It captures the active template id and lets the manager set default
// retail/wholesale prices used as fallbacks in new orders.

import { useMemo, useState } from 'react';
import { Drawer } from '@/shared/ui/Drawer';
import { Button } from '@/shared/ui/Button';
import { TemplateAttributeRenderer, type TemplateAttributeValue } from '@/shared/ui/TemplateAttributeRenderer';
import { useCreateProduct } from '@/entities/warehouse/queries';
import { getItemsSection, type OrderTemplate, type OrderTemplateField } from '@/entities/order/templates';

const SKIP_KEYS = new Set(['product', 'name', 'qty', 'quantity', 'unitPrice', 'unit_price', 'price']);

export interface AddCatalogItemDrawerProps {
  template: OrderTemplate;
  onClose: () => void;
}

export function AddCatalogItemDrawer({ template, onClose }: AddCatalogItemDrawerProps) {
  const createProduct = useCreateProduct();
  const [name, setName] = useState('');
  const [retail, setRetail] = useState('');
  const [wholesale, setWholesale] = useState('');
  const [attrs, setAttrs] = useState<Record<string, TemplateAttributeValue>>({});

  // For the catalog form we only render *axis-like* fields (select, multiselect,
  // toggle, number, text). Long text and free-form values stay on the order
  // line itself — the catalog defines positions, not concrete orders.
  const attributeFields: OrderTemplateField[] = useMemo(() => {
    const items = getItemsSection(template);
    return (items?.fields ?? []).filter((f) => !SKIP_KEYS.has(f.key));
  }, [template]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const parsedRetail = retail.trim() === '' ? null : Number(retail);
    const parsedWholesale = wholesale.trim() === '' ? null : Number(wholesale);
    await createProduct.mutateAsync({
      name: trimmed,
      templateId: template.id,
      defaultRetailPrice: parsedRetail,
      defaultWholesalePrice: parsedWholesale,
      source: 'manual',
    });
    // NOTE: per-attribute values are accepted here for future-proofing but the
    // server doesn't persist them yet — P4 will introduce a per-product attrs
    // store, and that's where this state moves. For P1 we discard them.
    onClose();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="Добавить позицию каталога"
      subtitle={`Вид деятельности: ${template.name}`}
      size="md"
      variant="panel"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!name.trim() || createProduct.isPending}
          >
            {createProduct.isPending ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.2 }}>
            Название <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder=""
            aria-label="Название позиции"
            style={{
              width: '100%',
              marginTop: 4,
              padding: '6px 8px',
              border: '1px solid var(--border-default, #d1d5db)',
              borderRadius: 6,
              fontSize: 13,
              fontFamily: 'inherit',
            }}
            autoFocus
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.2 }}>
              Розница (₸)
            </label>
            <input
              type="number"
              min="0"
              value={retail}
              onChange={(e) => setRetail(e.target.value)}
              placeholder="0"
              aria-label="Розничная цена"
              style={{
                width: '100%',
                marginTop: 4,
                padding: '6px 8px',
                border: '1px solid var(--border-default, #d1d5db)',
                borderRadius: 6,
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.2 }}>
              Опт (₸)
            </label>
            <input
              type="number"
              min="0"
              value={wholesale}
              onChange={(e) => setWholesale(e.target.value)}
              placeholder="0"
              aria-label="Оптовая цена"
              style={{
                width: '100%',
                marginTop: 4,
                padding: '6px 8px',
                border: '1px solid var(--border-default, #d1d5db)',
                borderRadius: 6,
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {attributeFields.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
              Параметры шаблона (справочно)
            </div>
            {attributeFields.map((field) => (
              <TemplateAttributeRenderer
                key={field.id}
                field={field}
                value={attrs[field.key] ?? null}
                onChange={(next) => setAttrs((cur) => ({ ...cur, [field.key]: next }))}
              />
            ))}
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Значения этих полей пока сохраняются на уровне отдельных позиций склада. В P4 они переедут на саму позицию каталога.
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
