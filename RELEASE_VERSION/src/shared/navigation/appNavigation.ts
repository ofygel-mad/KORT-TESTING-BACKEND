import type { LucideIcon } from 'lucide-react';
import {
  BarChart2,
  Briefcase,
  Building2,
  CheckSquare,
  Factory,
  FolderOpen,
  Layers,
  Settings,
  User,
  Users,
  Warehouse,
} from 'lucide-react';
import type { OrgMode } from '../hooks/usePlan';

export type ShortcutNavItemId =
  | 'leads'
  | 'deals'
  | 'customers'
  | 'tasks'
  | 'warehouse'
  | 'production'
  | 'finance'
  | 'employees'
  | 'reports'
  | 'documents'
  | 'chapan';

export interface ShortcutNavItem {
  id: ShortcutNavItemId;
  to: string;
  icon: LucideIcon;
  label: string;
  description: string;
  color: string;
  planTier: OrgMode;
}

export interface SidebarNavItem {
  id: 'canvas' | 'settings' | ShortcutNavItemId;
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

export interface SidebarNavSection {
  label: string;
  items: ShortcutNavItem[];
}

export const CANVAS_NAV_ITEM: SidebarNavItem = {
  id: 'canvas',
  to: '/',
  icon: Layers,
  label: 'Канвас',
  end: true,
};

export const SETTINGS_NAV_ITEM: SidebarNavItem = {
  id: 'settings',
  to: '/settings',
  icon: Settings,
  label: 'Настройки',
};

export const SHORTCUT_NAV_ITEMS: ShortcutNavItem[] = [
  {
    id: 'leads',
    to: '/crm/leads',
    icon: Users,
    label: 'Лиды',
    description: 'Входящие лиды и первичная квалификация.',
    color: 'var(--fill-info)',
    planTier: 'basic',
  },
  {
    id: 'deals',
    to: '/crm/deals',
    icon: Briefcase,
    label: 'Сделки',
    description: 'Сделки, этапы и контроль оплаты.',
    color: 'var(--fill-accent)',
    planTier: 'advanced',
  },
  {
    id: 'customers',
    to: '/crm/customers',
    icon: User,
    label: 'Клиенты',
    description: 'Клиентская база и история взаимодействий.',
    color: '#5C8DFF',
    planTier: 'basic',
  },
  {
    id: 'tasks',
    to: '/crm/tasks',
    icon: CheckSquare,
    label: 'Задачи',
    description: 'Личные и командные задачи с дедлайнами.',
    color: 'var(--fill-positive)',
    planTier: 'advanced',
  },
  {
    id: 'warehouse',
    to: '/warehouse',
    icon: Warehouse,
    label: 'Склад',
    description: 'Остатки, движения и контроль минимальных запасов.',
    color: '#C9A84C',
    planTier: 'basic',
  },
  {
    id: 'production',
    to: '/production',
    icon: Factory,
    label: 'Производство',
    description: 'Отдельный производственный модуль находится в подготовке.',
    color: '#F59E0B',
    planTier: 'advanced',
  },
  {
    id: 'finance',
    to: '/finance',
    icon: BarChart2,
    label: 'Финансы',
    description: 'Движение денег, расходы и платежная дисциплина.',
    color: '#2E9D84',
    planTier: 'advanced',
  },
  {
    id: 'employees',
    to: '/employees',
    icon: Building2,
    label: 'Сотрудники',
    description: 'Команда, роли и права доступа.',
    color: '#8FA4C8',
    planTier: 'advanced',
  },
  {
    id: 'reports',
    to: '/reports',
    icon: BarChart2,
    label: 'Отчёты',
    description: 'Сводная аналитика по продажам и операциям.',
    color: '#5FB889',
    planTier: 'advanced',
  },
  {
    id: 'documents',
    to: '/documents',
    icon: FolderOpen,
    label: 'Документы',
    description: 'Рабочие документы и генерация файлов.',
    color: '#8AA7FF',
    planTier: 'advanced',
  },
  {
    id: 'chapan',
    to: '/workzone/chapan',
    icon: Layers,
    label: 'Чапан',
    description: 'Рабочая зона ателье и связанных внутренних процессов.',
    color: '#D0B06A',
    planTier: 'industrial',
  },
];

export const SHORTCUT_NAV_MAP = Object.fromEntries(
  SHORTCUT_NAV_ITEMS.map((item) => [item.id, item]),
) as Record<ShortcutNavItemId, ShortcutNavItem>;

function pickShortcutNavItems(...ids: ShortcutNavItemId[]) {
  return ids.map((id) => SHORTCUT_NAV_MAP[id]);
}

export const SIDEBAR_NAV_SECTIONS: SidebarNavSection[] = [
  {
    label: 'CRM',
    items: pickShortcutNavItems('leads', 'deals', 'customers', 'tasks'),
  },
  {
    label: 'Операции',
    items: pickShortcutNavItems('warehouse', 'production', 'finance', 'employees'),
  },
  {
    label: 'Аналитика',
    items: pickShortcutNavItems('reports', 'documents'),
  },
];

export const CHAPAN_NAV_ITEM = SHORTCUT_NAV_MAP.chapan;
