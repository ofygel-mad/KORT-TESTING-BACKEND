// ЧАСТЬ X — hook for reading the active (or previewed) composition config.
//
// The config arrives in the bootstrap response and is held in the auth store.
// In P0 nothing reads it for layout yet; P1–P3 wire each surface to it.

import { useAuthStore } from '@/shared/stores/auth';
import type { TenantConfigPayload } from './config-types';

/** The composition config for the current tenant, or null when signed out. */
export function useTenantConfig(): TenantConfigPayload | null {
  return useAuthStore((state) => state.tenantConfig);
}
