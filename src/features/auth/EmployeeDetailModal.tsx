import { useState } from 'react';
import {
  X,
  ShieldCheck,
  RefreshCw,
  UserX,
  AlertTriangle,
  Phone,
  Building2,
  Calendar,
  UserCheck,
} from 'lucide-react';
import type {
  EmployeeRecord,
  EmployeePermission,
  UpdateEmployeePayload,
} from '../../shared/api/contracts';
import styles from './EmployeeDetailModal.module.css';

// ─── Константы ───────────────────────────────────────────────────────────────

const PERMISSION_OPTIONS: Array<{ key: EmployeePermission; label: string; description: string; group?: string }> = [
  {
    key: 'full_access',
    label: 'Полный доступ',
    description: 'Все функции, включая API и вебхуки.',
  },
  {
    key: 'financial_report',
    label: 'Финансовый отчёт',
    description: 'Excel-импорт/экспорт, финансовая аналитика.',
  },
  {
    key: 'sales',
    label: 'Продажи',
    description: 'Лиды, сделки, заявки, сводки.',
  },
  {
    key: 'production',
    label: 'Производство',
    description: 'Раздел производства.',
  },
  {
    key: 'warehouse_manager',
    label: 'Склад',
    description: 'Приёмка, хранение, отгрузка.',
  },
  {
    key: 'observer',
    label: 'Наблюдатель',
    description: 'Просмотр без права редактирования.',
  },
  // ─── Чапан ───
  {
    key: 'chapan_full_access',
    label: 'Чапан: полный доступ',
    description: 'Все разделы модуля Чапан без ограничений.',
    group: 'Чапан',
  },
  {
    key: 'chapan_access_orders',
    label: 'Чапан: Заказы',
    description: 'Просмотр, создание и редактирование заказов.',
    group: 'Чапан',
  },
  {
    key: 'chapan_access_production',
    label: 'Чапан: Производство',
    description: 'Производственные задачи и ход выполнения.',
    group: 'Чапан',
  },
  {
    key: 'chapan_access_ready',
    label: 'Чапан: Готово',
    description: 'Готовые заказы, передача и выдача.',
    group: 'Чапан',
  },
  {
    key: 'chapan_access_archive',
    label: 'Чапан: Архив',
    description: 'Архивные заказы и возврат из архива.',
    group: 'Чапан',
  },
  {
    key: 'chapan_access_warehouse_nav',
    label: 'Чапан: Ссылка на Склад',
    description: 'Видит кнопку перехода на Склад из модуля Чапан.',
    group: 'Чапан',
  },
  {
    key: 'chapan_manage_production',
    label: 'Чапан: Управление производством',
    description: 'Назначение исполнителей и управление этапами.',
    group: 'Чапан',
  },
  {
    key: 'chapan_confirm_invoice',
    label: 'Чапан: Подтверждение накладных',
    description: 'Подтверждение отгрузок по накладным со стороны Чапана.',
    group: 'Чапан',
  },
  {
    key: 'chapan_manage_settings',
    label: 'Чапан: Настройки модуля',
    description: 'Изменение настроек рабочего модуля Чапан.',
    group: 'Чапан',
  },
];

const STATUS_META: Record<
  EmployeeRecord['account_status'],
  { label: string; colorVar: string }
> = {
  active: { label: 'Активен', colorVar: 'var(--fill-positive, #22c55e)' },
  pending_first_login: { label: 'Ожидает первого входа', colorVar: 'var(--fill-warning, #f59e0b)' },
  dismissed: { label: 'Уволен', colorVar: 'var(--fill-danger, #ef4444)' },
};

// ─── Компонент ───────────────────────────────────────────────────────────────

interface Props {
  employee: EmployeeRecord;
  canEdit?: boolean;     // только admin/owner видят кнопки управления
  loading?: boolean;
  onUpdate: (id: string, payload: UpdateEmployeePayload) => void;
  onResetPassword: (id: string) => void;
  onDismiss: (id: string) => void;
  onClose: () => void;
}

