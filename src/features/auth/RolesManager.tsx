import { useState } from 'react';
import { Plus, X, Pencil, Trash2, ShieldCheck, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole } from '@/entities/role/queries';
import {
  COMPANY_ADMIN_PERMISSION,
  type DataScope,
  type Permission,
  type Role,
} from '@/entities/employee/types';
import { PERMISSION_GROUPS } from './employeePermissionOptions';
import styles from './RolesManager.module.css';

// ── Role editor drawer ───────────────────────────────────────────────────────

function RoleEditorDrawer({ role, onClose }: { role: Role | 'new'; onClose: () => void }) {
  const isNew = role === 'new';
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

  const [name, setName] = useState(isNew ? '' : role.name);
  const [description, setDescription] = useState(isNew ? '' : role.description);
  const [permissions, setPermissions] = useState<Permission[]>(
    isNew ? [] : [...role.permissions],
  );
  const [dataScope, setDataScope] = useState<DataScope>(isNew ? 'all' : role.data_scope);
  const [error, setError] = useState('');

  const grantsAll = permissions.includes(COMPANY_ADMIN_PERMISSION);
  const saving = createRole.isPending || updateRole.isPending;

  function toggle(perm: Permission) {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Введите название роли.');
      return;
    }
    if (permissions.length === 0) {
      setError('Выберите хотя бы одно право.');
      return;
    }
    try {
      if (isNew) {
        await createRole.mutateAsync({ name: name.trim(), description: description.trim(), permissions, dataScope });
      } else {
        await updateRole.mutateAsync({ id: role.id, name: name.trim(), description: description.trim(), permissions, dataScope });
      }
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Не удалось сохранить роль.');
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>
            {isNew ? 'Новая роль' : `Роль: ${role.name}`}
          </span>
          <button type="button" className={styles.iconClose} onClick={onClose} aria-label="Закрыть">
            <X size={16} />
          </button>
        </div>

        <form className={styles.drawerBody} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Название <span className={styles.req}>*</span></label>
            <input
              className="kort-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Старший менеджер"
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Описание</label>
            <input
              className="kort-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Кратко: что делает эта роль"
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Область данных</span>
            <div className={styles.scopeRow}>
              {([
                { value: 'all', title: 'Все данные компании', desc: 'Видит записи всех сотрудников.' },
                { value: 'own', title: 'Только свои', desc: 'Видит только свои заказы, лиды, сделки и задачи.' },
              ] as Array<{ value: DataScope; title: string; desc: string }>).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.scopeOption} ${dataScope === opt.value ? styles.scopeOptionActive : ''}`}
                  onClick={() => setDataScope(opt.value)}
                >
                  <span className={styles.scopeOptionTitle}>{opt.title}</span>
                  <span className={styles.scopeOptionDesc}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Права роли <span className={styles.req}>*</span></span>

            <label
              className={`${styles.permItem} ${grantsAll ? styles.permItemChecked : ''}`}
            >
              <input
                type="checkbox"
                checked={grantsAll}
                onChange={() => toggle(COMPANY_ADMIN_PERMISSION)}
              />
              <div>
                <span className={styles.permLabel}>Администратор компании</span>
                <span className={styles.permDesc}>
                  Полный доступ ко всем разделам и управлению сотрудниками.
                </span>
              </div>
            </label>

            {!grantsAll &&
              PERMISSION_GROUPS.map((group) => (
                <div key={group.module} className={styles.permGroup}>
                  <div className={styles.permGroupLabel}>{group.label}</div>
                  <div className={styles.permGroupItems}>
                    {group.actions.map((action) => {
                      const checked = permissions.includes(action.key);
                      return (
                        <label
                          key={action.key}
                          className={`${styles.permChip} ${checked ? styles.permChipChecked : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(action.key)}
                          />
                          {action.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

            {grantsAll && (
              <p className={styles.adminNote}>
                Право «Администратор компании» уже включает все остальные права.
              </p>
            )}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.drawerActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? 'Сохранение...' : isNew ? 'Создать роль' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Role card ────────────────────────────────────────────────────────────────

function RoleCard({
  role,
  onEdit,
  onDelete,
}: {
  role: Role;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const grantsAll = role.permissions.includes(COMPANY_ADMIN_PERMISSION);
  return (
    <div className={styles.card}>
      <div className={styles.cardIcon}>
        {role.is_system ? <Lock size={15} /> : <ShieldCheck size={15} />}
      </div>
      <div className={styles.cardInfo}>
        <div className={styles.cardName}>
          {role.name}
          <span className={`${styles.scopeBadge} ${role.is_system ? styles.scopeSystem : styles.scopeCustom}`}>
            {role.is_system ? 'Системная' : 'Своя'}
          </span>
        </div>
        {role.description && <div className={styles.cardDesc}>{role.description}</div>}
        <div className={styles.cardMeta}>
          {grantsAll ? 'Полный доступ' : `${role.permissions.length} прав`}
          {' · '}
          {role.data_scope === 'own' ? 'свои данные' : 'все данные'}
        </div>
      </div>
      {!role.is_system && (
        <div className={styles.cardActions}>
          <button type="button" className={styles.cardBtn} title="Редактировать" onClick={onEdit}>
            <Pencil size={13} />
          </button>
          <button
            type="button"
            className={`${styles.cardBtn} ${styles.cardBtnDanger}`}
            title="Удалить"
            onClick={onDelete}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function RolesManager() {
  const { data, isLoading } = useRoles();
  const deleteRole = useDeleteRole();
  const [editing, setEditing] = useState<Role | 'new' | null>(null);

  const roles = data?.results ?? [];
  const systemRoles = roles.filter((r) => r.is_system);
  const customRoles = roles.filter((r) => !r.is_system);

  async function handleDelete(role: Role) {
    if (!confirm(`Удалить роль «${role.name}»? Если роль назначена сотрудникам, удаление будет отклонено.`)) {
      return;
    }
    try {
      await deleteRole.mutateAsync(role.id);
      toast.success('Роль удалена');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Не удалось удалить роль');
    }
  }

  return (
    <>
      <div className={styles.header}>
        <div>
          <div className={styles.headerTitle}>Роли компании</div>
          <div className={styles.headerSubtitle}>
            Роль — это набор прав. Назначайте роли сотрудникам вместо отдельных прав.
          </div>
        </div>
        <button type="button" className={styles.addBtn} onClick={() => setEditing('new')}>
          <Plus size={14} /> Новая роль
        </button>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Загрузка ролей…</div>
      ) : (
        <>
          {customRoles.length > 0 && (
            <div className={styles.group}>
              <div className={styles.groupLabel}>Роли компании</div>
              <div className={styles.list}>
                {customRoles.map((role) => (
                  <RoleCard
                    key={role.id}
                    role={role}
                    onEdit={() => setEditing(role)}
                    onDelete={() => handleDelete(role)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className={styles.group}>
            <div className={styles.groupLabel}>Системные роли</div>
            <div className={styles.list}>
              {systemRoles.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  onEdit={() => undefined}
                  onDelete={() => undefined}
                />
              ))}
            </div>
          </div>

          {customRoles.length === 0 && (
            <p className={styles.emptyHint}>
              Системных ролей достаточно для большинства команд. Создайте свою роль,
              если нужен особый набор прав.
            </p>
          )}
        </>
      )}

      {editing && <RoleEditorDrawer role={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
