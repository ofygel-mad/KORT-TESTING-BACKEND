import type { OrderFormField } from '../../entities/warehouse/types';

export interface VariantAvailabilityInput {
  name: string;
  color?: string;
  gender?: string;
  size?: string;
  length?: string;
}

export interface VariantAvailabilityAttributesInput {
  color?: string | null;
  gender?: string | null;
  size?: string | null;
  length?: string | null;
}

function normalizeVariantValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildVariantLookupKey(
  name: string,
  attributes: VariantAvailabilityAttributesInput & { name?: string | null } = {},
): string {
  const base = normalizeVariantValue(name);
  const { name: _ignored, ...variantAttributes } = attributes;
  const parts = Object.entries(variantAttributes)
    .filter(([, value]) => value?.trim())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${normalizeVariantValue(value as string)}`);

  return [base, ...parts].join('|');
}

export function pickVariantAvailabilityAttributes(
  productName: string,
  item: VariantAvailabilityAttributesInput,
  fields?: OrderFormField[],
): Omit<VariantAvailabilityInput, 'name'> | null {
  const name = productName.trim();
  if (!name) return null;

  const allowedCodes = fields
    ? new Set(fields.filter((field) => field.affectsAvailability).map((field) => field.code))
    : null;

  const selected: Omit<VariantAvailabilityInput, 'name'> = {};
  const entries: Array<[keyof Omit<VariantAvailabilityInput, 'name'>, string | null | undefined]> = [
    ['color', item.color],
    ['gender', item.gender],
    ['length', item.length],
    ['size', item.size],
  ];

  for (const [code, rawValue] of entries) {
    const value = rawValue?.trim();
    if (!value) continue;
    if (allowedCodes && !allowedCodes.has(code)) continue;
    selected[code] = value;
  }

  return Object.keys(selected).length > 0 ? selected : null;
}

export function buildVariantAvailabilityInput(
  productName: string,
  item: VariantAvailabilityAttributesInput,
  fields?: OrderFormField[],
): VariantAvailabilityInput | null {
  const attributes = pickVariantAvailabilityAttributes(productName, item, fields);
  if (!attributes) return null;

  return {
    name: productName.trim(),
    ...attributes,
  };
}
