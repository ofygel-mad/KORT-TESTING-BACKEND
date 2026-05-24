// ЧАСТЬ X — composition manifest types (frontend).
//
// Structural mirror of the type shape in server/src/modules/composition/
// manifest.ts. The DATA lives in the generated `manifest.generated.ts`; these
// types describe its shape. A block id present in the manifest with no
// registered component is a build/test failure (see registries + parity tests).

export type SurfaceId = 'sidebar' | 'new-order' | 'warehouse';
export type PlanTier = 'basic' | 'advanced' | 'industrial';

/** A top-level feature area. Its `enabled` flag gates nav + routes + API. */
export interface ManifestSection {
  id: string;
  label: string;
  removable: boolean;
  planTier: PlanTier;
}

/** A pre-coded UI block belonging to one configurable surface. */
export interface ManifestBlock {
  id: string;
  label: string;
  surface: SurfaceId;
  group: string | null;
  defaultOrder: number;
  removable: boolean;
  planTier: PlanTier | null;
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
