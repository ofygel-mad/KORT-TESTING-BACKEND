import { useMemo } from 'react';
import { useAuthStore } from '../stores/auth';
import { useRole } from './useRole';
import type { EmployeePermission } from '../api/contracts';

/**
 * Хук для проверки прав доступа сотрудника на основе системы чекбоксов.
 *
 * Логика приоритетов:
 * 1. Руководитель (is_owner) — абсолютные права, игнорирует все чекбоксы
 * 2. full_access — эквивалент руководителя, все разделы открыты
 * 3. Остальные права комбинируются: у одного сотрудника может быть
 *    и sales, и production одновременно
 * 4. observer — только просмотр во всех разрешённых разделах
 *
 * Используется в SPA-компонентах для скрытия/блокировки элементов.
 */
export function useEmployeePermissions() {
  const { isOwner, isAdmin } = useRole();
  const rawPermissions = useAuthStore((state) => state.user?.employee_permissions ?? []);

  const perms = useMemo<EmployeePermission[]>(
    () => rawPermissions as EmployeePermission[],
    [rawPermissions],
  );

  const has = (p: EmployeePermission) => perms.includes(p);

  // Владелец и полный доступ — абсолютные права
  const isAbsolute = isOwner || has('full_access');

  // Флаг «только просмотр» — observer без других прав (кроме full_access)
  const isObserverOnly =
    !isAbsolute &&
    has('observer') &&
    !has('sales') &&
    !has('production') &&
    !has('warehouse_manager') &&
    !has('financial_report');

  return {
    /** Права массивом для сериализации */
    permissions: perms,

    /** Может делать абсолютно всё (owner или full_access) */
    isAbsolute,

    /** Может управлять командой и настройками */
    canManageTeam: isAbsolute || isAdmin,

    /** Доступ к финансовым модулям (Excel-импорт/экспорт, аналитика) */
    canAccessFinancial: isAbsolute || has('financial_report'),

    /** Доступ к модулям продаж (лиды, сделки, заявки, сводки) */
    canAccessSales: isAbsolute || has('sales'),

    /** Доступ к разделу производства */
    canAccessProduction: isAbsolute || has('production'),

    /**
     * Только просмотр — может видеть разрешённые разделы, но не может
     * взаимодействовать или редактировать что-либо.
     * Применяется СОВМЕСТНО с другими флагами доступа:
     * проверяй сначала canAccessSales, потом — isObserverOnly.
     */
    isObserverOnly,

    /** Может подключать API и Webhook-интеграции */
    canManageIntegrations: isAbsolute,

    /** Доступ к разделу склада */
    canAccessWarehouse: isAbsolute || has('warehouse_manager'),

    /** Может изменять данные (не observer) */
    canEdit: !isObserverOnly,
  };
}
