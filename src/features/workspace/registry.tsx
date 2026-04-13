import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  SHORTCUT_NAV_ITEMS,
  SIDEBAR_NAV_SECTIONS,
  type ShortcutNavItem,
} from '../../shared/navigation/appNavigation';
import type { OrgMode } from '../../shared/hooks/usePlan';
import type { WorkspaceWidgetKind } from './model/types';
import {
  LeadsTilePreview,
  DealsTilePreview,
  CustomersTilePreview,
  TasksTilePreview,
  WarehouseTilePreview,
  FinanceTilePreview,
  EmployeesTilePreview,
  ChapanTilePreview,
  ReportsTilePreview,
  DocumentsTilePreview,
  ProductionTilePreview,
} from './widgets/TileLivePreviews';

export interface WorkspaceWidgetDefinition {
  kind: WorkspaceWidgetKind;
  title: string;
  description: string;
  icon: LucideIcon;
  navTo: string;
  color: string;
  planTier: OrgMode;
  section: string;
  Preview?: ComponentType<{ tileId: string }>;
}

// Derive section label for each widget kind from the sidebar nav config
const SECTION_BY_KIND: Partial<Record<WorkspaceWidgetKind, string>> = Object.fromEntries(
  SIDEBAR_NAV_SECTIONS.flatMap((s) => s.items.map((item) => [item.id, s.label])),
);
SECTION_BY_KIND.chapan = 'Кабинеты';

const TILE_PREVIEWS: Record<WorkspaceWidgetKind, ComponentType<{ tileId: string }>> = {
  leads: LeadsTilePreview,
  deals: DealsTilePreview,
  customers: CustomersTilePreview,
  tasks: TasksTilePreview,
  warehouse: WarehouseTilePreview,
  production: ProductionTilePreview,
  finance: FinanceTilePreview,
  employees: EmployeesTilePreview,
  reports: ReportsTilePreview,
  documents: DocumentsTilePreview,
  chapan: ChapanTilePreview,
};

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
    Preview: TILE_PREVIEWS[item.id],
  };
}

export const WORKSPACE_WIDGETS: WorkspaceWidgetDefinition[] = SHORTCUT_NAV_ITEMS.map(toWidgetDefinition);

export const WORKSPACE_WIDGET_MAP = Object.fromEntries(
  WORKSPACE_WIDGETS.map((widget) => [widget.kind, widget]),
) as Record<WorkspaceWidgetKind, WorkspaceWidgetDefinition>;
