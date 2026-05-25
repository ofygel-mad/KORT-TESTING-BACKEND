/**
 * P4: helpers for resolving variant axes from an Order's frozen template
 * snapshot (`order.templateSnapshot`). When a snapshot is present we honour
 * its `sections[].items.fields[].affectsAvailability` declarations; when it
 * isn't (orders created before P0/P4, or transient call-paths without an
 * order context) callers fall back to "every passed attribute is an axis"
 * which matches the legacy behaviour P0 wired up by removing the
 * `WarehouseFieldLink` table.
 *
 * Returning `null` (not `[]`) is meaningful: it signals "no snapshot
 * available, please use your own fallback" — callers should NOT treat null
 * as "no axes declared".
 */

export type AxisField = { code: string; affectsAvailability: boolean };

interface TemplateField {
  key?: string;
  affectsAvailability?: boolean;
  [other: string]: unknown;
}

interface TemplateSection {
  type?: string;
  key?: string;
  items?: { fields?: TemplateField[] } | null;
  fields?: TemplateField[];
  [other: string]: unknown;
}

interface TemplateSnapshot {
  sections?: TemplateSection[];
  [other: string]: unknown;
}

/**
 * Extract the list of field keys flagged as availability axes (i.e. they
 * define what makes two warehouse positions "different stock") from an
 * order's frozen template snapshot.
 *
 * @returns array of axis keys, or `null` when the snapshot is missing /
 *   malformed (caller should fall back to all-attrs-are-axes).
 */
export function getAxisKeysFromTemplateSnapshot(
  snapshot: unknown,
): string[] | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return null;
  }

  const typed = snapshot as TemplateSnapshot;
  const sections = Array.isArray(typed.sections) ? typed.sections : null;
  if (!sections) return null;

  // Find the items section; templates use `type === 'items'` per the P5/P6
  // shape, but tolerate older snapshots that nest fields directly.
  const itemsSection =
    sections.find((s) => s?.type === 'items' || s?.key === 'items') ?? null;

  const fields: TemplateField[] | null = itemsSection
    ? Array.isArray(itemsSection.items?.fields)
      ? (itemsSection.items?.fields as TemplateField[])
      : Array.isArray(itemsSection.fields)
        ? itemsSection.fields
        : null
    : null;

  if (!fields) return null;

  const axes = fields
    .filter((f) => f?.affectsAvailability === true && typeof f.key === 'string' && f.key.trim())
    .map((f) => (f.key as string).trim());

  return axes;
}

/**
 * Build the field-def array consumed by `buildCanonicalVariantKey` from
 * either a template snapshot (preferred) or — when none is available — the
 * literal attribute keys (all-attrs-are-axes fallback).
 */
export function buildAxisFieldsForVariantKey(
  snapshot: unknown,
  attributes: Record<string, string>,
): AxisField[] {
  const axisKeysFromSnapshot = getAxisKeysFromTemplateSnapshot(snapshot);
  if (axisKeysFromSnapshot) {
    return axisKeysFromSnapshot.map((code) => ({ code, affectsAvailability: true }));
  }
  return Object.keys(attributes).map((code) => ({ code, affectsAvailability: true }));
}

/**
 * Filter an attribute map down to only those keys that the template snapshot
 * marks as variant axes. When no snapshot is supplied, all attributes are
 * passed through (legacy / fallback behaviour).
 */
export function filterAttributesToAxes(
  snapshot: unknown,
  attributes: Record<string, string>,
): Record<string, string> {
  const axisKeys = getAxisKeysFromTemplateSnapshot(snapshot);
  if (!axisKeys) return attributes;

  const allowed = new Set(axisKeys);
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (allowed.has(key)) filtered[key] = value;
  }
  return filtered;
}
