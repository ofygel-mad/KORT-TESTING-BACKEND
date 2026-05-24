// ЧАСТЬ X — Composition manifest: the single source of truth for the catalog
// of configurable surfaces, their blocks, and the top-level section catalog.
//
// The backend owns this file. It is used to (a) validate every incoming tenant
// config, (b) build the zero-regression default config, (c) be served to the
// Control Plane composition studio. The KORT frontend consumes a GENERATED
// mirror (`src/shared/composition/manifest.generated.ts`, via
// `server/scripts/export-manifest.ts`); parity tests guard against drift.
//
// See server/COMPOSABILITY_CONTRACT.md.

import { createHash } from 'node:crypto';

export type SurfaceId = 'sidebar' | 'new-order' | 'warehouse';
export type PlanTier = 'basic' | 'advanced' | 'industrial';

/** A top-level feature area. Its `enabled` flag gates nav + routes + API. */
export interface ManifestSection {
  id: string;
  label: string;
  /** false = the operator can never disable it (core area). */
  removable: boolean;
  /** Minimum plan that grants this section — the ceiling config cannot exceed. */
  planTier: PlanTier;
}

/** A pre-coded UI block belonging to one configurable surface. */
export interface ManifestBlock {
  id: string;
  label: string;
  surface: SurfaceId;
  /** Optional grouping bucket within the surface (e.g. sidebar section label). */
  group: string | null;
  /** Position in the default config (declaration order). */
  defaultOrder: number;
  /** false = the operator can never hide this block. */
  removable: boolean;
  /** Minimum plan, or null when the block is not plan-gated. */
  planTier: PlanTier | null;
  /** Permission key the block requires, or null. */
  permission: string | null;
}

export interface ManifestSurface {
  id: SurfaceId;
  label: string;
  blocks: ManifestBlock[];
}

export interface CompositionManifest {
  version: string;
  sections: ManifestSection[];
  surfaces: ManifestSurface[];
}

// ─── Section catalog ──────────────────────────────────────────────────────────
// One section per top-level nav family (mirrors src/shared/navigation/
// appNavigation.ts SHORTCUT_NAV_ITEMS). `sales` is core and non-removable.

const SECTIONS: ManifestSection[] = [
  { id: 'leads', label: 'Лиды', removable: true, planTier: 'basic' },
  { id: 'customers', label: 'Клиенты', removable: true, planTier: 'basic' },
  { id: 'tasks', label: 'Задачи', removable: true, planTier: 'advanced' },
  { id: 'sales', label: 'Продажи', removable: false, planTier: 'basic' },
  { id: 'warehouse', label: 'Склад', removable: true, planTier: 'basic' },
  { id: 'production', label: 'Производство', removable: true, planTier: 'advanced' },
  { id: 'logistics', label: 'Логистика', removable: true, planTier: 'advanced' },
  { id: 'products', label: 'Продукты', removable: true, planTier: 'basic' },
  { id: 'finance', label: 'Финансы', removable: true, planTier: 'advanced' },
  { id: 'reports', label: 'Отчёты', removable: true, planTier: 'advanced' },
  { id: 'documents', label: 'Документы', removable: true, planTier: 'advanced' },
];

// ─── Surface: sidebar ─────────────────────────────────────────────────────────
// Blocks are the nav items; `group` is the current sidebar section label.

interface SidebarBlockSeed {
  id: string;
  label: string;
  group: string;
  planTier: PlanTier;
  removable: boolean;
}

const SIDEBAR_BLOCK_SEEDS: SidebarBlockSeed[] = [
  { id: 'leads', label: 'Лиды', group: 'CRM', planTier: 'basic', removable: true },
  { id: 'sales', label: 'Продажи', group: 'CRM', planTier: 'basic', removable: false },
  { id: 'customers', label: 'Клиенты', group: 'CRM', planTier: 'basic', removable: true },
  { id: 'tasks', label: 'Задачи', group: 'CRM', planTier: 'advanced', removable: true },
  { id: 'warehouse', label: 'Склад', group: 'Операции', planTier: 'basic', removable: true },
  { id: 'production', label: 'Производство', group: 'Операции', planTier: 'advanced', removable: true },
  { id: 'logistics', label: 'Логистика', group: 'Операции', planTier: 'advanced', removable: true },
  { id: 'products', label: 'Продукты', group: 'Операции', planTier: 'basic', removable: true },
  { id: 'finance', label: 'Финансы', group: 'Операции', planTier: 'advanced', removable: true },
  { id: 'reports', label: 'Отчёты', group: 'Аналитика', planTier: 'advanced', removable: true },
  { id: 'documents', label: 'Документы', group: 'Аналитика', planTier: 'advanced', removable: true },
];

