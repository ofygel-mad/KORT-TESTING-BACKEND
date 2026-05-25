// P3 — Frontend mirror of OrderTemplate types.
//
// Stays in sync with server/src/modules/orders/templates.ts. Both files are
// authored against new orders/design_handoff_new_order/SCHEMA_SHAPE.md and
// FIELD_TYPES.md. If you change one, change the other.

export type FieldType =
  | 'text' | 'longtext' | 'number' | 'money'
  | 'select' | 'multiselect' | 'toggle'
  | 'date' | 'file'
  | 'customer'   // reserved for future autocomplete
  | 'computed';  // reserved for future formulas

export interface OrderTemplateField {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  grow?: 1 | 2 | 3 | 4;
  placeholder?: string;
  hint?: string;
  mono?: boolean;
  options?: string[];
  unit?: string;
  precision?: number;
  min?: number;
  max?: number;
  multiple?: boolean;
  /**
   * Stage 5: flags this field as a *variant axis* — distinct values create
   * distinct warehouse SKUs/balances. For clothing: color, gender, length,
   * size. For chemicals: concentration, packaging. For watches: nothing
   * (each model is its own SKU).
   */
  affectsAvailability?: boolean;
}

export type SectionKind = 'client' | 'items' | 'meta' | 'custom';

export interface OrderTemplateSection {
  id: string;
  kind: SectionKind;
  title: string;
  fields: OrderTemplateField[];
}

export interface OrderTemplate {
  id: string;
  orgId: string;
  name: string;
  itemNoun: string;
  primaryUnit: string;
  primaryPrecision: number;
  sections: OrderTemplateSection[];
  isSystem: boolean;
  /** P1: marks the org's default template (preselected when no override). */
  isDefault?: boolean;
  /** P1: monotonically increments on every sections edit (snapshot diffing). */
  version?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Looks up the items section of a template. Conventionally there is exactly
 * one — but the schema permits multiple custom sections so we just take the
 * first one whose kind matches.
 */
export function getItemsSection(
  template: OrderTemplate | null | undefined,
): OrderTemplateSection | null {
  if (!template) return null;
  return template.sections.find((s) => s.kind === 'items') ?? null;
}

/** Returns the client section (or null if a template skips it). */
export function getClientSection(
  template: OrderTemplate | null | undefined,
): OrderTemplateSection | null {
  if (!template) return null;
  return template.sections.find((s) => s.kind === 'client') ?? null;
}

/**
 * Reserved keys that custom fields cannot use — they collide with intrinsic
 * line-item properties or the JSON envelope itself.
 */
export const RESERVED_FIELD_KEYS: ReadonlySet<string> = new Set([
  'qty', 'quantity', 'unitPrice', 'unit_price', 'id', 'attributes', 'position',
]);
