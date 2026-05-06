import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  BarChart2,
  CheckCircle2,
  Copy,
  Send,
  Settings2,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../../shared/api/client';
import type { InviteRecord, MembershipRequestRecord, TeamMemberResponse } from '../../shared/api/contracts';
import { useCapabilities } from '../../shared/hooks/useCapabilities';
import { useRole } from '../../shared/hooks/useRole';
import { useTabsKeyboardNav } from '../../shared/hooks/useTabsKeyboardNav';
import { copyToClipboard, reloadWindow } from '../../shared/lib/browser';
import { useAuthStore } from '../../shared/stores/auth';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Skeleton } from '../../shared/ui/Skeleton';
import styles from './Admin.module.css';

type Tab = 'overview' | 'team' | 'requests' | 'settings';

interface DashboardStats {
  customers_count: number;
  active_deals_count: number;
  revenue_month: number;
  tasks_today: number;
  overdue_tasks: number;
}

type StatToneClass = 'statToneInfo' | 'statTonePositive' | 'statToneWarning' | 'statToneViolet';
type PlanToneClass = 'planToneInfo' | 'planToneWarning' | 'planToneViolet';

const MODE_LABELS: Record<string, string> = {
  basic: 'Базовый',
  advanced: 'Продвинутый',
  industrial: 'Промышленный',
};

const MODE_OPTIONS: Array<{
  key: 'basic' | 'advanced' | 'industrial';
  title: string;
  eyebrow: string;
  description: string;
  toneClass: PlanToneClass;
  features: string[];
}> = [
  {
    key: 'basic',
    title: 'Базовый',
    eyebrow: 'Core workspace',
    description: 'Стартовый рабочий контур для продаж, клиентов и базового доступа.',
    toneClass: 'planToneInfo',
    features: [
      'Единая база клиентов и сделок',
      'Стандартные роли команды',
      'Чистый onboarding для новых сотрудников',
    ],
  },
  {
    key: 'advanced',
    title: 'Продвинутый',
    eyebrow: 'Team operations',
    description: 'Режим для команды, которая уже живёт в инвайтах, заявках и ролях.',
    toneClass: 'planToneWarning',
    features: [
      'Реферальные ссылки и управление membership',
      'Гибкое распределение ролей внутри команды',
      'Подготовленный слой под backend-правила',
    ],
  },
  {
    key: 'industrial',
    title: 'Промышленный',
    eyebrow: 'Scale and governance',
    description: 'Тяжёлый контур для масштабирования, сложных процессов и глубоких сценариев.',
    toneClass: 'planToneViolet',
    features: [
      'Длинные операционные цепочки и модули',
      'Строгая модель прав и внутренних ролей',
      'Готовность к масштабу и расширению стека',
    ],
  },
];

