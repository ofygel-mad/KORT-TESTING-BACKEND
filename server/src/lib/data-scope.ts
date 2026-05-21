// Data scope — answers "whose data can this member see", orthogonal to
// permissions which answer "what actions are allowed".
//   all → every record in the org
//   own → only records the member owns (their managerId / assignedTo)
// department/branch are deferred until org branches exist.

export type DataScope = 'all' | 'own';

const VALID_SCOPES: readonly DataScope[] = ['all', 'own'];

export function isDataScope(value: unknown): value is DataScope {
  return typeof value === 'string' && VALID_SCOPES.includes(value as DataScope);
}

/** Normalizes any stored/input value to a valid scope, defaulting to `all`. */
export function asDataScope(value: unknown): DataScope {
  return value === 'own' ? 'own' : 'all';
}

/**
 * Effective data scope for a member.
 * Owner and company.admin always see all data; otherwise the role decides.
 */
export function resolveDataScope(
  isOwner: boolean,
  permissions: readonly string[],
  roleDataScope: string | null | undefined,
): DataScope {
  if (isOwner) return 'all';
  if (permissions.includes('company.admin')) return 'all';
  return roleDataScope === 'own' ? 'own' : 'all';
}

/**
 * Prisma `where` fragment that narrows a query to the member's own records.
 * `ownerField` is the column holding the owning user id (managerId, assignedTo…).
 * Returns `{}` for `all` scope, so it can be spread unconditionally.
 */
export function ownScopeWhere(
  scope: DataScope,
  userId: string,
  ownerField: string,
): Record<string, string> {
  return scope === 'own' ? { [ownerField]: userId } : {};
}
