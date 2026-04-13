export const DEMO_WORKSPACE_BADGE = 'Демо';

type DemoWorkspaceTarget =
  | { is_demo?: boolean | null }
  | boolean
  | null
  | undefined;

export function isDemoWorkspace(target: DemoWorkspaceTarget): boolean {
  if (!target) return false;

  if (typeof target === 'boolean') {
    return target;
  }

  return target.is_demo === true;
}
