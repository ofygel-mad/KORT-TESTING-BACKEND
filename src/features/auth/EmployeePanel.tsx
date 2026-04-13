import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRoundPlus, Users, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../shared/api/client';
import { useRole } from '../../shared/hooks/useRole';
import type {
  CreateEmployeePayload,
  EmployeeRecord,
  UpdateEmployeePayload,
} from '../../shared/api/contracts';
import { AddEmployeeModal } from './AddEmployeeModal';
import { EmployeeDetailModal } from './EmployeeDetailModal';
import styles from './EmployeePanel.module.css';

type EmployeeListResponse =
  | EmployeeRecord[]
  | {
      count?: number;
      results?: EmployeeRecord[];
    };

function normalizeEmployees(payload: EmployeeListResponse | null | undefined) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  return [];
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_META: Record<
  EmployeeRecord['account_status'],
  { label: string; cls: string }
> = {
  active: { label: 'Активен', cls: styles.statusActive },
  pending_first_login: { label: 'Первый вход', cls: styles.statusPending },
  dismissed: { label: 'Уволен', cls: styles.statusDismissed },
};

// ─── EmployeeCard ────────────────────────────────────────────────────────────

function EmployeeCard({
  employee,
  onClick,
}: {
  employee: EmployeeRecord;
  onClick: () => void;
}) {
  const meta = STATUS_META[employee.account_status] ?? STATUS_META.active;
  const permCount = employee.permissions?.length ?? 0;

  return (
    <button type="button" className={styles.card} onClick={onClick}>
      <div className={styles.cardAvatar}>
        {employee.full_name.charAt(0).toUpperCase()}
      </div>
      <div className={styles.cardInfo}>
        <div className={styles.cardName}>{employee.full_name}</div>
        <div className={styles.cardMeta}>
          {employee.phone} · {employee.department}
        </div>
      </div>
      <div className={styles.cardRight}>
        <span className={`${styles.statusBadge} ${meta.cls}`}>{meta.label}</span>
        <span className={styles.permCount}>
          {permCount === 0
            ? 'Без прав'
            : `${permCount} ${permCount === 1 ? 'право' : permCount < 5 ? 'права' : 'прав'}`}
        </span>
      </div>
    </button>
  );
}

// ─── EmployeePanel ───────────────────────────────────────────────────────────

export function EmployeePanel() {
  const queryClient = useQueryClient();
  const { isAdmin } = useRole();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);
  const [search, setSearch] = useState('');

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery<EmployeeListResponse>({
    queryKey: ['company/employees'],
    queryFn: () => api.get('/company/employees/'),
    enabled: isAdmin,
  });

  const employees = normalizeEmployees(data);

  // Filter by search (client-side filtering по ФИО, телефону, отделу)
  const filtered = search.trim().length < 2
    ? employees
    : employees.filter((e) => {
        const q = search.toLowerCase();
        return (
          e.full_name.toLowerCase().includes(q) ||
          e.phone.includes(q) ||
          e.department.toLowerCase().includes(q)
        );
      });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: (payload: CreateEmployeePayload) =>
      api.post<EmployeeRecord>('/company/employees/', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company/employees'] });
      toast.success('Сотрудник добавлен. Он может войти через номер телефона.');
      setShowAddModal(false);
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Не удалось добавить сотрудника.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateEmployeePayload) =>
      api.patch<EmployeeRecord>(`/company/employees/${id}/`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company/employees'] });
      toast.success('Данные сотрудника обновлены.');
      // Обновляем selectedEmployee свежими данными из кеша
      setSelectedEmployee((prev) => {
        if (!prev) return prev;
        const fresh = normalizeEmployees(
          queryClient.getQueryData<EmployeeListResponse>(['company/employees']),
        );
        return fresh.find((e) => e.id === prev.id) ?? prev;
      });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Не удалось обновить данные.');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/company/employees/${id}/reset-password/`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['company/employees'] });
      toast.success('Пароль сброшен. Сотрудник войдёт через номер телефона.');
      // Сразу обновляем статус в открытой модалке
      setSelectedEmployee((prev) =>
        prev?.id === id ? { ...prev, account_status: 'pending_first_login' } : prev,
      );
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Не удалось сбросить пароль.');
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/company/employees/${id}/dismiss/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company/employees'] });
      toast.success('Сотрудник уволен. Доступ к аккаунту заблокирован.');
      setSelectedEmployee(null);
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Не удалось уволить сотрудника.');
    },
  });

  const isMutating =
    addMutation.isPending ||
    updateMutation.isPending ||
    resetPasswordMutation.isPending ||
    dismissMutation.isPending;

  // ── Render ────────────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className={styles.accessDenied}>
        <Users size={20} />
        <div>
          <div className={styles.accessDeniedTitle}>Нет доступа</div>
          <div className={styles.accessDeniedText}>
            Управление сотрудниками доступно только администраторам и руководителю.
          </div>
        </div>
      </div>
    );
  }

  const activeCount = employees.filter((e) => e.account_status === 'active').length;
  const pendingCount = employees.filter((e) => e.account_status === 'pending_first_login').length;
  const dismissedCount = employees.filter((e) => e.account_status === 'dismissed').length;

  return (
    <>
      <div className={styles.panel}>
        {/* ── Header ── */}
        <div className={styles.panelHeader}>
          <div className={styles.panelMeta}>
            <div className={styles.panelTitle}>Сотрудники</div>
            <div className={styles.panelStats}>
              {employees.length > 0 && (
                <>
                  <span className={styles.statChip + ' ' + styles.statActive}>{activeCount} активных</span>
                  {pendingCount > 0 && (
                    <span className={styles.statChip + ' ' + styles.statPending}>{pendingCount} ожидают</span>
                  )}
                  {dismissedCount > 0 && (
                    <span className={styles.statChip + ' ' + styles.statDismissed}>{dismissedCount} уволено</span>
                  )}
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setShowAddModal(true)}
          >
            <UserRoundPlus size={15} />
            Добавить сотрудника
          </button>
        </div>

        {/* ── Search ── */}
        {employees.length >= 5 && (
          <div className={styles.searchRow}>
            <Search size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени, телефону или отделу..."
            />
          </div>
        )}

        {/* ── List ── */}
        <div className={styles.list}>
          {isLoading && (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard} />
            ))
          )}

          {!isLoading && filtered.length === 0 && employees.length === 0 && (
            <div className={styles.emptyState}>
              <Users size={22} />
              <div>
                <div className={styles.emptyTitle}>Сотрудников пока нет</div>
                <div className={styles.emptyText}>
                  Нажмите «Добавить сотрудника», чтобы начать.
                </div>
              </div>
            </div>
          )}

          {!isLoading && filtered.length === 0 && employees.length > 0 && (
            <div className={styles.emptyState}>
              <Search size={20} />
              <div className={styles.emptyTitle}>Ничего не найдено</div>
            </div>
          )}

          {filtered.map((employee) => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              onClick={() => setSelectedEmployee(employee)}
            />
          ))}
        </div>
      </div>

      {/* ── Add modal ── */}
      {showAddModal && (
        <AddEmployeeModal
          loading={addMutation.isPending}
          onSubmit={(payload) => addMutation.mutate(payload)}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* ── Detail modal ── */}
      {selectedEmployee && (
        <EmployeeDetailModal
          employee={selectedEmployee}
          canEdit={isAdmin}
          loading={isMutating}
          onUpdate={(id, payload) => updateMutation.mutate({ id, ...payload })}
          onResetPassword={(id) => resetPasswordMutation.mutate(id)}
          onDismiss={(id) => dismissMutation.mutate(id)}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </>
  );
}
