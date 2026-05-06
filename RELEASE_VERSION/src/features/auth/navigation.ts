import type { Membership, Org } from '../../shared/stores/auth';

export function resolvePostAuthPath(args: {
  org: Org | null;
  membership: Membership;
}) {
  if (args.membership.status !== 'active') {
    return args.org ? '/settings/company-access' : '/';
  }

  if (
    args.membership.role === 'owner' &&
    args.org &&
    !args.org.onboarding_completed
  ) {
    return '/onboarding';
  }

  return '/';
}
