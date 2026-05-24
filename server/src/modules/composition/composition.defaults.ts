// ЧАСТЬ X — the default tenant config = today's UI, exactly.
//
// COMPUTED from the manifest, never hand-authored, so it cannot drift: every
// section enabled, every block visible, order = manifest declaration order,
// group = manifest group. Seeded lazily on bootstrap and at provisioning.

import { COMPOSITION_MANIFEST } from './manifest.js';
import { SCHEMA_VERSION, tenantConfigSchema, type TenantConfigData } from './composition.schema.js';

/**
 * Builds the zero-regression default config. The result is run through the
 * schema, so the default is provably valid against its own manifest.
 */
export function buildDefaultConfig(): TenantConfigData {
  const sections: Record<string, { enabled: boolean }> = {};
  for (const section of COMPOSITION_MANIFEST.sections) {
    sections[section.id] = { enabled: true };
  }

  const surfaces: Record<
    string,
    { blocks: Record<string, { visible: boolean; order: number; group?: string }> }
  > = {};
  for (const surface of COMPOSITION_MANIFEST.surfaces) {
    const blocks: Record<string, { visible: boolean; order: number; group?: string }> = {};
    for (const block of surface.blocks) {
      blocks[block.id] = {
        visible: true,
        order: block.defaultOrder,
        ...(block.group ? { group: block.group } : {}),
      };
    }
    surfaces[surface.id] = { blocks };
  }

  return tenantConfigSchema.parse({ schemaVersion: SCHEMA_VERSION, sections, surfaces });
}
