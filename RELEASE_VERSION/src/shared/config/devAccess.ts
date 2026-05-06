import type { AuthSessionResponse } from '../api/contracts';
import { cloneSession, resolveMockAuthSessionByEmail } from '../api/mock-data';
import type { OrgSummary } from '../stores/auth';
import { useAuthStore } from '../stores/auth';

export const DEV_AUTH_BYPASS_ENABLED = import.meta.env.DEV
  && (
    import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'
  );

export const DEV_RUNTIME_BLOCKERS_DISABLED = DEV_AUTH_BYPASS_ENABLED;

const DEFAULT_DEV_AUTH_EMAIL = String(import.meta.env.VITE_DEV_AUTH_EMAIL ?? 'owner@mock.local')
  .trim()
  .toLowerCase();

function buildUserOrgs(session: AuthSessionResponse): OrgSummary[] {
  if (!session.org) {
    return [];
  }

  return [{
    id: session.org.id,
    name: session.org.name,
    slug: session.org.slug,
    mode: session.org.mode,
    currency: session.org.currency,
    onboarding_completed: session.org.onboarding_completed,
    role: session.membership.role ?? session.role,
  }];
}

export function ensureDevAuthBypass() {
  if (!DEV_AUTH_BYPASS_ENABLED) {
    return false;
  }

  const seed = resolveMockAuthSessionByEmail(DEFAULT_DEV_AUTH_EMAIL)
    ?? resolveMockAuthSessionByEmail('owner@mock.local');
  if (!seed) {
    return false;
  }

  const session = cloneSession(seed);
  const auth = useAuthStore.getState();
  const alreadySeeded = auth.token === session.access
    && auth.refreshToken === session.refresh
    && auth.membership.status === 'active'
    && auth.isUnlocked;

  if (!alreadySeeded) {
    auth.setAuth(
      session.user,
      session.org,
      session.access,
      session.refresh,
      session.capabilities,
      session.role,
      {
        membership: session.membership,
        inviteContext: null,
        orgs: buildUserOrgs(session),
      },
    );
    auth.setSelectedOrgId(null);
  }

  if (!useAuthStore.getState().isUnlocked) {
    useAuthStore.getState().unlock();
  }

  return true;
}
