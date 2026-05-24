// ЧАСТЬ X / P2b — pure resolver for the new-order form surface. Returns the
// ordered list of visible block ids; a null config yields exactly today's
// form (all blocks, declaration order).

import { COMPOSITION_MANIFEST } from './manifest.generated';
import type { TenantConfigData } from './config-types';

const NEW_ORDER_SURFACE = COMPOSITION_MANIFEST.surfaces.find(
  (surface) => surface.id === 'new-order',
);

export function applyNewOrderConfig(config: TenantConfigData | null): string[] {
  return (NEW_ORDER_SURFACE?.blocks ?? [])
    .map((block) => {
      const blockCfg = config?.surfaces?.['new-order']?.blocks?.[block.id];
      return {
        id: block.id,
        visible: blockCfg?.visible ?? true,
        order: blockCfg?.order ?? block.defaultOrder,
      };
    })
    .filter((block) => block.visible)
    .sort((a, b) => a.order - b.order)
    .map((block) => block.id);
}
