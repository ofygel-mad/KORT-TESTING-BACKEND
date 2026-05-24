// P1/P2 — Server-side BusinessProfile resolver.
//
// Mirrors src/entities/tenant/businessProfile.ts on the frontend so that
// frontend and server agree on lifecycle rules and module gates. Storage
// arrives in a later phase (separate column or table); P2 hardcodes the
// clothing_workshop default for every org — zero behavior change.
//
// Why not put this into TenantConfig.config? That field is a UI-composition
// config strictly validated against the manifest (composition.schema.ts).
// BusinessProfile is business-domain config — a separate concern — so it
// lives outside that schema.

export type BusinessProfileKey =
  | 'clothing_workshop'
  | 'watches_retail'
  | 'chemicals_b2b'
  | 'services'
  | 'furniture_mto'
  | 'blank';

export type OrderStatus =
  | 'new' | 'confirmed' | 'in_production' | 'ready'
  | 'transferred' | 'on_warehouse' | 'shipped' | 'completed' | 'cancelled';

export interface LifecycleConfig {
  stages: OrderStatus[];
  transitions: Partial<Record<OrderStatus, OrderStatus[]>>;
  defaultEntry: OrderStatus;
  terminal: OrderStatus[];
}

export interface ModuleFlags {
  production: boolean;
  warehouse: boolean;
  transit: boolean;
  returns: boolean;
  invoices: boolean;
}

export interface BusinessProfile {
  profileKey: BusinessProfileKey;
  templates: string[];
  lifecycle: LifecycleConfig;
  modules: ModuleFlags;
  card: { sections: string[] };
  metrics: { dimensions: string[] };
}

/**
 * Default profile — mirrors STATUS_TRANSITIONS in status-validator.ts so the
 * switch to profile-driven validation in P2 is a no-op.
 */
export const CLOTHING_WORKSHOP_PROFILE: BusinessProfile = {
  profileKey: 'clothing_workshop',
  templates: [],
  lifecycle: {
    stages: [
      'new', 'confirmed', 'in_production', 'ready',
      'transferred', 'on_warehouse', 'shipped', 'completed', 'cancelled',
    ],
    transitions: {
      new: ['confirmed', 'cancelled'],
      confirmed: ['in_production', 'on_warehouse', 'cancelled'],
      in_production: ['ready', 'cancelled'],
      ready: ['transferred', 'on_warehouse', 'cancelled'],
      transferred: ['on_warehouse', 'cancelled'],
      on_warehouse: ['shipped', 'ready', 'cancelled'],
      shipped: ['completed', 'cancelled'],
      completed: [],
      cancelled: ['ready'],
    },
    defaultEntry: 'new',
    terminal: ['completed'],
  },
  modules: {
    production: true,
    warehouse: true,
    transit: true,
    returns: true,
    invoices: true,
  },
  card: {
    sections: [
      'header', 'summary', 'items', 'production', 'payments',
      'attachments', 'activity', 'returns',
    ],
  },
  metrics: {
    dimensions: ['managerId', 'lifecycleStage'],
  },
};

/**
 * Resolves the profile for a given org. P2: always returns the clothing
 * workshop default. A future phase will read per-org storage and swap this
 * one location.
 */
export async function getBusinessProfileForOrg(
  _orgId: string,
): Promise<BusinessProfile> {
  return CLOTHING_WORKSHOP_PROFILE;
}

/** Sync accessor for hot paths where async is awkward (e.g. validators). */
export function getDefaultBusinessProfile(): BusinessProfile {
  return CLOTHING_WORKSHOP_PROFILE;
}
