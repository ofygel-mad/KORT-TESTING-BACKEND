// Canonical name-normalizer for warehouse / catalog lookups.
//
// Both write-paths (createItem, upsertProduct, etc.) and read-paths
// (findFirst({ normalizedName }), variant lookup) must call this function so
// the comparison is byte-identical. Drift here means catalog rows silently
// fail to match identical-looking user input differing only by case / spacing.
//
// Matches the algorithm originally inlined in warehouse.service.ts
// (`normalizeWarehouseName`) and warehouse-catalog.service.ts (`normalizeName`).
// P0.5: consolidated to a single source of truth.

export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
