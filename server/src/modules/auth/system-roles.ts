// System roles — seeded with orgId = null, isSystem = true. Shared across all orgs.
// A role is a named bundle of scope.action permissions. Owner is NOT a role —
// it is the Membership.isOwner flag, which bypasses every permission check.

export interface SystemRoleDef {
  key: string;
  name: string;
  description: string;
  permissions: string[];
}

export const SYSTEM_ROLES: SystemRoleDef[] = [
  {
    key: 'admin',
    name: 'Администратор',
    description: 'Полное управление компанией, сотрудниками и настройками.',
    permissions: ['company.admin'],
  },
  {
    key: 'sales_manager',
    name: 'Менеджер продаж',
    description: 'Заказы, клиенты, возвраты и сводки по продажам.',
    permissions: [
      'orders.read', 'orders.write', 'orders.admin',
      'customers.read', 'customers.write',
      'returns.read', 'returns.write',
      'invoices.read',
      'reports.read',
    ],
  },
  {
    key: 'warehouse_manager',
    name: 'Завсклад',
    description: 'Склад, продукты, закуп и логистика.',
    permissions: [
      'warehouse.read', 'warehouse.write', 'warehouse.admin',
      'products.read', 'products.write', 'products.admin',
      'purchase.read', 'purchase.write',
      'logistics.read', 'logistics.write',
      'orders.read',
    ],
  },
  {
    key: 'accountant',
    name: 'Бухгалтер',
    description: 'Накладные, документы и финансовая отчётность.',
    permissions: [
      'invoices.read', 'invoices.write', 'invoices.confirm',
      'documents.read', 'documents.write',
      'reports.read',
      'orders.read',
    ],
  },
  {
    key: 'production_manager',
    name: 'Начальник цеха',
    description: 'Производственные задачи и управление цехом.',
    permissions: [
      'production.read', 'production.write', 'production.manage',
      'orders.read',
    ],
  },
  {
    key: 'viewer',
    name: 'Наблюдатель',
    description: 'Просмотр всех разделов без права изменения.',
    permissions: [
      'orders.read', 'invoices.read', 'warehouse.read', 'production.read',
      'logistics.read', 'customers.read', 'products.read', 'purchase.read',
      'returns.read', 'reports.read', 'documents.read',
    ],
  },
];

export const SYSTEM_ROLE_KEYS = SYSTEM_ROLES.map((r) => r.key);
