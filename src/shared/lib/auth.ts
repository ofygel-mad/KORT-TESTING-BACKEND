export function resolveOnboardingCompleted(
  response: Record<string, any> | null | undefined,
  fallback = false,
) {
  const responseValue = response?.onboarding_completed;
  const orgValue = response?.org?.onboarding_completed;

  if (typeof responseValue === 'boolean') return responseValue;
  if (typeof orgValue === 'boolean') return orgValue;
  return fallback;
}