export default function AdminPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const params = useParams<{ section?: string }>();
  const { isOwner } = useRole();
  const { canManageBilling } = useCapabilities();
  const org = useAuthStore((state) => state.org);
  const [inviteRole, setInviteRole] = useState('manager');

  const statsQuery = useQuery<DashboardStats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/reports/dashboard/'),
  });
  const teamQuery = useQuery<{ results: TeamMemberResponse[]; count: number }>({
    queryKey: ['team'],
    queryFn: () => api.get('/users/team/'),
  });
  const requestsQuery = useQuery<{ results: MembershipRequestRecord[] }>({
    queryKey: ['admin-membership-requests'],
    queryFn: () => api.get('/admin/membership-requests/'),
  });
  const invitesQuery = useQuery<{ results: InviteRecord[] }>({
    queryKey: ['admin-invites'],
    queryFn: () => api.get('/admin/invites/'),
  });

  const createInvite = useMutation({
    mutationFn: () => api.post<InviteRecord>('/admin/invites/', { role: inviteRole, kind: 'referral' }),
    onSuccess: (invite) => {
      queryClient.invalidateQueries({ queryKey: ['admin-invites'] });
      toast.success(`Ссылка для роли ${invite.role} создана`);
    },
  });

  const approveRequest = useMutation({
    mutationFn: (requestId: string) => api.post(`/admin/membership-requests/${requestId}/approve/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-membership-requests'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Заявка подтверждена');
    },
  });

  const rejectRequest = useMutation({
    mutationFn: (requestId: string) => api.post(`/admin/membership-requests/${requestId}/reject/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-membership-requests'] });
      toast.success('Заявка отклонена');
    },
  });

  const setRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => api.patch(`/users/${userId}/role/`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Роль обновлена');
    },
  });

  const toggleUserStatus = useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) => api.post(`/users/${userId}/${active ? 'deactivate' : 'activate'}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Статус сотрудника обновлён');
    },
  });

  const upgradeMode = useMutation({
    mutationFn: (mode: string) => api.patch('/organization/', { mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast.success('Режим компании обновлён');
      reloadWindow();
    },
  });

  const tabs = useMemo(
    () => [
      { key: 'overview' as const, label: 'Обзор', icon: <BarChart2 size={15} /> },
      { key: 'team' as const, label: 'Команда', icon: <Users size={15} /> },
      { key: 'requests' as const, label: 'Заявки', icon: <Activity size={15} /> },
      { key: 'settings' as const, label: 'Режим', icon: <Settings2 size={15} /> },
    ],
    [],
  );

  const requestedTab = (params.section as Tab | undefined) ?? 'overview';
  const activeTab = tabs.some((tab) => tab.key === requestedTab) ? requestedTab : 'overview';
  const tabKeys = tabs.map((tab) => tab.key);
  const onTabKeyDown = useTabsKeyboardNav(tabKeys, activeTab, (next) => navigate(next === 'overview' ? '/admin' : `/admin/${next}`));

  const recentInvite = invitesQuery.data?.results?.[0] ?? null;
  const requests = requestsQuery.data?.results ?? [];
  const team = teamQuery.data?.results ?? [];

  const overviewCards: Array<{
    label: string;
    value: number | undefined;
    icon: JSX.Element;
    toneClass: StatToneClass;
  }> = [
    { label: 'Клиентов', value: statsQuery.data?.customers_count, icon: <Users size={20} />, toneClass: 'statToneInfo' },
    { label: 'Активных сделок', value: statsQuery.data?.active_deals_count, icon: <TrendingUp size={20} />, toneClass: 'statTonePositive' },
    { label: 'Задач сегодня', value: statsQuery.data?.tasks_today, icon: <UserCheck size={20} />, toneClass: 'statToneWarning' },
    { label: 'Просрочено', value: statsQuery.data?.overdue_tasks, icon: <Activity size={20} />, toneClass: 'statToneViolet' },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Панель управления"
        subtitle={`Организация: ${org?.name ?? '—'} • Режим: ${MODE_LABELS[org?.mode ?? 'basic']}`}
      />

      <div className={styles.tabs} role="tablist" aria-label="Разделы панели" onKeyDown={onTabKeyDown}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tabButton} ${activeTab === tab.key ? styles.active : ''}`}
            onClick={() => navigate(tab.key === 'overview' ? '/admin' : `/admin/${tab.key}`)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.tabPanel}>
            <div className={styles.panelGrid}>
              {overviewCards.map((card) => (
                <div key={card.label} className={`${styles.statCard} ${styles[card.toneClass]}`}>
                  <div className={styles.statIcon}>{card.icon}</div>
                  <div className={styles.statValue}>
                    {statsQuery.isLoading ? <Skeleton height={28} width={60} /> : (card.value ?? '—')}
                  </div>
                  <div className={styles.statLabel}>{card.label}</div>
                </div>
              ))}
            </div>

            <div className={styles.surfaceCard}>
              <h3 className={styles.surfaceTitle}>Как теперь устроен доступ</h3>
              <div className={styles.helperText}>
                Владелец бизнеса работает как owner/admin уже с активной компанией.
                Сотрудники подключаются через заявку или инвайт, а доступ к внутреннему контуру открывается
                только после активного membership. Этот экран даёт owner-слой без лишней навигационной шумихи.
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'team' && (
          <motion.div key="team" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.tabPanel}>
            <div className={styles.teamHeader}>
              <span className={styles.memberCount}>{team.length} сотрудников</span>
            </div>

            <div className={styles.inviteWrap}>
              <div className={styles.inviteCard}>
                <div className={styles.inviteMeta}>
                  <div className={styles.inviteTitle}>Реферальная ссылка команды</div>
                  <div className={styles.inviteSubtitle}>
                    Выберите роль и создайте управляемую ссылку для быстрого подключения сотрудника.
                  </div>
                </div>

                <div className={styles.inviteForm}>
                  <select className={styles.inviteSelect} value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                    <option value="admin">Администратор</option>
                    <option value="manager">Менеджер</option>
                    <option value="viewer">Наблюдатель</option>
                  </select>
                  <Button size="sm" loading={createInvite.isPending} icon={<Send size={13} />} onClick={() => createInvite.mutate()}>
                    Создать ссылку
                  </Button>
                </div>

                {recentInvite && (
                  <div className={`${styles.inviteForm} ${styles.inviteFormSecondary}`}>
                    <input className={`kort-input ${styles.inviteLinkField}`} value={recentInvite.share_url} readOnly />
                    <Button
                      size="sm"
                      icon={<Copy size={13} />}
                      onClick={async () => {
                        const copied = await copyToClipboard(recentInvite.share_url);
                        toast[copied ? 'success' : 'error'](copied ? 'Ссылка скопирована' : 'Не удалось скопировать ссылку');
                      }}
                    >
                      Копировать
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.teamCard}>
              {teamQuery.isLoading
                ? [1, 2, 3].map((item) => (
                  <div key={item} className={styles.skeletonRow}>
                    <Skeleton height={16} width="70%" />
                  </div>
                ))
                : team.map((member) => (
                  <div key={member.id} className={styles.memberRow}>
                    <div className={styles.memberIdentity}>
                      <div className={styles.memberAvatar}>{member.full_name.charAt(0)}</div>
                      <div>
                        <div className={styles.memberName}>{member.full_name}</div>
                        <div className={styles.memberEmail}>{member.email}</div>
                      </div>
                    </div>
                    <div className={styles.memberActions}>
                      <Badge
                        bg={member.status === 'active' ? 'var(--fill-positive-soft)' : 'var(--bg-surface-inset)'}
                        color={member.status === 'active' ? 'var(--fill-positive-text)' : 'var(--text-secondary)'}
                      >
                        {member.status}
                      </Badge>
                      {member.role === 'owner' ? (
                        <span className={styles.memberCount}>owner</span>
                      ) : (
                        <select
                          className={styles.inlineSelect}
                          value={member.role ?? 'viewer'}
                          onChange={(event) => setRole.mutate({ userId: member.id, role: event.target.value })}
                        >
                          <option value="admin">admin</option>
                          <option value="manager">manager</option>
                          <option value="viewer">viewer</option>
                        </select>
                      )}
                      {member.role !== 'owner' && (
                        <button
                          className={styles.iconButton}
                          onClick={() => toggleUserStatus.mutate({ userId: member.id, active: member.status === 'active' })}
                        >
                          {member.status === 'active' ? <UserX size={15} /> : <UserCheck size={15} />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'requests' && (
          <motion.div key="requests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.tabPanel}>
            <div className={styles.teamCard}>
              {requestsQuery.isLoading && [1, 2].map((item) => (
                <div key={item} className={styles.skeletonRow}>
                  <Skeleton height={16} width="60%" />
                </div>
              ))}
              {!requestsQuery.isLoading && !requests.length && (
                <EmptyState
                  icon={<Activity size={18} />}
                  title="Новых заявок нет"
                  description="Когда сотрудник выберет компанию в настройках, заявка появится здесь."
                />
              )}
              {requests.map((request) => (
                <div key={request.id} className={styles.memberRow}>
                  <div className={styles.memberIdentity}>
                    <div className={styles.memberAvatar}>{request.full_name.charAt(0)}</div>
                    <div>
                      <div className={styles.memberName}>{request.full_name}</div>
                      <div className={styles.memberEmail}>{request.email}</div>
                    </div>
                  </div>
                  <div className={styles.memberActions}>
                    <span className={styles.memberCount}>{request.company_name}</span>
                    <Button size="sm" onClick={() => approveRequest.mutate(request.id)}>Подтвердить</Button>
                    <Button size="sm" variant="secondary" onClick={() => rejectRequest.mutate(request.id)}>Отклонить</Button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.tabPanel}>
            {!isOwner && !canManageBilling && (
              <div className={styles.warningBanner}>
                <span className={styles.warningText}>Только владелец бизнеса может менять режим компании.</span>
              </div>
            )}

            <p className={styles.modeDescription}>
              Текущий режим: <strong>{MODE_LABELS[org?.mode ?? 'basic']}</strong>. Это точка управления доступом, ролями и тем,
              какой сложности операционный контур сейчас открыт для команды.
            </p>

            <div className={styles.planGrid}>
              {MODE_OPTIONS.map((mode) => {
                const isCurrent = org?.mode === mode.key;

                return (
                  <div
                    key={mode.key}
                    className={`${styles.planCard} ${styles[mode.toneClass]} ${isCurrent ? styles.planCurrent : ''}`}
                  >
                    <div className={styles.planEyebrow}>{mode.eyebrow}</div>
                    <div className={styles.planTitle}>{mode.title}</div>
                    <div className={styles.planDescription}>{mode.description}</div>

                    {mode.features.map((feature) => (
                      <div key={feature} className={styles.planFeatureRow}>
                        <CheckCircle2 size={12} />
                        <span className={styles.planFeature}>{feature}</span>
                      </div>
                    ))}

                    {isCurrent ? (
                      <div className={styles.planCurrentBadge}>
                        <CheckCircle2 size={13} />
                        Текущий режим
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className={styles.planButton}
                        disabled={!isOwner || upgradeMode.isPending}
                        onClick={() => upgradeMode.mutate(mode.key)}
                      >
                        Переключить
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
