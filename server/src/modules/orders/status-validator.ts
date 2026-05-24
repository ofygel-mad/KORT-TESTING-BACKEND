/**
 * Centralized order status transition validation.
 *
 * P2: validation is now BusinessProfile-driven. All public functions accept
 * an optional `profile` argument; when omitted, the default profile
 * (clothing_workshop) is used — preserving every callsite's pre-P2
 * behavior. The legacy `STATUS_TRANSITIONS` constant is kept as a re-export
 * of the default profile's transitions so any external consumer keeps
 * compiling.
 */

import type { OrderStatus } from './types.js';
import {
  getDefaultBusinessProfile,
  type BusinessProfile,
} from '../composition/business-profile.js';

/**
 * Legacy constant — mirrors the default profile. Exported for back-compat;
 * new code should call `getAvailableTransitions(status, profile)` instead.
 */
export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> =
  buildTransitionsRecord(getDefaultBusinessProfile());

function buildTransitionsRecord(
  profile: BusinessProfile,
): Record<OrderStatus, OrderStatus[]> {
  const out = {} as Record<OrderStatus, OrderStatus[]>;
  for (const stage of profile.lifecycle.stages) {
    out[stage] = profile.lifecycle.transitions[stage] ?? [];
  }
  return out;
}

/**
 * Validate if a status transition is allowed under the given profile's
 * lifecycle. Falls back to the default profile when none is supplied.
 */
export function validateStatusTransition(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus,
  profile: BusinessProfile = getDefaultBusinessProfile(),
): { valid: boolean; reason?: string } {
  if (currentStatus === targetStatus) {
    return { valid: false, reason: `Already in status ${currentStatus}` };
  }

  if (profile.lifecycle.terminal.includes(currentStatus)) {
    return { valid: false, reason: `Cannot change ${currentStatus} orders` };
  }

  const allowed = profile.lifecycle.transitions[currentStatus] ?? [];
  if (!allowed.includes(targetStatus)) {
    return {
      valid: false,
      reason: `Cannot transition from "${currentStatus}" to "${targetStatus}". Allowed: ${allowed.join(', ') || '(none)'}`,
    };
  }

  return { valid: true };
}

/**
 * Status-specific contextual rules. Profile-aware: skips the production
 * gate entirely for profiles where `modules.production === false`.
 */
export function validateStatusTransitionRules(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus,
  context: {
    hasProductionTasks?: boolean;
    productionTasksCompleted?: boolean;
    hasWarehouseItems?: boolean;
    requiresInvoice?: boolean;
    hasConfirmedInvoice?: boolean;
  },
  profile: BusinessProfile = getDefaultBusinessProfile(),
): { valid: boolean; reason?: string } {
  const basicValidation = validateStatusTransition(currentStatus, targetStatus, profile);
  if (!basicValidation.valid) {
    return basicValidation;
  }

  if (currentStatus === 'ready' && targetStatus === 'on_warehouse') {
    if (!context.hasWarehouseItems) {
      return {
        valid: false,
        reason: 'Cannot advance order without warehouse items. Order must have items with warehouse fulfillment mode.',
      };
    }
    if (context.requiresInvoice && !context.hasConfirmedInvoice) {
      return {
        valid: false,
        reason: 'Invoice is required for this order. Please create and confirm invoice first.',
      };
    }
  }

  // Production gate only applies when the profile actually enables a
  // workshop. Retail/services profiles never create production tasks, so
  // they must not be held back by an empty-task check here.
  if (
    profile.modules.production
    && currentStatus === 'in_production'
    && targetStatus === 'ready'
  ) {
    if (context.hasProductionTasks && !context.productionTasksCompleted) {
      return {
        valid: false,
        reason: 'All production tasks must be completed before marking order as ready',
      };
    }
  }

  return { valid: true };
}

/**
 * Returns the targets currently reachable from `status` under `profile`.
 */
export function getAvailableTransitions(
  status: OrderStatus,
  profile: BusinessProfile = getDefaultBusinessProfile(),
): OrderStatus[] {
  return profile.lifecycle.transitions[status] ?? [];
}

/**
 * Business-level lifecycle stage. Decouples the legacy 9-value `status`
 * string from the cross-profile lifecycle axis used by analytics and the
 * payroll foundation. Persisted in `Order.lifecycleStage`.
 */
export type LifecycleStage =
  | 'draft' | 'committed' | 'fulfilling' | 'completed' | 'cancelled';

/**
 * Maps the legacy `Order.status` to its business-level lifecycle stage.
 * Stable for the clothing_workshop profile; new profiles override by
 * declaring their own stage→status mapping when their status names diverge.
 */
export function mapStatusToLifecycleStage(status: OrderStatus): LifecycleStage {
  switch (status) {
    case 'new':
      return 'draft';
    case 'confirmed':
      return 'committed';
    case 'in_production':
    case 'ready':
    case 'transferred':
    case 'on_warehouse':
    case 'shipped':
      return 'fulfilling';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
  }
}

/**
 * User-friendly status labels. Stay tied to the canonical OrderStatus union
 * since these labels are referenced by code, exports, and templates.
 */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  in_production: 'В цехе',
  ready: 'Готово',
  transferred: 'Передан',
  on_warehouse: 'На складе',
  shipped: 'Отправлен',
  completed: 'Завершён',
  cancelled: 'Отменён',
};
