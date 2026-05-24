// P5 — Renderer for OrderTemplateField in two modes:
//   - mode="edit" → returns an interactive input (form field)
//   - mode="view" → returns a read-only label/value pair (order card)
//
// Covers the 9 base FieldTypes from design_handoff_new_order/FIELD_TYPES.md.
// `customer` and `computed` are reserved for future work and currently render
// as plain text.
//
// **Calculations are not the renderer's concern.** Price/qty/discount fields
// are intrinsic to OrderItem and live outside the template. The renderer
// only writes to a flat key→value record that callers persist into
// `OrderItem.attributes` or `Order.extraAttributes`.

import type { CSSProperties } from 'react';
import type { OrderTemplateField } from '@/entities/order/templates';

export type TemplateAttributeValue = string | number | boolean | string[] | null | undefined;

export interface TemplateAttributeRendererProps {
  field: OrderTemplateField;
  value: TemplateAttributeValue;
  onChange?: (next: TemplateAttributeValue) => void;
  mode?: 'edit' | 'view';
  disabled?: boolean;
  style?: CSSProperties;
}

const labelStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-secondary, #6b7280)',
  marginBottom: 4,
  letterSpacing: 0.2,
  textTransform: 'uppercase',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid var(--border-default, #d1d5db)',
  borderRadius: 6,
  fontSize: 13,
  background: 'var(--bg-surface, #fff)',
  color: 'var(--text-primary, #111827)',
  fontFamily: 'inherit',
};

const monoStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

export function TemplateAttributeRenderer({
  field,
  value,
  onChange,
  mode = 'edit',
  disabled = false,
  style,
}: TemplateAttributeRendererProps) {
  if (mode === 'view') {
    return (
      <div style={style}>
        <div style={labelStyle}>{field.label}</div>
        <div style={{
          fontSize: 13,
          color: 'var(--text-primary, #111827)',
          ...(field.mono ? monoStyle : {}),
        }}>
          {renderViewValue(field, value)}
        </div>
      </div>
    );
  }

  const handleString = (v: string) => onChange?.(v);
  const handleNumber = (v: string) => onChange?.(v === '' ? null : Number(v));
  const handleToggle = (v: boolean) => onChange?.(v);
  const handleMulti = (option: string, checked: boolean) => {
    const current = Array.isArray(value) ? value : [];
    onChange?.(checked ? [...current, option] : current.filter((x) => x !== option));
  };

  const finalInputStyle: CSSProperties = {
    ...inputStyle,
    ...(field.mono ? monoStyle : {}),
    ...(disabled ? { opacity: 0.5, pointerEvents: 'none' } : {}),
  };

  return (
    <div style={style}>
      <div style={labelStyle}>
        {field.label}
        {field.required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}
      </div>
      {(field.type === 'text' || field.type === 'customer' || field.type === 'computed') && (
        <input
          type="text"
          value={(value as string) ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => handleString(e.target.value)}
          disabled={disabled || field.type === 'computed'}
          style={finalInputStyle}
        />
      )}
      {field.type === 'longtext' && (
        <textarea
          value={(value as string) ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => handleString(e.target.value)}
          disabled={disabled}
          rows={3}
          style={{ ...finalInputStyle, resize: 'vertical' }}
        />
      )}
      {(field.type === 'number' || field.type === 'money') && (
        <input
          type="number"
          value={(value as number | null | undefined) ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => handleNumber(e.target.value)}
          min={field.min}
          max={field.max}
          step={field.precision ? Math.pow(10, -field.precision) : undefined}
          disabled={disabled}
          style={finalInputStyle}
        />
      )}
      {field.type === 'select' && (
        <select
          value={(value as string) ?? ''}
          onChange={(e) => handleString(e.target.value)}
          disabled={disabled}
          style={finalInputStyle}
        >
          <option value="">—</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}
      {field.type === 'multiselect' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(field.options ?? []).map((opt) => {
            const checked = Array.isArray(value) && value.includes(opt);
            return (
              <label key={opt} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                border: '1px solid var(--border-default, #d1d5db)',
                borderRadius: 6,
                fontSize: 12,
                cursor: disabled ? 'default' : 'pointer',
                background: checked ? 'var(--bg-tint, #eef2ff)' : 'transparent',
              }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => handleMulti(opt, e.target.checked)}
                  disabled={disabled}
                />
                {opt}
              </label>
            );
          })}
        </div>
      )}
      {field.type === 'toggle' && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => handleToggle(e.target.checked)}
            disabled={disabled}
          />
          <span style={{ fontSize: 13 }}>{field.hint ?? 'Включено'}</span>
        </label>
      )}
      {field.type === 'date' && (
        <input
          type="date"
          value={(value as string) ?? ''}
          onChange={(e) => handleString(e.target.value)}
          disabled={disabled}
          style={finalInputStyle}
        />
      )}
      {field.type === 'file' && (
        <input
          type="file"
          multiple={field.multiple}
          disabled={disabled}
          style={{ fontSize: 12 }}
        />
      )}
      {field.hint && field.type !== 'toggle' && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary, #9ca3af)', marginTop: 2 }}>
          {field.hint}
        </div>
      )}
    </div>
  );
}

function renderViewValue(field: OrderTemplateField, value: TemplateAttributeValue): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—';
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (field.type === 'money' && typeof value === 'number') {
    return new Intl.NumberFormat('ru-KZ', { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(value);
  }
  if (field.type === 'date' && typeof value === 'string') {
    try {
      return new Date(value).toLocaleDateString('ru-RU');
    } catch {
      return value;
    }
  }
  return String(value);
}
