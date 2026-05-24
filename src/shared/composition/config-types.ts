// ЧАСТЬ X — typed shape of the composition config object (frontend).
//
// Mirrors the config validated by server/src/modules/composition/
// composition.schema.ts. A config only ever toggles `visible` / `enabled`,
// reorders, or regroups blocks the manifest already declares — it can never
// introduce a field, table or column.

import type { SurfaceId } from './manifest-types';

export interface SectionConfig {
  enabled: boolean;
}

export interface BlockConfig {
  visible: boolean;
  order: number;
  group?: string;
}

export interface SurfaceConfig {
  blocks: Record<string, BlockConfig | undefined>;
}

export interface TenantConfigData {
  schemaVersion: number;
  sections: Record<string, SectionConfig | undefined>;
  surfaces: Partial<Record<SurfaceId, SurfaceConfig>>;
}

/** The composition config payload delivered inside the bootstrap response. */
export interface TenantConfigPayload {
  data: TenantConfigData;
  revision: number;
  manifestVersion: string;
  /** default | platform | rollback | preview */
  source: string;
  /** true when this is a staged preview (operator session), not the active config. */
  preview: boolean;
}
