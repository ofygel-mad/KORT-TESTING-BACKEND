// ЧАСТЬ X / P1 — pure resolver: turns the tenant config into the sidebar
// groups to render. The sidebar component stays hand-written; it just renders
// whatever this returns. Plan tier is the ceiling — applied on top of config.

import { COMPOSITION_MANIFEST } from './manifest.generated';
import type { TenantConfigData } from './config-types';
import {
  SHORTCUT_NAV_MAP,
  type ShortcutNavItem,
  type ShortcutNavItemId,
} from '@/shared/navigation/appNavigation';
import { planIncludes, type OrgMode } from '@/shared/hooks/usePlan';

export interface ResolvedSidebarGroup {
  label: string;
  items: ShortcutNavItem[];
}

const SIDEBAR_SURFACE = COMPOSITION_MANIFEST.surfaces.find(
  (surface) => surface.id === 'sidebar',
);

/**
 * Resolves the sidebar: merges config over the manifest defaults (visibility,
 * order, grouping), drops items whose section is disabled or whose plan tier
 * exceeds the current plan, then buckets the survivors into ordered groups.
 * A null config (or missing entries) yields exactly today's sidebar.
 */
export function applySidebarConfig(
  config: TenantConfigData | null,
  plan: OrgMode,
): ResolvedSidebarGroup[] {
  const blocks = (SIDEBAR_SURFACE?.blocks ?? []).map((block) => {
    const blockCfg = config?.surfaces?.sidebar?.blocks?.[block.id];
    const sectionCfg = config?.sections?.[block.id];
    return {
      navItem: SHORTCUT_NAV_MAP[block.id as ShortcutNavItemId] as
        | ShortcutNavItem
        | undefined,
      visible: blockCfg?.visible ?? true,
      order: blockCfg?.order ?? block.defaultOrder,
      group: blockCfg?.group ?? block.group ?? 'Прочее',
      sectionEnabled: sectionCfg?.enabled ?? true,
    };
  });

  const visible = blocks
    .filter(
      (block): block is typeof block & { navItem: ShortcutNavItem } =>
        block.navItem !== undefined &&
        block.visible &&
        block.sectionEnabled &&
        planIncludes(plan, block.navItem.planTier),
    )
    .sort((a, b) => a.order - b.order);

  const groups: ResolvedSidebarGroup[] = [];
  const byLabel = new Map<string, ResolvedSidebarGroup>();
  for (const block of visible) {
    let group = byLabel.get(block.group);
    if (!group) {
      group = { label: block.group, items: [] };
      byLabel.set(block.group, group);
      groups.push(group);
    }
    group.items.push(block.navItem);
  }
  return groups;
}
