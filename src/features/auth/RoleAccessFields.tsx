import { useMemo, useState } from 'react';
import { ChevronDown, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useRoles } from '@/entities/role/queries';
import {
  PERMISSION_MATRIX,
  COMPANY_ADMIN_PERMISSION,
  type Permission,
  type PermissionEffect,
  type PermissionOverride,
} from '@/entities/employee/types';
import styles from './RoleAccessFields.module.css';

type EffectChoice = 'inherit' | PermissionEffect;

interface Props {
  roleId: string;
  onRoleChange: (roleId: string) => void;
  overrides: PermissionOverride[];
  onOverridesChange: (next: PermissionOverride[]) => void;
  disabled?: boolean;
  /** Hide the override matrix entirely (e.g. the Add form keeps it simple). */
  hideOverrides?: boolean;
}

/** Every assignable permission except the company-admin meta-permission. */
const OVERRIDABLE: Array<{ module: string; label: string; key: Permission; action: string }> =
  PERMISSION_MATRIX.flatMap((row) =>
    [
      row.read ? { key: row.read, action: 'Просмотр' } : null,
      row.write ? { key: row.write, action: 'Изменение' } : null,
      row.admin ? { key: row.admin, action: row.adminLabel ?? 'Администрирование' } : null,
    ]
      .filter((a): a is { key: Permission; action: string } => a !== null)
      .map((a) => ({ module: row.module, label: row.label, ...a })),
  );

/**
 * Role dropdown + collapsible per-permission override matrix.
 * Shared by the "Add employee" and "Edit employee" drawers.
 */
export function RoleAccessFields({
  roleId,
  onRoleChange,
  overrides,
  onOverridesChange,
  disabled = false,
  hideOverrides = false,
}: Props) {
  const { data: rolesData, isLoading } = useRoles();
  const roles = rolesData?.results ?? [];
  const selectedRole = roles.find((r) => r.id === roleId) ?? null;
  const [expanded, setExpanded] = useState(false);

  const roleGrantsAll = useMemo(
    () => Boolean(selectedRole?.permissions.includes(COMPANY_ADMIN_PERMISSION)),
    [selectedRole],
  );
  const rolePerms = useMemo(
    () => new Set(selectedRole?.permissions ?? []),
    [selectedRole],
  );

  function choiceOf(perm: Permission): EffectChoice {
    return overrides.find((o) => o.permission === perm)?.effect ?? 'inherit';
  }

  function setChoice(perm: Permission, choice: EffectChoice) {
    const without = overrides.filter((o) => o.permission !== perm);
    onOverridesChange(
      choice === 'inherit' ? without : [...without, { permission: perm, effect: choice }],
    );
  }

  // Group overridable permissions by module for rendering.
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: typeof OVERRIDABLE }>();
    for (const item of OVERRIDABLE) {
      const g = map.get(item.module) ?? { label: item.label, items: [] };
      g.items.push(item);
      map.set(item.module, g);
    }
    return [...map.values()];
  }, []);

  const overrideCount = overrides.length;

  return (
    <div className={styles.root}>
      {/* ── Role selector ── */}
      <div className={styles.field}>
        <label className={styles.label}>
          <ShieldCheck size={13} />
          Роль <span className={styles.req}>*</span>
        </label>
        <select
          className={`kort-input ${styles.select}`}
          aria-label="Роль сотрудника"
          value={roleId}
          disabled={disabled || isLoading}
          onChange={(e) => onRoleChange(e.target.value)}
        >
          <option value="">— Выберите роль —</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
              {role.is_system ? '' : ' (своя)'}
            </option>
          ))}
        </select>
        {selectedRole && (
          <span className={styles.roleDesc}>
            {selectedRole.description || 'Без описания.'}
            {roleGrantsAll
              ? ' Полный доступ ко всем разделам компании.'
              : ` Прав в роли: ${selectedRole.permissions.length}.`}
          </span>
        )}
      </div>

      {/* ── Override matrix ── */}
      {!hideOverrides && selectedRole && !roleGrantsAll && (
        <div className={styles.overrideBlock}>
          <button
            type="button"
            className={styles.overrideToggle}
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <SlidersHorizontal size={13} />
            <span>Точечная настройка прав</span>
            {overrideCount > 0 && (
              <span className={styles.overrideBadge}>{overrideCount}</span>
            )}
            <ChevronDown
              size={14}
              className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
            />
          </button>

          {expanded && (
            <div className={styles.overrideBody}>
              <p className={styles.overrideHint}>
                Поверх роли можно точечно разрешить или запретить отдельные права
                конкретному сотруднику.
              </p>
              {groups.map((group) => (
                <div key={group.label} className={styles.overrideGroup}>
                  <div className={styles.overrideGroupLabel}>{group.label}</div>
                  {group.items.map((item) => {
                    const choice = choiceOf(item.key);
                    const fromRole = rolePerms.has(item.key);
                    const effective =
                      choice === 'inherit' ? fromRole : choice === 'allow';
                    return (
                      <div key={item.key} className={styles.overrideRow}>
                        <div className={styles.overrideRowInfo}>
                          <span className={styles.overrideRowLabel}>{item.action}</span>
                          <span
                            className={`${styles.effectDot} ${
                              effective ? styles.effectOn : styles.effectOff
                            }`}
                          >
                            {effective ? 'доступно' : 'нет доступа'}
                          </span>
                        </div>
                        <div className={styles.segmented}>
                          {(['inherit', 'allow', 'deny'] as EffectChoice[]).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              disabled={disabled}
                              className={`${styles.segBtn} ${
                                choice === opt ? styles.segBtnActive : ''
                              } ${opt === 'allow' ? styles.segAllow : ''} ${
                                opt === 'deny' ? styles.segDeny : ''
                              }`}
                              onClick={() => setChoice(item.key, opt)}
                            >
                              {opt === 'inherit'
                                ? `По роли (${fromRole ? 'есть' : 'нет'})`
                                : opt === 'allow'
                                  ? 'Разрешить'
                                  : 'Запретить'}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!hideOverrides && roleGrantsAll && (
        <p className={styles.adminNote}>
          Эта роль даёт полный доступ — точечные настройки прав не применяются.
        </p>
      )}
    </div>
  );
}
