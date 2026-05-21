import { useState } from 'react';
import { Plus, UserX, Key, Edit2, X, Trash2 } from 'lucide-react';
import { useViewportProfile } from '@/shared/hooks/useViewportProfile';
import { useEmployees, useCreateEmployee, useUpdateEmployee, useDismissEmployee, useResetPassword, useRemoveEmployee } from '@/entities/employee/queries';
import type { Employee, CreateEmployeeDto, PermissionOverride } from '@/entities/employee/types';
import { isKazakhPhoneComplete, normalizeKazakhPhone } from '@/shared/utils/kz';
import { PhoneInput } from '@/shared/ui/PhoneInput';
import { Skeleton } from '@/shared/ui/Skeleton';
import { RoleAccessFields } from '@/features/auth/RoleAccessFields';
import styles from './Employees.module.css';

const DEPT_PRESETS = ['Менеджмент', 'Продажи', 'Производство', 'Склад', 'Финансы', 'IT'];

// ── Add Employee Drawer ────────────────────────────────────────────────────────

function AddEmployeeDrawer({ onClose }: { onClose: () => void }) {
  const createEmployee = useCreateEmployee();
  const [form, setForm] = useState<CreateEmployeeDto>({
    phone: '', full_name: '', department: '', roleId: '', overrides: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.full_name.trim()) errs.full_name = 'Введите имя';
    if (!form.phone.trim()) errs.phone = 'Введите телефон';
    if (!isKazakhPhoneComplete(form.phone)) errs.phone = 'Введите полный номер: +7 (XXX) XXX-XX-XX';
    if (!form.department.trim()) errs.department = 'Введите отдел';
    if (!form.roleId) errs.role = 'Выберите роль';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    await createEmployee.mutateAsync({ ...form, phone: normalizeKazakhPhone(form.phone) ?? form.phone });
    onClose();
  }

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Добавить сотрудника</span>
          <button className={styles.drawerClose} onClick={onClose}><X size={16} /></button>
        </div>
        <form className={styles.drawerBody} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Имя <span className={styles.req}>*</span></label>
            <input className={`${styles.input} ${errors.full_name ? styles.inputErr : ''}`}
              value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Новый сотрудник" autoFocus />
            {errors.full_name && <span className={styles.errMsg}>{errors.full_name}</span>}
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Телефон <span className={styles.req}>*</span></label>
            <PhoneInput className={`${styles.input} ${errors.phone ? styles.inputErr : ''}`}
              value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            {errors.phone && <span className={styles.errMsg}>{errors.phone}</span>}
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Отдел <span className={styles.req}>*</span></label>
            <input className={`${styles.input} ${errors.department ? styles.inputErr : ''}`} list="dept-list"
              value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              placeholder="Продажи" />
            <datalist id="dept-list">{DEPT_PRESETS.map(d => <option key={d} value={d} />)}</datalist>
            {errors.department && <span className={styles.errMsg}>{errors.department}</span>}
          </div>
          <div className={styles.field}>
            <RoleAccessFields
              roleId={form.roleId}
              onRoleChange={(roleId) => setForm(f => ({ ...f, roleId }))}
              overrides={form.overrides ?? []}
              onOverridesChange={(overrides) => setForm(f => ({ ...f, overrides }))}
            />
            {errors.role && <span className={styles.errMsg}>{errors.role}</span>}
          </div>
          <div className={styles.drawerNote}>
            Система создаст учётную запись. Временный пароль будет показан после создания.
          </div>
          <div className={styles.drawerActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Отмена</button>
            <button type="submit" className={styles.submitBtn} disabled={createEmployee.isPending}>
              {createEmployee.isPending ? 'Создание...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Drawer ────────────────────────────────────────────────────────────────

function EditEmployeeDrawer({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const updateEmployee = useUpdateEmployee();
  const dismissEmployee = useDismissEmployee();
  const resetPassword = useResetPassword();
  const [roleId, setRoleId] = useState(employee.role_id ?? '');
  const [overrides, setOverrides] = useState<PermissionOverride[]>([...employee.overrides]);
  const [dept, setDept] = useState(employee.department);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const isDismissed = employee.status === 'dismissed';
  const dirty =
    roleId !== (employee.role_id ?? '') ||
    dept !== employee.department ||
    JSON.stringify(overrides) !== JSON.stringify(employee.overrides);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!roleId) return;
    try {
      await updateEmployee.mutateAsync({ id: employee.id, dto: { department: dept, roleId, overrides } });
      onClose();
    } catch {
      // error is shown via toast in useUpdateEmployee.onError
    }
  }

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <div className={styles.drawerAvatar}>{employee.full_name.charAt(0)}</div>
          <div className={styles.drawerHeaderInfo}>
            <span className={styles.drawerTitle}>{employee.full_name}</span>
            <span className={styles.drawerStatusText} style={{ color: isDismissed ? 'var(--fill-negative)' : 'var(--fill-positive, #22c55e)' }}>
              {isDismissed ? 'Деактивирован' : 'Активен'}
            </span>
          </div>
          <button className={styles.drawerClose} onClick={onClose}><X size={16} /></button>
        </div>
        <form className={styles.drawerBody} onSubmit={handleSave}>
          {/* Department */}
          <div className={styles.field}>
            <label className={styles.label}>Отдел</label>
            <input className={styles.input} list="dept-list2"
              value={dept} onChange={e => setDept(e.target.value)} />
            <datalist id="dept-list2">{DEPT_PRESETS.map(d => <option key={d} value={d} />)}</datalist>
          </div>

          {/* Role + overrides */}
          <div className={styles.field}>
            <RoleAccessFields
              roleId={roleId}
              onRoleChange={setRoleId}
              overrides={overrides}
              onOverridesChange={setOverrides}
              disabled={isDismissed}
            />
          </div>

          {/* Save */}
          {!isDismissed && (
            <div className={styles.drawerActions}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>Отмена</button>
              <button type="submit" className={styles.submitBtn} disabled={updateEmployee.isPending || !dirty || !roleId}>
                {updateEmployee.isPending ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          )}

          {/* Управление аккаунтом */}
          {!isDismissed && (
            <div className={styles.dangerZoneDrawer}>
              <div className={styles.dangerZoneLabel}>Управление аккаунтом</div>

              {!confirmReset ? (
                <button type="button" className={styles.dangerActionBtn} onClick={() => setConfirmReset(true)}>
                  <Key size={13} />Сбросить пароль
                </button>
              ) : (
                <div className={styles.confirmCard}>
                  <div className={styles.confirmCardText}>Сотрудник получит временный пароль и должен будет сменить его при следующем входе.</div>
                  <div className={styles.confirmCardBtns}>
                    <button type="button" className={styles.confirmCancelBtn} onClick={() => setConfirmReset(false)}>Отмена</button>
                    <button type="button" className={styles.confirmOkBtn} onClick={() => { resetPassword.mutate(employee.id); setConfirmReset(false); onClose(); }}>Сбросить</button>
                  </div>
                </div>
              )}

              {!confirmDismiss ? (
                <button type="button" className={`${styles.dangerActionBtn} ${styles.dangerActionBtnRed}`} onClick={() => setConfirmDismiss(true)}>
                  <UserX size={13} />Деактивировать сотрудника
                </button>
              ) : (
                <div className={`${styles.confirmCard} ${styles.confirmCardDanger}`}>
                  <div className={styles.confirmCardText}>Сотрудник <strong>{employee.full_name}</strong> потеряет доступ к системе. Данные сохранятся.</div>
                  <div className={styles.confirmCardBtns}>
                    <button type="button" className={styles.confirmCancelBtn} onClick={() => setConfirmDismiss(false)}>Отмена</button>
                    <button type="button" className={`${styles.confirmOkBtn} ${styles.confirmOkBtnDanger}`}
                      onClick={() => { dismissEmployee.mutate(employee.id); setConfirmDismiss(false); onClose(); }}>
                      Деактивировать
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// ── Role badge ──────────────────────────────────────────────────────────────────

function RoleBadge({ employee }: { employee: Employee }) {
  return (
    <div className={styles.permTags}>
      <span className={styles.permTag}>{employee.role_name ?? 'Без роли'}</span>
      {employee.overrides.length > 0 && (
        <span className={styles.permTag}>+{employee.overrides.length} правок</span>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { isPhone } = useViewportProfile();
  const { data, isLoading, isError } = useEmployees();
  const dismissEmployee = useDismissEmployee();
  const resetPassword = useResetPassword();
  const removeEmployee = useRemoveEmployee();
  const [addOpen, setAddOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);

  const employees = data?.results ?? [];
  const active = employees.filter(e => e.status === 'active');
  const dismissed = employees.filter(e => e.status === 'dismissed');

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Сотрудники</h1>
        <div className={styles.headerRight}>
          <button className={styles.addBtn} onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Добавить
          </button>
        </div>
      </div>

      {isLoading && (
        <div className={styles.skeletons}>{[...Array(5)].map((_,i) => <Skeleton key={i} height={60} radius={8} />)}</div>
      )}
      {isError && <div className={styles.error}>Не удалось загрузить сотрудников</div>}

      {!isLoading && !isError && isPhone && (
        <div className={styles.mobileList}>
          {active.map(emp => (
            <div key={emp.id} className={styles.mobileCard}>
              <div className={styles.mobileCardHead}>
                <div>
                  <strong>{emp.full_name}</strong>
                  {emp.isPendingFirstLogin && (
                    <span className={styles.pendingBadge}>Не входил(а)</span>
                  )}
                </div>
                <div className={styles.mobileCardActions}>
                  <button className={styles.iconBtn} onClick={() => setEditEmployee(emp)} title="Редактировать"><Edit2 size={13} /></button>
                  <button className={styles.iconBtn} onClick={() => resetPassword.mutate(emp.id)} title="Сбросить пароль"><Key size={13} /></button>
                  <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title="Деактивировать"
                    onClick={() => { if (confirm(`Деактивировать ${emp.full_name}?`)) dismissEmployee.mutate(emp.id); }}>
                    <UserX size={13} />
                  </button>
                </div>
              </div>
              <div className={styles.mobileCardMeta}>
                {emp.department && <span>{emp.department}</span>}
                {emp.phone && <span className={styles.tdMono}>{emp.phone}</span>}
              </div>
              <RoleBadge employee={emp} />
            </div>
          ))}
          {active.length === 0 && (
            <div className={styles.empty}>
              <p>Сотрудников пока нет</p>
              <button className={styles.emptyBtn} onClick={() => setAddOpen(true)}>Добавить первого сотрудника</button>
            </div>
          )}
          {dismissed.length > 0 && (
            <>
              <div className={styles.sectionLabel}>Деактивированные</div>
              {dismissed.map(emp => (
                <div key={emp.id} className={`${styles.mobileCard} ${styles.mobileCardDismissed}`}>
                  <div className={styles.mobileCardHead}>
                    <strong>{emp.full_name}</strong>
                    <div className={styles.mobileCardActions}>
                      <span className={styles.dismissedBadge}>Деактивирован</span>
                      <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title="Удалить"
                        onClick={() => { if (confirm(`Удалить ${emp.full_name}?`)) removeEmployee.mutate(emp.id); }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  {emp.department && <div className={styles.mobileCardMeta}><span>{emp.department}</span></div>}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {!isLoading && !isError && !isPhone && (
        <>
          <div className={styles.tableWrap}>
            {active.length > 0 && (
              <table className={styles.table}>
                <thead>
                  <tr><th>Сотрудник</th><th>Телефон</th><th>Отдел</th><th>Роль</th><th>Добавлен</th><th></th></tr>
                </thead>
                <tbody>
                  {active.map(emp => (
                    <tr key={emp.id} className={styles.row}>
                      <td>
                        <div className={styles.empName}>
                          {emp.full_name}
                          {emp.isPendingFirstLogin && (
                            <span className={styles.pendingBadge}>Не входил(а)</span>
                          )}
                        </div>
                      </td>
                      <td className={styles.tdMono}>{emp.phone ?? '—'}</td>
                      <td className={styles.tdSecondary}>{emp.department}</td>
                      <td><RoleBadge employee={emp} /></td>
                      <td className={styles.tdDate}>
                        {new Date(emp.joinedAt).toLocaleDateString('ru-KZ')}
                      </td>
                      <td className={styles.tdActions}>
                        <button className={styles.iconBtn} title="Редактировать" onClick={() => setEditEmployee(emp)}>
                          <Edit2 size={13} />
                        </button>
                        <button className={styles.iconBtn} title="Сбросить пароль" onClick={() => resetPassword.mutate(emp.id)}>
                          <Key size={13} />
                        </button>
                        <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title="Деактивировать"
                          onClick={() => { if (confirm(`Деактивировать ${emp.full_name}?`)) dismissEmployee.mutate(emp.id); }}>
                          <UserX size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {active.length === 0 && (
              <div className={styles.empty}>
                <p>Сотрудников пока нет</p>
                <button className={styles.emptyBtn} onClick={() => setAddOpen(true)}>Добавить первого сотрудника</button>
              </div>
            )}

            {dismissed.length > 0 && (
              <>
                <div className={styles.sectionLabel}>Деактивированные</div>
                <table className={styles.table}>
                  <tbody>
                    {dismissed.map(emp => (
                      <tr key={emp.id} className={`${styles.row} ${styles.rowDismissed}`}>
                        <td><div className={styles.empName}>{emp.full_name}</div></td>
                        <td className={styles.tdMono}>{emp.phone ?? '—'}</td>
                        <td className={styles.tdSecondary}>{emp.department}</td>
                        <td colSpan={2}><span className={styles.dismissedBadge}>Деактивирован</span></td>
                        <td className={styles.tdActions}>
                          <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title="Удалить"
                            onClick={() => { if (confirm(`Удалить ${emp.full_name}?`)) removeEmployee.mutate(emp.id); }}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </>
      )}

      {addOpen && <AddEmployeeDrawer onClose={() => setAddOpen(false)} />}
      {editEmployee && <EditEmployeeDrawer key={editEmployee.id} employee={editEmployee} onClose={() => setEditEmployee(null)} />}
    </div>
  );
}
