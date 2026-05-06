import type {
  AuthSessionResponse,
  CompanyDirectoryItem,
  InviteRecord,
  MembershipRequestRecord,
} from './contracts';
import type {
  InviteContext,
  Membership,
  MembershipRole,
  MembershipSource,
  MembershipStatus,
  Org,
  User,
} from '../stores/auth';

export type MockAuthSession = AuthSessionResponse & {
  password: string;
};

function iso(value: string) {
  return new Date(value).toISOString();
}

function buildCapabilities(role: MembershipRole | 'viewer', active: boolean) {
  if (!active) return [];

  const shared = [
    'customers:read',
    'customers:write',
    'deals:read',
    'deals:write',
    'tasks:read',
    'tasks:write',
    'reports.basic',
    'customers.import',
  ];

  if (role === 'owner') {
    return [
      ...shared,
      'billing.manage',
      'integrations.manage',
      'audit.read',
      'team.manage',
      'automations.manage',
    ];
  }

  if (role === 'admin') {
    return [
      ...shared,
      'integrations.manage',
      'audit.read',
      'team.manage',
      'automations.manage',
    ];
  }

  if (role === 'manager') {
    return shared;
  }

  return ['reports.basic'];
}

function buildMembership(
  company: CompanyDirectoryItem | Org | null,
  role: MembershipRole | null,
  status: MembershipStatus,
  source: MembershipSource | null,
  overrides: Partial<Membership> = {},
): Membership {
  return {
    companyId: company?.id ?? null,
    companyName: company?.name ?? null,
    companySlug: company?.slug ?? null,
    status,
    role,
    source,
    requestId: null,
    inviteToken: null,
    joinedAt: status === 'active' ? iso('2026-03-01T08:00:00Z') : null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

type SessionArgs = {
  id: string;
  full_name: string;
  email: string;
  password: string;
  phone?: string;
  org: CompanyDirectoryItem | Org | null;
  role: MembershipRole | 'viewer';
  membershipStatus: MembershipStatus;
  membershipRole?: MembershipRole | null;
  source: MembershipSource | null;
  membership?: Partial<Membership>;
};

function buildSession(args: SessionArgs): MockAuthSession {
  const membershipRole = args.membershipRole ?? (args.role === 'viewer' ? null : args.role);
  const active = args.membershipStatus === 'active';
  const user: User = {
    id: args.id,
    full_name: args.full_name,
    email: args.email,
    phone: args.phone,
    avatar_url: null,
    status: active ? 'active' : 'pending',
  };

  return {
    access: `mock_access_${args.id}`,
    refresh: `mock_refresh_${args.id}`,
    user,
    org: active ? (args.org as Org | null) : null,
    capabilities: buildCapabilities(args.role, active),
    role: active ? args.role : 'viewer',
    membership: buildMembership(args.org, membershipRole, args.membershipStatus, args.source, args.membership),
    onboarding_completed: args.org?.onboarding_completed,
    password: args.password,
  };
}

export const MOCK_COMPANIES: CompanyDirectoryItem[] = [
  {
    id: 'org-001',
    name: 'Workspace',
    slug: 'workspace',
    mode: 'advanced',
    currency: 'KZT',
    onboarding_completed: false,
    industry: 'Operations',
  },
  {
    id: 'org-002',
    name: 'Sandbox',
    slug: 'sandbox',
    mode: 'basic',
    currency: 'KZT',
    onboarding_completed: true,
    industry: 'Testing',
  },
];

const PRIMARY_COMPANY = MOCK_COMPANIES[0];

export const MOCK_AUTH_SESSIONS: MockAuthSession[] = [
  buildSession({
    id: 'u-001',
    full_name: 'Owner',
    email: 'owner@mock.local',
    phone: '+7 777 000 01 01',
    password: 'demo',
    org: PRIMARY_COMPANY,
    role: 'owner',
    membershipStatus: 'active',
    source: 'company_registration',
  }),
  buildSession({
    id: 'u-002',
    full_name: 'Admin',
    email: 'admin@mock.local',
    phone: '+7 777 000 02 02',
    password: 'demo',
    org: PRIMARY_COMPANY,
    role: 'admin',
    membershipStatus: 'active',
    source: 'manual',
  }),
  buildSession({
    id: 'u-003',
    full_name: 'Manager',
    email: 'manager@mock.local',
    phone: '+7 777 000 03 03',
    password: 'demo',
    org: PRIMARY_COMPANY,
    role: 'manager',
    membershipStatus: 'active',
    source: 'manual',
  }),
  buildSession({
    id: 'u-004',
    full_name: 'Pending User',
    email: 'pending@mock.local',
    phone: '+7 777 000 04 04',
    password: 'demo',
    org: PRIMARY_COMPANY,
    role: 'viewer',
    membershipStatus: 'pending',
    membershipRole: 'viewer',
    source: 'request',
    membership: {
      requestId: 'req-001',
    },
  }),
  buildSession({
    id: 'u-005',
    full_name: 'Standalone User',
    email: 'standalone@mock.local',
    phone: '+7 777 000 05 05',
    password: 'demo',
    org: null,
    role: 'viewer',
    membershipStatus: 'none',
    membershipRole: null,
    source: 'employee_registration',
  }),
];

export const MOCK_INVITES: InviteRecord[] = [
  {
    token: 'mock-team-link',
    companyId: PRIMARY_COMPANY.id,
    companyName: PRIMARY_COMPANY.name,
    companySlug: PRIMARY_COMPANY.slug,
    role: 'manager',
    autoApprove: true,
    kind: 'referral',
    created_at: iso('2026-03-18T10:00:00Z'),
    created_by: 'u-001',
    share_url: 'https://kort.local/auth/accept-invite?token=mock-team-link',
    expiresAt: null,
    status: 'valid',
  },
];

export const MOCK_MEMBERSHIP_REQUESTS: MembershipRequestRecord[] = [
  {
    id: 'req-001',
    user_id: 'u-004',
    full_name: 'Pending User',
    email: 'pending@mock.local',
    company_id: PRIMARY_COMPANY.id,
    company_name: PRIMARY_COMPANY.name,
    status: 'pending',
    requested_role: 'viewer',
    created_at: iso('2026-03-18T12:00:00Z'),
  },
];

export const MOCK_CUSTOMERS = [
  { id: 'c-001', full_name: 'Customer 1', company_name: 'Company 1', phone: '+7 701 111 11 11', email: 'customer1@mock.local', status: 'active', source: 'Web', created_at: '2025-01-10T10:00:00Z', health: { score: 82, band: 'healthy' } },
  { id: 'c-002', full_name: 'Customer 2', company_name: 'Company 2', phone: '+7 702 222 22 22', email: 'customer2@mock.local', status: 'new', source: 'Referral', created_at: '2025-01-14T09:00:00Z', health: { score: 55, band: 'at_risk' } },
  { id: 'c-003', full_name: 'Customer 3', company_name: '', phone: '+7 705 333 33 33', email: 'customer3@mock.local', status: 'inactive', source: 'Site', created_at: '2025-01-08T14:00:00Z', health: { score: 30, band: 'churned' } },
  { id: 'c-004', full_name: 'Customer 4', company_name: 'Company 4', phone: '+7 707 444 44 44', email: 'customer4@mock.local', status: 'active', source: 'Web', created_at: '2025-01-12T11:00:00Z', health: { score: 91, band: 'healthy' } },
  { id: 'c-005', full_name: 'Customer 5', company_name: 'Company 5', phone: '+7 708 555 55 55', email: 'customer5@mock.local', status: 'active', source: 'WhatsApp', created_at: '2025-01-15T08:00:00Z', health: { score: 70, band: 'healthy' } },
];

export const MOCK_DEALS = [
  { id: 'd-001', title: 'Deal 1', amount: 1500000, currency: 'KZT', stage: 'Negotiation', status: 'open', customer: { id: 'c-001', full_name: 'Customer 1' }, customer_id: 'c-001', customer_name: 'Customer 1', pipeline_id: 'p-001', stage_id: 's-002', created_at: '2025-01-10T10:00:00Z', updated_at: '2025-01-18T10:00:00Z', days_silent: 3 },
  { id: 'd-002', title: 'Deal 2', amount: 4200000, currency: 'KZT', stage: 'Proposal', status: 'open', customer: { id: 'c-004', full_name: 'Customer 4' }, customer_id: 'c-004', customer_name: 'Customer 4', pipeline_id: 'p-001', stage_id: 's-001', created_at: '2025-01-12T11:00:00Z', updated_at: '2025-01-16T11:00:00Z', days_silent: 12 },
  { id: 'd-003', title: 'Deal 3', amount: 800000, currency: 'KZT', stage: 'Qualification', status: 'open', customer: { id: 'c-002', full_name: 'Customer 2' }, customer_id: 'c-002', customer_name: 'Customer 2', pipeline_id: 'p-001', stage_id: 's-001', created_at: '2025-01-14T09:00:00Z', updated_at: '2025-01-20T09:00:00Z', days_silent: 1 },
];

export const MOCK_TASKS = [
  { id: 't-001', title: 'Follow up with Customer 1', priority: 'high', status: 'pending', due_at: new Date().toISOString(), customer: { id: 'c-001', full_name: 'Customer 1' }, assignee: MOCK_AUTH_SESSIONS[0].user, created_at: '2025-01-15T08:00:00Z' },
  { id: 't-002', title: 'Send proposal to Customer 4', priority: 'medium', status: 'pending', due_at: new Date().toISOString(), customer: { id: 'c-004', full_name: 'Customer 4' }, assignee: MOCK_AUTH_SESSIONS[0].user, created_at: '2025-01-15T09:00:00Z' },
  { id: 't-003', title: 'Team sync', priority: 'low', status: 'done', due_at: null, customer: null, assignee: MOCK_AUTH_SESSIONS[0].user, created_at: '2025-01-14T10:00:00Z' },
];

export const MOCK_PIPELINE = {
  id: 'p-001',
  name: 'Primary Pipeline',
  stages: [
    { id: 's-001', name: 'Qualification', position: 1, stage_type: 'open', color: '#4F8CFF', deals: ['d-002', 'd-003'] },
    { id: 's-002', name: 'Negotiation', position: 2, stage_type: 'open', color: '#7C3AED', deals: ['d-001'] },
    { id: 's-003', name: 'Proposal', position: 3, stage_type: 'open', color: '#D97706', deals: [] },
    { id: 's-004', name: 'Closed', position: 4, stage_type: 'won', color: '#10B981', deals: [] },
  ],
};

export const MOCK_DASHBOARD = {
  customers_count: 5,
  customers_delta: 2,
  active_deals_count: 3,
  revenue_month: 6500000,
  tasks_today: 2,
  overdue_tasks: 1,
  recent_customers: MOCK_CUSTOMERS.slice(0, 4),
  deals_no_activity: 1,
  stalled_deals: [MOCK_DEALS[1]],
  silent_customers: [MOCK_CUSTOMERS[2]],
  today_tasks: MOCK_TASKS.filter((task) => task.due_at).slice(0, 2),
};

export function cloneSession(session: MockAuthSession): MockAuthSession {
  return structuredClone(session);
}

export function resolveMockAuthSessionByEmail(email: string) {
  return MOCK_AUTH_SESSIONS.find((session) => session.user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function findMockCompanyById(companyId: string) {
  return MOCK_COMPANIES.find((company) => company.id === companyId) ?? null;
}

export function findMockInviteByToken(token: string) {
  return MOCK_INVITES.find((invite) => invite.token === token) ?? null;
}

export function attachInviteToSession(session: MockAuthSession, invite: InviteContext): MockAuthSession {
  const company = findMockCompanyById(invite.companyId) ?? {
    id: invite.companyId,
    name: invite.companyName,
    slug: invite.companySlug,
    mode: 'basic',
    currency: 'KZT',
    onboarding_completed: true,
  };

  const nextRole = invite.role;

  return {
    ...session,
    org: company,
    role: nextRole,
    capabilities: buildCapabilities(nextRole, true),
    membership: buildMembership(company, nextRole, 'active', 'invite', {
      inviteToken: invite.token,
      joinedAt: new Date().toISOString(),
    }),
  };
}
