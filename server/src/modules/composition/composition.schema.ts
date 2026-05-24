// ЧАСТЬ X — Zod schema for the tenant config object, derived from the manifest.
//
// `.strict()` everywhere means an unknown section/block id is rejected (422) —
// a config can only ever reference ids the manifest already declares. This is
// the structural guarantee that a config can never introduce a new field, table
// or column. `.partial()` keeps stored configs forward-compatible: adding a
// manifest block does not invalidate existing configs.

import { z } from 'zod';
import { COMPOSITION_MANIFEST } from './manifest.js';

/** Version of the typed config-object shape. Bumped on a breaking shape change. */
export const SCHEMA_VERSION = 1;

const sectionStateSchema = z
  .object({ enabled: z.boolean() })
  .strict();

const blockStateSchema = z
  .object({
    visible: z.boolean(),
    order: z.number().int().min(0),
    group: z.string().min(1).optional(),
  })
  .strict();

function buildSectionsSchema() {
  const shape: Record<string, typeof sectionStateSchema> = {};
  for (const section of COMPOSITION_MANIFEST.sections) {
    shape[section.id] = sectionStateSchema;
  }
  return z.object(shape).partial().strict();
}

function buildSurfacesSchema() {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const surface of COMPOSITION_MANIFEST.surfaces) {
    const blockShape: Record<string, typeof blockStateSchema> = {};
    for (const block of surface.blocks) {
      blockShape[block.id] = blockStateSchema;
    }
    shape[surface.id] = z
      .object({ blocks: z.object(blockShape).partial().strict() })
      .strict();
  }
  return z.object(shape).partial().strict();
}

/** Full tenant config schema. Built from the manifest, so it tracks the catalog. */
export const tenantConfigSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    sections: buildSectionsSchema(),
    surfaces: buildSurfacesSchema(),
  })
  .strict()
  .superRefine((cfg, ctx) => {
    // A non-removable section can never be disabled by config.
    for (const section of COMPOSITION_MANIFEST.sections) {
      if (!section.removable && cfg.sections?.[section.id]?.enabled === false) {
        ctx.addIssue({
          code: 'custom',
          message: `Секцию «${section.label}» нельзя отключить.`,
          path: ['sections', section.id, 'enabled'],
        });
      }
    }
    // A non-removable block can never be hidden by config.
    for (const surface of COMPOSITION_MANIFEST.surfaces) {
      for (const block of surface.blocks) {
        if (
          !block.removable &&
          cfg.surfaces?.[surface.id]?.blocks?.[block.id]?.visible === false
        ) {
          ctx.addIssue({
            code: 'custom',
            message: `Блок «${block.label}» нельзя скрыть.`,
            path: ['surfaces', surface.id, 'blocks', block.id, 'visible'],
          });
        }
      }
    }
  });

export type TenantConfigData = z.infer<typeof tenantConfigSchema>;
