import { DEV_RUNTIME_BLOCKERS_DISABLED } from '../config/devAccess';
import { useAuthStore, type MembershipRole } from '../stores/auth';

type Role = MembershipRole;

export function useRole() {
  if (DEV_RUNTIME_BLOCKERS_DISABLED) {
    return { role: 'owner' as Role, isOwner: true, isAdmin: true, isManager: true, isViewer: false };
  }

  const membershipStatus = useAuthStore((state) => state.membership.status);
  const membershipRole = useAuthStore((state) => state.membership.role);
  const fallbackRole = useAuthStore((state) => state.role) as Role;
  const userIsOwner = useAuthStore((state) => state.user?.is_owner ?? false);

  // Если бэкенд вернул флаг is_owner на User — гарантируем роль owner
  // независимо от текущего membership.role (защита от рассинхронизации)
  const resolvedRole = userIsOwner
    ? 'owner'
    : ((membershipStatus === 'active' ? (membershipRole ?? fallbackRole) : 'viewer') as Role);

  const isOwner = resolvedRole === 'owner';
  const isAdmin = resolvedRole === 'owner' || resolvedRole === 'admin';
  const isManager = isAdmin || resolvedRole === 'manager';
  const isViewer = resolvedRole === 'viewer';

  return { role: resolvedRole, isOwner, isAdmin, isManager, isViewer };
}
