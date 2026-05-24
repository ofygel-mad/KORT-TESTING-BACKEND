// ЧАСТЬ X / P2a — new-order form helpers + small shared inputs.
// Extracted verbatim from NewOrderPage.tsx — no behaviour change.

import type { InputHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';
import type { FormData } from './formModel';

// ─── Constants ────────────────────────────────────────────────────────────────
export const CITIES = ['Алматы', 'Астана', 'Шымкент', 'Атырау', 'Актобе', 'Тараз', 'Павлодар', 'Другой город'];
export const SOURCES = ['Instagram', 'WhatsApp', 'Telegram', 'Звонок', 'Рекомендация', 'Сайт', 'Другое'];

// ─── Parsing helpers ──────────────────────────────────────────────────────────
export function parseOptionalAmount(value: string) {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return undefined;
  const n = Number(digits);
  return Number.isFinite(n) ? n : undefined;
}

export function parseOptionalInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

export function buildPayloadItems(items: FormData['items']) {
  return items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const lineTotal = quantity * unitPrice;
    // Keep order-level discount separate; only per-item discount is baked into item price.
    const itemDiscount = Math.min(Number(item.itemDiscount) || 0, lineTotal);
    const finalLineTotal = Math.max(0, lineTotal - itemDiscount);
    const effectiveUnitPrice = quantity > 0
      ? Number((finalLineTotal / quantity).toFixed(4))
      : 0;

    // P5: build the schema-driven `attributes` bag. Dual-write strategy —
    // legacy fields (color/gender/length/size) ALSO flow into the bag so
    // OrderDetailPage and analytics can read them through one consistent
    // shape. Custom template fields are merged on top.
    const customFields = (item as { customFields?: Record<string, unknown> }).customFields ?? {};
    const attributes: Record<string, unknown> = {};
    if (item.color?.trim()) attributes.color = item.color.trim();
    if (item.gender?.trim()) attributes.gender = item.gender.trim();
    if (item.length?.trim()) attributes.length = item.length.trim();
    if (item.size?.trim()) attributes.size = item.size.trim();
    for (const [key, value] of Object.entries(customFields)) {
      if (value === undefined || value === null || value === '') continue;
      attributes[key] = value;
    }

    return {
      productName: item.productName,
      color: item.color?.trim() || undefined,
      gender: item.gender?.trim() || undefined,
      length: item.length?.trim() || undefined,
      size: item.size,
      quantity,
      unitPrice: effectiveUnitPrice,
      workshopNotes: item.workshopNotes || undefined,
      attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    };
  });
}

// ─── SelectOrText ─────────────────────────────────────────────────────────────
export const SelectOrText = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { options: string[] }
>(function SelectOrText({ options, placeholder, className, ...props }, ref) {
  const id = useId();
  return (
    <>
      <datalist id={id}>{options.map((o) => <option key={o} value={o} />)}</datalist>
      <input {...props} ref={ref} list={id} placeholder={placeholder} className={className} autoComplete="off" />
    </>
  );
});
