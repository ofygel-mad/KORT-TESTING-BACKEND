import { useState } from 'react';
import { X, UserRoundPlus } from 'lucide-react';
import { formatKazakhPhoneInput, isKazakhPhoneComplete, normalizeKazakhPhone } from '../../shared/utils/kz';
import type {
  CreateEmployeePayload,
  EmployeePermission,
} from '../../shared/api/contracts';
import styles from './AddEmployeeModal.module.css';

// ─── Константы ───────────────────────────────────────────────────────────────

const PERMISSION_OPTIONS: Array<{ key: EmployeePermission; label: string; description: string; group?: string }> = [
  {
    key: 'full_access',
    label: 'Полный доступ',
    description: 'Все функции системы, включая API и вебхуки. Эквивалент прав руководителя.',
  },
  {
    key: 'financial_report',
    label: 'Финансовый отчёт',
    description: 'Загрузка и выгрузка Excel-таблиц, финансовая аналитика.',
  },
  {
    key: 'sales',
    label: 'Продажи',
    description: 'Лиды, сделки, заявки и сводки по продажам.',
  },
  {
    key: 'production',
    label: 'Производство',
    description: 'Доступ только к разделу производства.',
  },
  {
    key: 'warehouse_manager',
    label: 'Склад',
    description: 'Приёмка товара, хранение на складе, отгрузка клиентам.',
  },
  {
    key: 'observer',
    label: 'Наблюдатель',
    description: 'Просмотр всех разделов без права редактирования.',
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
    description: 'Просмотр списка заказов, создание и редактирование заказов.',
    group: 'Чапан',
  },
  {
    key: 'chapan_access_production',
    label: 'Чапан: Производство',
    description: 'Доступ к производственным задачам и ходу выполнения заказов.',
    group: 'Чапан',
  },
  {
    key: 'chapan_access_ready',
    label: 'Чапан: Готово',
    description: 'Работа с готовыми заказами, передачей и выдачей.',
    group: 'Чапан',
  },
  {
    key: 'chapan_access_archive',
    label: 'Чапан: Архив',
    description: 'Просмотр архивных заказов и возврат из архива.',
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
    description: 'Назначение исполнителей и управление этапами производства.',
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

const DEPARTMENT_SUGGESTIONS = [
  'Продажи',
  'Производство',
  'Бухгалтерия',
  'Финансы',
  'Маркетинг',
  'Логистика',
  'Закупки',
  'IT',
  'Юридический отдел',
  'HR',
  'Администрация',
  'Склад',
];

// ─── Компонент ───────────────────────────────────────────────────────────────

interface Props {
  loading?: boolean;
  onSubmit: (payload: CreateEmployeePayload) => void;
  onClose: () => void;
}

export function AddEmployeeModal({ loading, onSubmit, onClose }: Props) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [permissions, setPermissions] = useState<EmployeePermission[]>([]);
  const [error, setError] = useState('');

  function togglePermission(perm: EmployeePermission) {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
    setError('');
  }

  function handleSubmit() {
    setError('');

    if (!fullName.trim()) {
      setError('Введите ФИО сотрудника.');
      return;
    }
    if (!phone.trim() || !isKazakhPhoneComplete(phone)) {
      setError('Введите полный номер телефона в формате +7 (___) ___-__-__.');
      return;
    }
    if (!department.trim()) {
      setError('Укажите отдел сотрудника.');
      return;
    }
    if (permissions.length === 0) {
      setError('Назначьте хотя бы одно право доступа.');
      return;
    }

    const normalized = normalizeKazakhPhone(phone);
    if (!normalized) {
      setError('Не удалось нормализовать номер телефона.');
      return;
    }

    onSubmit({
      phone: normalized,
      full_name: fullName.trim(),
      department: department.trim(),
      permissions,
    });
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Добавить сотрудника">
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <UserRoundPlus size={18} />
            Добавить сотрудника
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

        {/* Body */}
        <div className={styles.modalBody}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              ФИО <span className={styles.required}>*</span>
            </label>
            <input
              className={styles.input}
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setError(''); }}
              placeholder="Иванов Иван Иванович"
              autoComplete="name"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Номер телефона <span className={styles.required}>*</span>
            </label>
            <input
              className={styles.input}
              value={phone}
              onChange={(e) => { setPhone(formatKazakhPhoneInput(e.target.value)); setError(''); }}
              placeholder="+7 (___) ___-__-__"
              inputMode="tel"
              autoComplete="tel"
            />
            <span className={styles.hint}>
              Этот номер будет использоваться как логин для первого входа.
            </span>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Отдел <span className={styles.required}>*</span>
            </label>
            <input
              className={styles.input}
              value={department}
              onChange={(e) => { setDepartment(e.target.value); setError(''); }}
              placeholder="Продажи"
              list="dept-suggestions"
              autoComplete="organization-title"
            />
            <datalist id="dept-suggestions">
              {DEPARTMENT_SUGGESTIONS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>

          <div className={styles.permGroup}>
            <label className={styles.label}>
              Права доступа <span className={styles.required}>*</span>
            </label>
            <div className={styles.permList}>
              {PERMISSION_OPTIONS.filter((opt) => !opt.group).map((opt) => {
                const checked = permissions.includes(opt.key);
                return (
                  <label key={opt.key} className={`${styles.permItem} ${checked ? styles.permItemChecked : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
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
                  <label key={opt.key} className={`${styles.permItem} ${checked ? styles.permItemChecked : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
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
          </div>

          {error && <div className={styles.error}>{error}</div>}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className={styles.submitBtn}
            disabled={loading}
            onClick={handleSubmit}
          >
            <UserRoundPlus size={15} />
            {loading ? 'Добавляем...' : 'Добавить сотрудника'}
          </button>
        </div>
      </div>
    </div>
  );
}
