import { useEmployeePermissions } from './useEmployeePermissions';

/**
 * @deprecated Roles were removed in favour of the scope.action permission model.
 * Thin compatibility shim — prefer `useEmployeePermissions().can(...)` directly.
 * `isAdmin` now means "owner or holder of company.admin".
 */
export function useRole() {
  const { isOwner, isCompanyAdmin } = useEmployeePermissions();
  return {
    isOwner,
    isAdmin: isCompanyAdmin,
    isManager: isCompanyAdmin,
    isViewer: false,
    role: isOwner ? 'owner' : isCompanyAdmin ? 'admin' : 'member',
  };
}
