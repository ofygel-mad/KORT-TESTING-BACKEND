import type { OrderFormField } from '@/entities/warehouse/types';
import { buildCanonicalVariantKey } from './variantKey';

/**
 * Legacy 4-axis request payload for the warehouse variant-availability endpoint.
 * Kept for backward-compat with the existing batch endpoint signature.
 *
 * P4: callers should prefer the generic `attributes` shape via
 * `buildVariantAvailabilityInputGeneric`, which preserves the full
 * template-driven set of axes (e.g. concentration, material).
 */
export interface VariantAvailabilityInput {
  name: string;
  /**
   * Full template-driven attribute map. Replaces the legacy 4 named fields.
   * Always populated by `buildVariantAvailabilityInput` going forward.
   */
  attributes: Record<string, string>;
}

/**
 * Generic attributes input — caller passes a flat key→value map. Previous
 * versions restricted this to {color,gender,length,size}; P4 widened the shape
 * so any template-defined axis (concentration, material, …) survives.
 *
 * The value type is intentionally `unknown` so callers can pass through whole
 * form/OrderItem objects whose unrelated fields (quantity:number, …) coexist
 * with the axis strings. Non-string values are dropped during normalization.
 */
export type VariantAvailabilityAttributesInput = Record<string, unknown>;

/**
 * Legacy 4-axis fallback used ONLY when no template fields are supplied. This
 * preserves behaviour for free-text product names that have no warehouse entry.
 * Sacred Invariant #3: legacy clothing data keeps rendering correctly.
 */
const KNOWN_AXIS_CODES = ['color', 'gender', 'length', 'size'] as const;

function fieldsForKey(fields?: OrderFormField[]) {
  if (fields && fields.length > 0) {
    return fields.map((f) => ({ code: f.code, affectsAvailability: f.affectsAvailability }));
  }
  return KNOWN_AXIS_CODES.map((code) => ({ code, affectsAvailability: true }));
}

export function buildVariantLookupKey(
  name: string,
  attributes: VariantAvailabilityAttributesInput | undefined = {},
  fields?: OrderFormField[],
): string {
  // Drop `name`, empty/null values, non-string values. Canonical builder is
  // strict about empties; here we collapse the heterogeneous input to a clean
  // `Record<string,string>` first.
  const cleaned: Record<string, string> = {};
  for (const [key, raw] of Object.entries(attributes ?? {})) {
    if (key === 'name') continue;
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (value) cleaned[key] = value;
  }
  return buildCanonicalVariantKey(name, cleaned, fieldsForKey(fields));
}

/**
 * Filter `item` down to the attribute keys that the active template marks as
 * availability axes. If `fields` is omitted, falls back to the legacy 4 axis
 * codes (Sacred Invariant #3) so old clothing flows keep working.
 *
 * P4: hardcoded `[color, gender, length, size]` iteration removed; any axis
 * declared by the template (e.g. `concentration`, `material`) is preserved.
 */
export function pickVariantAvailabilityAttributes(
  productName: string,
  item: VariantAvailabilityAttributesInput | null | undefined,
  fields?: OrderFormField[],
): Record<string, string> | null {
  const name = productName.trim();
  if (!name) return null;

  // Determine which keys are eligible:
  //  - if fields supplied: iterate fields.filter(affectsAvailability)
  //  - else: legacy 4 axes (KNOWN_AXIS_CODES)
  const axisCodes: string[] = fields
    ? fields.filter((field) => field.affectsAvailability).map((field) => field.code)
    : [...KNOWN_AXIS_CODES];

  const selected: Record<string, string> = {};
  for (const code of axisCodes) {
    const raw = (item as Record<string, unknown> | null | undefined)?.[code];
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) continue;
    selected[code] = value;
  }

  return Object.keys(selected).length > 0 ? selected : null;
}

export function buildVariantAvailabilityInput(
  productName: string,
  item: VariantAvailabilityAttributesInput | null | undefined,
  fields?: OrderFormField[],
): VariantAvailabilityInput | null {
  const attributes = pickVariantAvailabilityAttributes(productName, item, fields);
  if (!attributes) return null;

  return {
    name: productName.trim(),
    attributes,
  };
}
