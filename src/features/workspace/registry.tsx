import type { LucideIcon } from 'lucide-react';
import {
  SHORTCUT_NAV_ITEMS,
  SIDEBAR_NAV_SECTIONS,
  type ShortcutNavItem,
} from '../../shared/navigation/appNavigation';
import type { OrgMode } from '../../shared/hooks/usePlan';
import type { WorkspaceWidgetKind } from './model/types';

export interface WorkspaceWidgetDefinition {
  kind: WorkspaceWidgetKind;
  title: string;
  description: string;
  icon: LucideIcon;
  navTo: string;
  color: string;
  planTier: OrgMode;
  section: string;
}

const SECTION_BY_KIND: Partial<Record<WorkspaceWidgetKind, string>> = Object.fromEntries(
  SIDEBAR_NAV_SECTIONS.flatMap((s) => s.items.map((item) => [item.id, s.label])),
);
SECTION_BY_KIND.chapan = 'Кабинеты';

function toWidgetDefinition(item: ShortcutNavItem): WorkspaceWidgetDefinition {
  return {
    kind: item.id,
    title: item.label,
    description: item.description,
    icon: item.icon,
    navTo: item.to,
    color: item.color,
    planTier: item.planTier,
    section: SECTION_BY_KIND[item.id] ?? '',
  };
}

export const WORKSPACE_WIDGETS: WorkspaceWidgetDefinition[] = SHORTCUT_NAV_ITEMS.map(toWidgetDefinition);

export const WORKSPACE_WIDGET_MAP = Object.fromEntries(
  WORKSPACE_WIDGETS.map((widget) => [widget.kind, widget]),
) as Record<WorkspaceWidgetKind, WorkspaceWidgetDefinition>;
