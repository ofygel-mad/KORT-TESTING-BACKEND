// Canonical plan catalog — seeded into PlanDefinition. At runtime the DB rows
// are the source of truth; this list is what `seedPlans()` writes and the
// fallback when a Subscription points at an unknown planCode.

export interface PlanDef {
  code: string;
  name: string;
  description: string;
  rank: number; // tier ordering — basic 0, advanced 1, industrial 2
  maxUsers: number | null; // null = unlimited
  features: string[];
}

export const SYSTEM_PLANS: PlanDef[] = [
  {
    code: 'basic',
    name: 'Базовый',
    description: 'Стартовый контур: CRM, клиенты и базовый доступ команды.',
    rank: 0,
    maxUsers: 5,
    features: ['crm', 'customers', 'orders'],
  },
  {
    code: 'advanced',
    name: 'Продвинутый',
    description: 'Команда: инвайты, роли, заявки, отчёты и документы.',
    rank: 1,
    maxUsers: 25,
    features: [
      'crm', 'customers', 'orders', 'deals', 'tasks',
      'reports', 'documents', 'employees',
    ],
  },
  {
    code: 'industrial',
    name: 'Промышленный',
    description: 'Масштаб: производство, склад, логистика и интеграции.',
    rank: 2,
    maxUsers: null,
    features: [
      'crm', 'customers', 'orders', 'deals', 'tasks',
      'reports', 'documents', 'employees',
      'production', 'warehouse', 'logistics', 'products', 'purchase', 'integrations',
    ],
  },
];

export const PLAN_CODES = SYSTEM_PLANS.map((p) => p.code);

export const DEFAULT_PLAN_CODE = 'basic';

/** Fallback plan shape for a planCode with no PlanDefinition row. */
export function fallbackPlan(code: string): PlanDef {
  return (
    SYSTEM_PLANS.find((p) => p.code === code) ?? {
      code,
      name: code,
      description: '',
      rank: 0,
      maxUsers: null,
      features: [],
    }
  );
}
