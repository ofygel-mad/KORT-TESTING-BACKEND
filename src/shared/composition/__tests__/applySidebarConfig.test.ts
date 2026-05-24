// ЧАСТЬ X / P1 — the sidebar resolver: visibility, order, grouping, section
// gating, and the plan ceiling. The null-config case must reproduce today's
// sidebar exactly (zero regression).

import { describe, it, expect } from 'vitest';
import { applySidebarConfig } from '../applySidebarConfig';
import type { BlockConfig, TenantConfigData } from '../config-types';

function cfg(
  blocks: Record<string, BlockConfig>,
  sections: Record<string, { enabled: boolean }> = {},
): TenantConfigData {
  return { schemaVersion: 1, sections, surfaces: { sidebar: { blocks } } };
}

const ids = (groups: ReturnType<typeof applySidebarConfig>, label: string) =>
  groups.find((group) => group.label === label)?.items.map((item) => item.id);

describe('applySidebarConfig', () => {
  it('null config on industrial reproduces today’s sidebar', () => {
    const groups = applySidebarConfig(null, 'industrial');
    expect(groups.map((group) => group.label)).toEqual([
      'CRM',
      'Операции',
      'Аналитика',
    ]);
    expect(ids(groups, 'CRM')).toEqual(['leads', 'sales', 'customers', 'tasks']);
    expect(ids(groups, 'Операции')).toEqual([
      'warehouse',
      'production',
      'logistics',
      'products',
      'finance',
    ]);
    expect(ids(groups, 'Аналитика')).toEqual(['reports', 'documents']);
  });

  it('plan tier is the ceiling — basic plan shows only basic-tier items', () => {
    const groups = applySidebarConfig(null, 'basic');
    const visible = groups.flatMap((group) => group.items.map((item) => item.id));
    expect(visible.sort()).toEqual(
      ['customers', 'leads', 'products', 'sales', 'warehouse'].sort(),
    );
  });

  it('a config cannot surface an item above the plan tier', () => {
    // documents is advanced-tier; explicitly visible config must not show it on basic.
    const groups = applySidebarConfig(
      cfg({ documents: { visible: true, order: 0, group: 'CRM' } }),
      'basic',
    );
    const visible = groups.flatMap((group) => group.items.map((item) => item.id));
    expect(visible).not.toContain('documents');
  });

  it('hides a block when config sets visible:false', () => {
    const groups = applySidebarConfig(
      cfg({ documents: { visible: false, order: 12 } }),
      'industrial',
    );
    expect(ids(groups, 'Аналитика')).toEqual(['reports']);
  });

  it('drops every item of a disabled section', () => {
    const groups = applySidebarConfig(
      cfg({}, { warehouse: { enabled: false } }),
      'industrial',
    );
    const visible = groups.flatMap((group) => group.items.map((item) => item.id));
    expect(visible).not.toContain('warehouse');
  });

  it('regroups a block into another group', () => {
    const groups = applySidebarConfig(
      cfg({ customers: { visible: true, order: 2, group: 'Операции' } }),
      'industrial',
    );
    expect(ids(groups, 'CRM')).toEqual(['leads', 'sales', 'tasks']);
    expect(ids(groups, 'Операции')).toContain('customers');
  });

  it('respects per-block order within a group', () => {
    const groups = applySidebarConfig(
      cfg({
        sales: { visible: true, order: 2, group: 'CRM' },
        customers: { visible: true, order: 1, group: 'CRM' },
      }),
      'industrial',
    );
    expect(ids(groups, 'CRM')).toEqual(['leads', 'customers', 'sales', 'tasks']);
  });
});
