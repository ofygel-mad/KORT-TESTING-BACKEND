import { PERMISSION_MATRIX, type Permission } from '@/entities/employee/types';

export interface PermissionGroup {
  module: string;
  label: string;
  actions: Array<{ key: Permission; label: string }>;
}

/** Permission options grouped by module — drives the access editor checkboxes. */
export const PERMISSION_GROUPS: PermissionGroup[] = PERMISSION_MATRIX.map((row) => ({
  module: row.module,
  label: row.label,
  actions: [
    row.read ? { key: row.read, label: 'Просмотр' } : null,
    row.write ? { key: row.write, label: 'Изменение' } : null,
    row.admin ? { key: row.admin, label: row.adminLabel ?? 'Администрирование' } : null,
  ].filter((a): a is { key: Permission; label: string } => a !== null),
}));

/** Flat list of every assignable permission. */
export const EMPLOYEE_PERMISSION_OPTIONS: Array<{ key: Permission; label: string }> =
  PERMISSION_GROUPS.flatMap((g) =>
    g.actions.map((a) => ({ key: a.key, label: `${g.label}: ${a.label}` })),
  );