const SIDEBAR_BLOCKS: ManifestBlock[] = SIDEBAR_BLOCK_SEEDS.map((seed, index) => ({
  id: seed.id,
  label: seed.label,
  surface: 'sidebar',
  group: seed.group,
  defaultOrder: index,
  removable: seed.removable,
  planTier: seed.planTier,
  permission: null,
}));

// ─── Surface: new-order form ──────────────────────────────────────────────────
// Filled and wired in P2. `line-items` is core and non-removable.

const NEW_ORDER_BLOCK_SEEDS: Array<{ id: string; label: string; removable: boolean }> = [
  // client + line-items carry required schema fields — hiding them would make
  // the form unsubmittable, so they are non-removable.
  { id: 'client', label: 'Клиент', removable: false },
  { id: 'line-items', label: 'Позиции заказа', removable: false },
  { id: 'dates', label: 'Сроки и приоритет', removable: true },
  { id: 'payment', label: 'Оплата', removable: true },
  { id: 'notes', label: 'Примечания', removable: true },
];

const NEW_ORDER_BLOCKS: ManifestBlock[] = NEW_ORDER_BLOCK_SEEDS.map((seed, index) => ({
  id: seed.id,
  label: seed.label,
  surface: 'new-order',
  group: null,
  defaultOrder: index,
  removable: seed.removable,
  planTier: null,
  permission: null,
}));

// ─── Surface: warehouse ───────────────────────────────────────────────────────
// Placeholder ids only. The Warehouse surface is NOT wired (decided against
// configurable Warehouse). Kept in the manifest so 'warehouse' stays a known
// SurfaceId; the CP studio shows the tab as not-ready.

const WAREHOUSE_BLOCK_SEEDS: Array<{ id: string; label: string }> = [
  { id: 'stats-bar', label: 'Сводка по складу' },
  { id: 'twin-panel', label: 'Цифровой двойник' },
  { id: 'site-bootstrap', label: 'Управление площадками' },
  { id: 'structure-bootstrap', label: 'Зоны и ячейки' },
  { id: 'receipts', label: 'Приёмка' },
  { id: 'transfers', label: 'Перемещения' },
  { id: 'reservations', label: 'Резервы' },
  { id: 'documents', label: 'Документы склада' },
];

const WAREHOUSE_BLOCKS: ManifestBlock[] = WAREHOUSE_BLOCK_SEEDS.map((seed, index) => ({
  id: seed.id,
  label: seed.label,
  surface: 'warehouse',
  group: null,
  defaultOrder: index,
  removable: true,
  planTier: null,
  permission: null,
}));

const SURFACES: ManifestSurface[] = [
  { id: 'sidebar', label: 'Боковая навигация', blocks: SIDEBAR_BLOCKS },
  { id: 'new-order', label: 'Форма нового заказа', blocks: NEW_ORDER_BLOCKS },
  { id: 'warehouse', label: 'Раздел «Склад»', blocks: WAREHOUSE_BLOCKS },
];

/**
 * Stable content hash of the catalog (sections + surfaces). Changes whenever the
 * manifest content changes; stamped onto every config so a config validated
 * against an old manifest is detectable.
 */
export const MANIFEST_VERSION: string = createHash('sha256')
  .update(JSON.stringify({ sections: SECTIONS, surfaces: SURFACES }))
  .digest('hex')
  .slice(0, 12);

export const COMPOSITION_MANIFEST: CompositionManifest = {
  version: MANIFEST_VERSION,
  sections: SECTIONS,
  surfaces: SURFACES,
};

/** Surface lookup by id. */
export function getSurface(id: SurfaceId): ManifestSurface | undefined {
  return COMPOSITION_MANIFEST.surfaces.find((surface) => surface.id === id);
}
