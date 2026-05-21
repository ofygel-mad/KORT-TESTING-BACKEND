// Backend: /api/v1/company/employees
// Note: prefix is /api/v1/company NOT /api/v1/employees

// ── Permission model: scope.action ───────────────────────────────────────────
// Owners (User.is_owner) bypass all checks. 'company.admin' grants full access.

export type Permission =
  | 'orders.read' | 'orders.write' | 'orders.admin'
  | 'invoices.read' | 'invoices.write' | 'invoices.confirm'
  | 'warehouse.read' | 'warehouse.write' | 'warehouse.admin'
  | 'production.read' | 'production.write' | 'production.manage'
  | 'logistics.read' | 'logistics.write'
  | 'customers.read' | 'customers.write'
  | 'products.read' | 'products.write' | 'products.admin'
  | 'purchase.read' | 'purchase.write'
  | 'returns.read' | 'returns.write'
  | 'reports.read'
  | 'documents.read' | 'documents.write'
  | 'company.admin';

// Back-compat alias — many call sites still import EmployeePermission.
export type EmployeePermission = Permission;

export const ALL_PERMISSIONS: Permission[] = [
  'orders.read', 'orders.write', 'orders.admin',
  'invoices.read', 'invoices.write', 'invoices.confirm',
  'warehouse.read', 'warehouse.write', 'warehouse.admin',
  'production.read', 'production.write', 'production.manage',
  'logistics.read', 'logistics.write',
  'customers.read', 'customers.write',
  'products.read', 'products.write', 'products.admin',
  'purchase.read', 'purchase.write',
  'returns.read', 'returns.write',
  'reports.read',
  'documents.read', 'documents.write',
  'company.admin',
];

// ── RBAC: roles + per-member overrides ────────────────────────────────────────

export type PermissionEffect = 'allow' | 'deny';

export interface PermissionOverride {
  permission: Permission;
  effect: PermissionEffect;
}

// Data scope — whose records the role can see ('all' company data vs 'own' only).
export type DataScope = 'all' | 'own';

export interface Role {
  id: string;
  key: string;
  name: string;
  description: string;
  is_system: boolean;
  scope: 'system' | 'custom';
  permissions: Permission[];
  data_scope: DataScope;
}

export interface CreateRoleDto {
  name: string;
  description?: string;
  permissions: Permission[];
  dataScope: DataScope;
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  permissions?: Permission[];
  dataScope?: DataScope;
}

export interface Employee {
  id: string;                   // userId
  full_name: string;
  phone: string | null;
  department: string;
  role_id: string | null;
  role_name: string | null;
  overrides: PermissionOverride[];
  permissions: Permission[];    // effective = role + overrides
  status: 'active' | 'dismissed';
  isPendingFirstLogin?: boolean;
  addedByName: string | null;
  joinedAt: string;
}

// ── Permission matrix — drives the Settings → Employees access editor ─────────
// Each row is a module; columns are read / write / admin actions.

export type PermissionAction = 'read' | 'write' | 'admin';

export interface PermissionMatrixRow {
  module: string;
  label: string;
  read?: Permission;
  write?: Permission;
  admin?: Permission;
  adminLabel?: string; // override the "Администрирование" column label
}

export const PERMISSION_MATRIX: PermissionMatrixRow[] = [
  { module: 'orders', label: 'Заказы', read: 'orders.read', write: 'orders.write', admin: 'orders.admin' },
  { module: 'invoices', label: 'Накладные', read: 'invoices.read', write: 'invoices.write', admin: 'invoices.confirm', adminLabel: 'Подтверждение' },
  { module: 'warehouse', label: 'Склад', read: 'warehouse.read', write: 'warehouse.write', admin: 'warehouse.admin' },
  { module: 'production', label: 'Производство', read: 'production.read', write: 'production.write', admin: 'production.manage', adminLabel: 'Управление' },
  { module: 'logistics', label: 'Логистика', read: 'logistics.read', write: 'logistics.write' },
  { module: 'customers', label: 'Клиенты', read: 'customers.read', write: 'customers.write' },
  { module: 'products', label: 'Продукты', read: 'products.read', write: 'products.write', admin: 'products.admin' },
  { module: 'purchase', label: 'Закуп', read: 'purchase.read', write: 'purchase.write' },
  { module: 'returns', label: 'Возвраты', read: 'returns.read', write: 'returns.write' },
  { module: 'reports', label: 'Отчёты', read: 'reports.read' },
  { module: 'documents', label: 'Документы', read: 'documents.read', write: 'documents.write' },
];

// Special standalone permission — full company management (replaces the admin role).
export const COMPANY_ADMIN_PERMISSION: Permission = 'company.admin';

export const PERMISSION_LABEL: Record<Permission, string> = {
  'orders.read': 'Заказы: просмотр',
  'orders.write': 'Заказы: изменение',
  'orders.admin': 'Заказы: администрирование',
  'invoices.read': 'Накладные: просмотр',
  'invoices.write': 'Накладные: изменение',
  'invoices.confirm': 'Накладные: подтверждение',
  'warehouse.read': 'Склад: просмотр',
  'warehouse.write': 'Склад: изменение',
  'warehouse.admin': 'Склад: администрирование',
  'production.read': 'Производство: просмотр',
  'production.write': 'Производство: изменение',
  'production.manage': 'Производство: управление',
  'logistics.read': 'Логистика: просмотр',
  'logistics.write': 'Логистика: изменение',
  'customers.read': 'Клиенты: просмотр',
  'customers.write': 'Клиенты: изменение',
  'products.read': 'Продукты: просмотр',
  'products.write': 'Продукты: изменение',
  'products.admin': 'Продукты: администрирование',
  'purchase.read': 'Закуп: просмотр',
  'purchase.write': 'Закуп: изменение',
  'returns.read': 'Возвраты: просмотр',
  'returns.write': 'Возвраты: изменение',
  'reports.read': 'Отчёты: просмотр',
  'documents.read': 'Документы: просмотр',
  'documents.write': 'Документы: изменение',
  'company.admin': 'Администратор компании',
};

export interface CreateEmployeeDto {
  phone: string;       // +7XXXXXXXXXX format
  full_name: string;
  department: string;
  roleId: string;
  overrides?: PermissionOverride[];
}

export interface UpdateEmployeeDto {
  department?: string;
  roleId?: string;
  overrides?: PermissionOverride[];
}
