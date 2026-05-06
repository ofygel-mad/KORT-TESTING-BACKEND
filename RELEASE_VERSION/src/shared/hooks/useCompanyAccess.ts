import { DEV_RUNTIME_BLOCKERS_DISABLED } from '../config/devAccess';
import { useAuthStore } from '../stores/auth';
import { useRole } from './useRole';

export type CompanyAccessState = 'anonymous' | 'no_company' | 'pending' | 'active' | 'rejected';

export function useCompanyAccess() {
  const user = useAuthStore((s) => s.user);
  const membership = useAuthStore((s) => s.membership);
  const inviteContext = useAuthStore((s) => s.inviteContext);
  const { isAdmin, isOwner, isManager, role } = useRole();

  if (DEV_RUNTIME_BLOCKERS_DISABLED) {
    const companyName = membership.companyName ?? inviteContext?.companyName ?? 'Workspace';
    return {
      state: 'active' as CompanyAccessState,
      role,
      companyName,
      membership: {
        ...membership,
        companyId: membership.companyId ?? 'org-001',
        companyName,
        companySlug: membership.companySlug ?? 'workspace',
        status: 'active' as const,
        role: membership.role ?? role,
        source: membership.source ?? 'manual',
      },
      inviteContext,
      isOwner,
      isAdmin,
      isManager,
      isAuthenticated: true,
      hasCompanyAccess: true,
      needsApproval: false,
      hasNoCompany: false,
      wasRejected: false,
    };
  }

  const state: CompanyAccessState = !user
    ? 'anonymous'
    : membership.status === 'active'
      ? 'active'
      : membership.status === 'pending'
        ? 'pending'
        : membership.status === 'rejected'
          ? 'rejected'
          : 'no_company';

  const companyName = membership.companyName ?? inviteContext?.companyName ?? null;

  return {
    state,
    role,
    companyName,
    membership,
    inviteContext,
    isOwner,
    isAdmin,
    isManager,
    isAuthenticated: Boolean(user),
    hasCompanyAccess: state === 'active',
    needsApproval: state === 'pending',
    hasNoCompany: state === 'no_company',
    wasRejected: state === 'rejected',
  };
}
