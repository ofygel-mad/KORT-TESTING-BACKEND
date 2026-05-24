// P1 — BusinessProfile reading layer.
//
// A BusinessProfile describes the *business-domain* shape of an org: which
// order statuses exist, which transitions are allowed, which modules are
// enabled (production/warehouse/transit/returns/invoices), which OrderTemplate
// ids are usable, and which sections appear on the OrderDetailPage.
//
// This is intentionally separate from TenantConfig.config (which is a strict
// UI-composition config validated by the manifest). The two concerns are
// orthogonal: TenantConfig answers "which blocks are visible and in what
// order?"; BusinessProfile answers "what kind of business is this and what
// lifecycle rules apply?".
//
// P1 ships ONLY the reading layer with a hardcoded `clothing_workshop`
// default that mirrors today's server-side STATUS_TRANSITIONS exactly. No UI
// consumes it yet — that arrives in P2+. The hook is shaped so that when
// bootstrap starts delivering a profile, we swap the source without breaking
// callers.

import type { OrderStatus } from '@/entities/order/types';

export type BusinessProfileKey =
  | 'clothing_workshop'
  | 'watches_retail'
  | 'chemicals_b2b'
  | 'services'
  | 'furniture_mto'
  | 'blank';

export interface LifecycleConfig {
  /** Stages declared by this profile, in canonical order. */
  stages: OrderStatus[];
  /** Allowed transitions: key = current status, value = allowed targets. */
  transitions: Partial<Record<OrderStatus, OrderStatus[]>>;
  /** Stage a brand-new order starts in. */
  defaultEntry: OrderStatus;
  /** Terminal stages — no further transitions allowed (except via un-cancel). */
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
  /** Allowed OrderTemplate ids; empty = all available. */
  templates: string[];
  lifecycle: LifecycleConfig;
  modules: ModuleFlags;
  card: {
    /** Ordered list of section ids rendered on OrderDetailPage. */
    sections: string[];
  };
  metrics: {
    /** Aggregation axes exposed in Analytics. */
    dimensions: string[];
  };
}

/**
 * Clothing workshop — KORT's original profile. Mirrors server's
 * STATUS_TRANSITIONS at server/src/modules/orders/status-validator.ts:12 so
 * that swapping `validateStatusTransition` to a profile-driven implementation
 * in P2 is a no-op for existing orgs.
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
 * Resolves the BusinessProfile to use. P1: always returns the clothing
 * workshop default — no behavior change for any existing org. P2 will swap
 * this to read from the bootstrap response (auth store) when server-side
 * storage lands.
 *
 * Kept as a hook (not a constant) so future React Query / store reads remain
 * a drop-in replacement.
 */
export function useBusinessProfile(): BusinessProfile {
  return CLOTHING_WORKSHOP_PROFILE;
}

/** Programmatic accessor for non-React contexts (selectors, services). */
export function getBusinessProfile(): BusinessProfile {
  return CLOTHING_WORKSHOP_PROFILE;
}
