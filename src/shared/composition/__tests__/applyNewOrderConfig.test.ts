// ЧАСТЬ X / P2b — the new-order surface resolver: visibility + order. A null
// config reproduces today's form (all five blocks, declaration order).

import { describe, it, expect } from 'vitest';
import { applyNewOrderConfig } from '../applyNewOrderConfig';
import type { TenantConfigData } from '../config-types';

function cfg(
  blocks: Record<string, { visible: boolean; order: number }>,
): TenantConfigData {
  return { schemaVersion: 1, sections: {}, surfaces: { 'new-order': { blocks } } };
}

describe('applyNewOrderConfig', () => {
  it('null config yields all five blocks in declaration order', () => {
    expect(applyNewOrderConfig(null)).toEqual([
      'client',
      'line-items',
      'dates',
      'payment',
      'notes',
    ]);
  });

  it('omits a hidden block', () => {
    const ids = applyNewOrderConfig(cfg({ notes: { visible: false, order: 4 } }));
    expect(ids).not.toContain('notes');
    expect(ids).toHaveLength(4);
  });

  it('respects per-block order', () => {
    const ids = applyNewOrderConfig(
      cfg({
        payment: { visible: true, order: 2 },
        dates: { visible: true, order: 3 },
      }),
    );
    expect(ids.indexOf('payment')).toBeLessThan(ids.indexOf('dates'));
  });
});
