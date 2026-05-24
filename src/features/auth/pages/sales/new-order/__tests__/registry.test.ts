// ЧАСТЬ X / P2b — registry parity: every manifest `new-order` block has a
// component, and no registry entry lacks a manifest block.

import { describe, it, expect } from 'vitest';
import { COMPOSITION_MANIFEST } from '@/shared/composition/manifest.generated';
import { NEW_ORDER_BLOCKS } from '../registry';

const surface = COMPOSITION_MANIFEST.surfaces.find((s) => s.id === 'new-order');

describe('new-order block registry', () => {
  it('has a component for every manifest new-order block', () => {
    expect(surface).toBeDefined();
    for (const block of surface!.blocks) {
      expect(NEW_ORDER_BLOCKS[block.id], `missing component for "${block.id}"`).toBeDefined();
    }
  });

  it('has no registry entry without a manifest block', () => {
    const ids = new Set(surface!.blocks.map((block) => block.id));
    for (const id of Object.keys(NEW_ORDER_BLOCKS)) {
      expect(ids.has(id), `registry id "${id}" not in manifest`).toBe(true);
    }
  });
});