export function EmployeeDetailModal({
  employee,
  canEdit = false,
  loading,
  onUpdate,
  onResetPassword,
  onDismiss,
  onClose,
}: Props) {
  const [permissions, setPermissions] = useState<EmployeePermission[]>(
    employee.permissions ?? [],
  );
  const [permsDirty, setPermsDirty] = useState(false);
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const isDismissed = employee.account_status === 'dismissed';
  const statusMeta = STATUS_META[employee.account_status] ?? STATUS_META.active;

  function togglePermission(perm: EmployeePermission) {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
    setPermsDirty(true);
  }

  function savePermissions() {
    onUpdate(employee.id, { permissions });
    setPermsDirty(false);
  }

  function formatDate(iso: string) {
    try {
      return new Intl.DateTimeFormat('ru-KZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={`Сотрудник: ${employee.full_name}`}
      >
        {/* ── Header ── */}
        <div className={styles.modalHeader}>
          <div className={styles.avatar}>{employee.full_name.charAt(0).toUpperCase()}</div>
          <div className={styles.headerInfo}>
            <div className={styles.headerName}>{employee.full_name}</div>
            <div
              className={styles.statusBadge}
              style={{ '--status-color': statusMeta.colorVar } as React.CSSProperties}
            >
              <span className={styles.statusDot} />
              {statusMeta.label}
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* ── Info block ── */}
          <div className={styles.infoBlock}>
            <div className={styles.infoRow}>
              <Phone size={14} />
              <span>{employee.phone}</span>
            </div>
            <div className={styles.infoRow}>
              <Building2 size={14} />
              <span>{employee.department}</span>
            </div>
            <div className={styles.infoRow}>
              <Calendar size={14} />
              <span>Добавлен: {formatDate(employee.created_at)}</span>
            </div>
            <div className={styles.infoRow}>
              <UserCheck size={14} />
              <span>Добавил: {employee.added_by_name}</span>
            </div>
          </div>

          {/* ── Permissions ── */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>
              <ShieldCheck size={14} />
              Права доступа
            </div>
            <div className={styles.permList}>
              {PERMISSION_OPTIONS.filter((opt) => !opt.group).map((opt) => {
                const checked = permissions.includes(opt.key);
                return (
                  <label
                    key={opt.key}
                    className={`${styles.permItem} ${checked ? styles.permItemChecked : ''} ${!canEdit || isDismissed ? styles.permItemDisabled : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!canEdit || isDismissed}
                      onChange={() => togglePermission(opt.key)}
                      className={styles.permCheckbox}
                    />
                    <div className={styles.permInfo}>
                      <span className={styles.permLabel}>{opt.label}</span>
                      <span className={styles.permDesc}>{opt.description}</span>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* ── Дополнительный модуль: Чапан ── */}
            <div className={styles.permModuleDivider}>
              <span className={styles.permModuleLabel}>Дополнительный модуль</span>
            </div>
            <div className={styles.permList}>
              {PERMISSION_OPTIONS.filter((opt) => opt.group === 'Чапан').map((opt) => {
                const checked = permissions.includes(opt.key);
                return (
                  <label
                    key={opt.key}
                    className={`${styles.permItem} ${checked ? styles.permItemChecked : ''} ${!canEdit || isDismissed ? styles.permItemDisabled : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!canEdit || isDismissed}
                      onChange={() => togglePermission(opt.key)}
                      className={styles.permCheckbox}
                    />
                    <div className={styles.permInfo}>
                      <span className={styles.permLabel}>{opt.label}</span>
                      <span className={styles.permDesc}>{opt.description}</span>
                    </div>
                  </label>
                );
              })}
            </div>
            {canEdit && !isDismissed && permsDirty && (
              <button
                type="button"
                className={styles.savePermsBtn}
                disabled={loading}
                onClick={savePermissions}
              >
                {loading ? 'Сохраняем...' : 'Сохранить права'}
              </button>
            )}
          </div>

          {/* ── Actions (admin only, not dismissed) ── */}
          {canEdit && !isDismissed && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Действия</div>
              <div className={styles.actionsList}>

                {/* Reset password */}
                {!showResetConfirm ? (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => setShowResetConfirm(true)}
                  >
                    <RefreshCw size={14} />
                    Сбросить пароль
                  </button>
                ) : (
                  <div className={styles.confirmCard}>
                    <AlertTriangle size={15} className={styles.confirmIcon} />
                    <div className={styles.confirmText}>
                      После сброса сотрудник снова войдёт через номер+номер и установит новый пароль.
                    </div>
                    <div className={styles.confirmBtns}>
                      <button
                        type="button"
                        className={styles.confirmCancelBtn}
                        onClick={() => setShowResetConfirm(false)}
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        className={styles.confirmOkBtn}
                        disabled={loading}
                        onClick={() => {
                          onResetPassword(employee.id);
                          setShowResetConfirm(false);
                        }}
                      >
                        {loading ? 'Сбрасываем...' : 'Да, сбросить'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Dismiss */}
                {!showDismissConfirm ? (
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                    onClick={() => setShowDismissConfirm(true)}
                  >
                    <UserX size={14} />
                    Уволить сотрудника
                  </button>
                ) : (
                  <div className={`${styles.confirmCard} ${styles.confirmCardDanger}`}>
                    <AlertTriangle size={15} className={styles.confirmIconDanger} />
                    <div className={styles.confirmText}>
                      Вы уверены? Это действие лишит{' '}
                      <strong>{employee.full_name}</strong> доступа к аккаунту.
                      Данные сохранятся, но войти будет невозможно.
                    </div>
                    <div className={styles.confirmBtns}>
                      <button
                        type="button"
                        className={styles.confirmCancelBtn}
                        onClick={() => setShowDismissConfirm(false)}
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        className={`${styles.confirmOkBtn} ${styles.confirmOkBtnDanger}`}
                        disabled={loading}
                        onClick={() => {
                          onDismiss(employee.id);
                          setShowDismissConfirm(false);
                        }}
                      >
                        {loading ? 'Увольняем...' : 'Уволить'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Dismissed notice ── */}
          {isDismissed && (
            <div className={styles.dismissedNotice}>
              <UserX size={15} />
              Сотрудник уволен. Доступ к аккаунту заблокирован. Данные сохранены в архиве.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
