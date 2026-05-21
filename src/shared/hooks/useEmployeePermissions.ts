import { useMemo } from 'react';
import { useAuthStore } from '../stores/auth';
import type { Permission } from '@/entities/employee/types';

/**
 * Access layer for the KORT permission model (scope.action).
 *
 * - Org owner (`user.is_owner`) bypasses every check.
 * - `company.admin` permission grants full access (replaces the old admin role).
 * - Everyone else holds an explicit list of scope.action permissions.
 *
 * Usage: `const { can } = useEmployeePermissions(); can('orders.write')`.
 */
export function useEmployeePermissions() {
  const isOwner = useAuthStore((state) => state.user?.is_owner ?? false);
  const rawPermissions = useAuthStore((state) => state.user?.employee_permissions ?? []);

  const perms = useMemo<Permission[]>(
    () => rawPermissions as Permission[],
    [rawPermissions],
  );

  const isCompanyAdmin = isOwner || perms.includes('company.admin');

  const can = useMemo(() => {
    return (permission: Permission): boolean => {
      if (isCompanyAdmin) return true;
      return perms.includes(permission);
    };
  }, [isCompanyAdmin, perms]);

  const canAny = useMemo(() => {
    return (...permissions: Permission[]): boolean => {
      if (isCompanyAdmin) return true;
      return permissions.some((p) => perms.includes(p));
    };
  }, [isCompanyAdmin, perms]);

  return {
    /** Raw permission list. */
    permissions: perms,
    /** True for the org owner. */
    isOwner,
    /** True for owner or holders of `company.admin`. */
    isCompanyAdmin,
    /** Check a single permission. */
    can,
    /** Check whether any of the given permissions is held. */
    canAny,

    // ── Legacy compatibility flags (deprecated) ──
    // Kept so existing call sites keep working; prefer can()/canAny() directly.
    /** @deprecated use isCompanyAdmin */
    isAbsolute: isCompanyAdmin,
    /** @deprecated use isCompanyAdmin */
    canManageTeam: isCompanyAdmin,
    /** @deprecated use isCompanyAdmin */
    canManageIntegrations: isCompanyAdmin,
    /** @deprecated use can('reports.read') */
    canAccessFinancial: can('reports.read'),
    /** @deprecated use canAny('orders.read', 'customers.read') */
    canAccessSales: canAny('orders.read', 'customers.read'),
    /** @deprecated use can('production.read') */
    canAccessProduction: can('production.read'),
    /** @deprecated use can('warehouse.read') */
    canAccessWarehouse: can('warehouse.read'),
    /** @deprecated observer role removed */
    isObserverOnly: false,
    /** @deprecated all permission holders can edit within their scope */
    canEdit: true,
  };
}
