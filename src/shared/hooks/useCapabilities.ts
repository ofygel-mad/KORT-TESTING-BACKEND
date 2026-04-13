import { useMemo } from 'react';
import { DEV_RUNTIME_BLOCKERS_DISABLED } from '../config/devAccess';
import { useAuthStore, type MembershipRole, type MembershipStatus } from '../stores/auth';

type ProductMode = 'basic' | 'advanced' | 'industrial';
type Role = MembershipRole;

const IMPLIED_BY_ROLE: Record<Role, string[]> = {
  owner: [
    'billing.manage',
    'integrations.manage',
    'audit.read',
    'team.manage',
    'automations.manage',
  ],
  admin: [
    'integrations.manage',
    'audit.read',
    'team.manage',
    'automations.manage',
  ],
  manager: [],
  viewer: [],
};

function resolveEffectiveRole(
  membershipStatus: MembershipStatus,
  membershipRole: MembershipRole | null,
  fallbackRole: string,
): Role {
  if (membershipStatus !== 'active') return 'viewer';
  return (membershipRole ?? (fallbackRole as Role) ?? 'viewer') as Role;
}

export function useCapabilities() {
  const rawCapabilities = useAuthStore((state) => state.capabilities);
  const membershipStatus = useAuthStore((state) => state.membership.status);
  const membershipRole = useAuthStore((state) => state.membership.role);
  const membershipCompanyName = useAuthStore((state) => state.membership.companyName);
  const orgMode = useAuthStore((state) => state.org?.mode);
  const fallbackRole = useAuthStore((state) => state.role);

  const role = resolveEffectiveRole(membershipStatus, membershipRole, fallbackRole);
  const mode = (orgMode ?? 'basic') as ProductMode;

  if (DEV_RUNTIME_BLOCKERS_DISABLED) {
    const capabilities = Array.from(new Set([
      ...(rawCapabilities ?? []),
      ...IMPLIED_BY_ROLE.owner,
      'customers:read',
      'customers:write',
      'deals:read',
      'deals:write',
      'tasks:read',
      'tasks:write',
      'reports.basic',
      'customers.import',
    ]));
    const can = (cap: string) => capabilities.includes(cap);

    return {
      can,
      capabilities,
      role: 'owner' as Role,
      mode,
      membershipStatus: 'active' as MembershipStatus,
      companyName: membershipCompanyName ?? 'Workspace',
      hasCompanyAccess: true,
      hasActiveAccess: true,
      isPendingApproval: false,
      needsCompanySelection: false,
      wasRejected: false,
      isAdmin: true,
      isBasic: mode === 'basic',
      isAdvanced: mode === 'advanced',
      isIndustrial: mode === 'industrial',
      canManageBilling: true,
      canManageIntegrations: true,
      canViewAudit: true,
      canManageTeam: true,
      canRunAutomations: true,
    };
  }

  const capabilities = useMemo(() => {
    if (membershipStatus !== 'active') return [];
    return Array.from(new Set([...(rawCapabilities ?? []), ...IMPLIED_BY_ROLE[role]]));
  }, [membershipStatus, rawCapabilities, role]);

  const can = (cap: string) => capabilities.includes(cap);
  const hasCompanyAccess = membershipStatus === 'active';
  const isPendingApproval = membershipStatus === 'pending';
  const isAdmin = role === 'owner' || role === 'admin';

  return {
    can,
    capabilities,
    role,
    mode,
    membershipStatus,
    companyName: membershipCompanyName,
    hasCompanyAccess,
    hasActiveAccess: hasCompanyAccess,
    isPendingApproval,
    needsCompanySelection: membershipStatus === 'none',
    wasRejected: membershipStatus === 'rejected',
    isAdmin,
    isBasic: mode === 'basic',
    isAdvanced: mode === 'advanced',
    isIndustrial: mode === 'industrial',
    canManageBilling: hasCompanyAccess && (can('billing.manage') || role === 'owner'),
    canManageIntegrations: hasCompanyAccess && can('integrations.manage'),
    canViewAudit: hasCompanyAccess && can('audit.read'),
    canManageTeam: hasCompanyAccess && can('team.manage'),
    canRunAutomations: hasCompanyAccess && can('automations.manage'),
  };
}
