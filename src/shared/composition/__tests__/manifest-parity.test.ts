// ЧАСТЬ X — frontend parity test: the generated manifest mirror is internally
// consistent AND reproduces today's navigation exactly, so the P0 default
// config is provably a zero-regression baseline.

import { describe, it, expect } from 'vitest';
import { COMPOSITION_MANIFEST, MANIFEST_VERSION } from '../manifest.generated';
import { SHORTCUT_NAV_ITEMS, SIDEBAR_NAV_SECTIONS } from '@/shared/navigation/appNavigation';

describe('composition manifest (generated mirror)', () => {
  it('carries a 12-hex content-hash version', () => {
    expect(COMPOSITION_MANIFEST.version).toBe(MANIFEST_VERSION);
    expect(MANIFEST_VERSION).toMatch(/^[0-9a-f]{12}$/);
  });

  it('declares the three v1 surfaces', () => {
    const ids = COMPOSITION_MANIFEST.surfaces.map((surface) => surface.id).sort();
    expect(ids).toEqual(['new-order', 'sidebar', 'warehouse']);
  });

  it('sidebar surface mirrors today’s navigation order (zero-regression default)', () => {
    const sidebar = COMPOSITION_MANIFEST.surfaces.find((surface) => surface.id === 'sidebar');
    expect(sidebar).toBeDefined();
    const orderedIds = sidebar!.blocks
      .slice()
      .sort((a, b) => a.defaultOrder - b.defaultOrder)
      .map((block) => block.id);
    expect(orderedIds).toEqual(SHORTCUT_NAV_ITEMS.map((item) => item.id));
  });

  it('groups every nav item under its current sidebar section', () => {
    const sidebar = COMPOSITION_MANIFEST.surfaces.find((surface) => surface.id === 'sidebar')!;
    const groupById = new Map(sidebar.blocks.map((block) => [block.id, block.group]));
    for (const section of SIDEBAR_NAV_SECTIONS) {
      for (const item of section.items) {
        expect(groupById.get(item.id)).toBe(section.label);
      }
    }
  });

  it('section catalog matches the nav families', () => {
    const sectionIds = COMPOSITION_MANIFEST.sections.map((section) => section.id).sort();
    const navIds = SHORTCUT_NAV_ITEMS.map((item) => item.id).sort();
    expect(sectionIds).toEqual(navIds);
  });
});
