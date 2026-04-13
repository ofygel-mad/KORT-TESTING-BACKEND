import type { AuthSessionResponse } from '../shared/api/contracts';
import { MOCK_COMPANIES } from '../shared/api/mock-data';
import type { Membership, Org, User } from '../shared/stores/auth';

export const LOCAL_CONSOLE_ACCESS_TOKEN = 'kort_console_access_token';
export const LOCAL_CONSOLE_REFRESH_TOKEN = 'kort_console_refresh_token';

const CONSOLE_COMPANY = structuredClone(MOCK_COMPANIES[0]) as Org;

const CONSOLE_USER: User = {
  id: 'console-root',
  full_name: 'Console Root',
  email: 'console@local.dev',
  phone: '+7 700 000 00 00',
  avatar_url: null,
  status: 'active',
};

const CONSOLE_CAPABILITIES = [
  'customers:read',
  'customers:write',
  'deals:read',
  'deals:write',
  'tasks:read',
  'tasks:write',
  'reports.basic',
  'customers.import',
  'billing.manage',
  'integrations.manage',
  'audit.read',
  'team.manage',
  'automations.manage',
];

function buildConsoleMembership(): Membership {
  return {
    companyId: CONSOLE_COMPANY.id,
    companyName: CONSOLE_COMPANY.name,
    companySlug: CONSOLE_COMPANY.slug,
    status: 'active',
    role: 'owner',
    source: 'manual',
    requestId: null,
    inviteToken: null,
    joinedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildConsoleAuthSession(): AuthSessionResponse {
  return {
    access: LOCAL_CONSOLE_ACCESS_TOKEN,
    refresh: LOCAL_CONSOLE_REFRESH_TOKEN,
    user: structuredClone(CONSOLE_USER),
    org: structuredClone(CONSOLE_COMPANY),
    capabilities: [...CONSOLE_CAPABILITIES],
    role: 'owner',
    membership: buildConsoleMembership(),
    onboarding_completed: CONSOLE_COMPANY.onboarding_completed,
  };
}

export function buildConsoleMockSession() {
  return {
    ...buildConsoleAuthSession(),
    password: 'disabled',
  };
}

export function isConsoleAccessToken(token: string | null | undefined) {
  return token === LOCAL_CONSOLE_ACCESS_TOKEN || token === LOCAL_CONSOLE_REFRESH_TOKEN;
}
