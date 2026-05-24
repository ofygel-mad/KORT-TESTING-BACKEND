// ЧАСТЬ X — backend parity test: the manifest is internally consistent and the
// default config it produces is valid. Drift between manifest.ts and the
// generated frontend mirror is caught by `npm run composition:manifest` in the
// build + the frontend parity test.

import { describe, it, expect } from 'vitest';
import { COMPOSITION_MANIFEST, MANIFEST_VERSION } from '../manifest.js';
import { buildDefaultConfig } from '../composition.defaults.js';
import { tenantConfigSchema } from '../composition.schema.js';

describe('composition manifest', () => {
  it('stamps its own content hash as the version', () => {
    expect(COMPOSITION_MANIFEST.version).toBe(MANIFEST_VERSION);
    expect(MANIFEST_VERSION).toMatch(/^[0-9a-f]{12}$/);
  });

  it('declares the three v1 surfaces', () => {
    const ids = COMPOSITION_MANIFEST.surfaces.map((surface) => surface.id).sort();
    expect(ids).toEqual(['new-order', 'sidebar', 'warehouse']);
  });

  it('has unique section ids', () => {
    const ids = COMPOSITION_MANIFEST.sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every block belongs to its surface, with unique ids and a contiguous order', () => {
    for (const surface of COMPOSITION_MANIFEST.surfaces) {
      const ids = surface.blocks.map((block) => block.id);
      expect(new Set(ids).size, `duplicate block id in ${surface.id}`).toBe(ids.length);
      for (const block of surface.blocks) {
        expect(block.surface, `block ${block.id} surface mismatch`).toBe(surface.id);
      }
      const orders = surface.blocks.map((block) => block.defaultOrder).sort((a, b) => a - b);
      expect(orders).toEqual(surface.blocks.map((_, index) => index));
    }
  });

  it('builds a default config that validates and reproduces every block', () => {
    const config = buildDefaultConfig();
    expect(() => tenantConfigSchema.parse(config)).not.toThrow();

    for (const section of COMPOSITION_MANIFEST.sections) {
      expect(config.sections[section.id]?.enabled).toBe(true);
    }
    for (const surface of COMPOSITION_MANIFEST.surfaces) {
      for (const block of surface.blocks) {
        const blockConfig = config.surfaces[surface.id]?.blocks[block.id];
        expect(blockConfig?.visible).toBe(true);
        expect(blockConfig?.order).toBe(block.defaultOrder);
      }
    }
  });
});
