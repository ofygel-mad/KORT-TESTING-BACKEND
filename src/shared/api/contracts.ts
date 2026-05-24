import type {
  InviteContext,
  Membership,
  MembershipRole,
  Org,
  OrgSummary,
  User,
} from '../stores/auth';
import type { TenantConfigPayload } from '../composition/config-types';

// Permission model lives in entities/employee — imported + re-exported for back-compat.
import type { Permission, Employee, PermissionOverride } from '@/entities/employee/types';
export type EmployeePermission = Permission;

export type EmployeeAccountStatus = 'active' | 'pending_first_login' | 'dismissed';

// EmployeeRecord is the backend serializeEmployee shape — same as entities Employee.
export type EmployeeRecord = Employee;

export interface CreateEmployeePayload {
  phone: string;
  full_name: string;
  department: string;
  roleId: string;
  overrides?: PermissionOverride[];
}

export interface UpdateEmployeePayload {
  department?: string;
  roleId?: string;
  overrides?: PermissionOverride[];
}

export interface FirstLoginResponse {
  requires_password_setup: true;
  temp_token: string;
  user: {
    id: string;
    full_name: string;
    phone: string;
  };
}

export type LoginApiResponse = AuthSessionResponse | FirstLoginResponse;

export function isFirstLoginResponse(value: LoginApiResponse | null): value is FirstLoginResponse {
  return Boolean(value && (value as FirstLoginResponse).requires_password_setup === true);
}

export interface AuthSessionResponse {
  access: string;
  refresh: string;
  user: User;
  org: Org | null;
  capabilities: string[];
  role: MembershipRole | 'viewer';
  membership: Membership;
  onboarding_completed?: boolean;
  orgs?: OrgSummary[];
  /** ЧАСТЬ X — composition config for the active tenant. */
  config?: TenantConfigPayload | null;
}

export interface CompanyDirectoryItem extends Org {
  industry?: string;
}

export interface TeamMemberResponse {
  id: string;
  full_name: string;
  email: string;
  status: string;
  role?: MembershipRole | 'viewer';
}

export interface InviteRecord extends InviteContext {
  created_at: string;
  created_by: string;
  share_url: string;
  status: 'valid' | 'used' | 'expired';
}

export interface MembershipRequestRecord {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  company_id: string;
  company_name: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_role: MembershipRole;
  created_at: string;
}

export interface MembershipRequestSubmissionResponse {
  request: MembershipRequestRecord;
  membership: Membership;
}
