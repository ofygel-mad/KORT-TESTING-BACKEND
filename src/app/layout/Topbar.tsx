import { useEffect, useRef, useState } from 'react';
import { useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Bell, ChevronRight, Search, User } from 'lucide-react';
import { ThemeSwitcher } from '@/shared/ui/ThemeSwitcher';
import { addDocumentListener } from '@/shared/lib/browser';
import { api } from '@/shared/api/client';
import { useSSE } from '@/shared/hooks/useSSE';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useT } from '@/shared/i18n';
import { popoverVariants, t } from '@/shared/motion/presets';
import { useCommandPalette } from '@/shared/stores/commandPalette';
import { useAuthStore } from '@/shared/stores/auth';
import { useProfileStore, ONLINE_STATUSES, getComputedOnlineStatus } from '@/shared/stores/profile';
import { usePlan, PLAN_LABELS, PLAN_COLORS } from '@/shared/hooks/usePlan';
import { PlanUpgradeModal } from '@/features/plan';
import { useSharedBus } from '@/features/shared-bus';
import type { GlobalNotifEvent } from '@/features/shared-bus';
import styles from './Topbar.module.css';

interface Notification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

function NotificationBell({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [localNotifs, setLocalNotifs] = useState<GlobalNotifEvent[]>([]);

  const { data } = useQuery<{ results: Notification[]; count: number }>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications/'),
    enabled,
  });

  useSSE({
    enabled,
    onNotification: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      // Invalidate operations queries ONLY when the notification names a
      // concrete order/production entity. Without this guard, generic
      // notifications (no entity field) refetched every list on every page
      // and felt like the whole UI was auto-refreshing.
      const entity = (data?.entity ?? data?.type ?? '') as string;
      if (entity.startsWith('order') || entity.startsWith('production')) {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['production'] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      }
    },
    onEntityUpdate: (entities) => {
      const keyMap: Record<string, readonly unknown[]> = {
        orders:                 ['orders'],
        production:             ['production'],
        invoices:               ['invoices'],
        returns:                ['returns'],
        change_requests:        ['change_requests'],
        leads:                  ['leads'],
        deals:                  ['deals'],
        customers:              ['customers'],
        tasks:                  ['tasks'],
        finance:                ['finance'],
      };
      for (const key of entities) {
        const queryKey = keyMap[key];
        if (queryKey) queryClient.invalidateQueries({ queryKey });
        if (key === 'orders') {
          queryClient.invalidateQueries({ queryKey: ['production'] });
        }
      }
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post('/notifications/read_all/'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = (data?.results ?? []).filter((item) => !item.is_read).length + localNotifs.filter(() => !open).length;

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    return addDocumentListener('mousedown', onMouseDown);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const items = useSharedBus.getState().consumeGlobalNotifs();
      if (!items.length) return;
      setLocalNotifs((prev) => [...items, ...prev].slice(0, 50));
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [enabled, queryClient]);

  if (!enabled) {
    return null;
  }

  return (
    <div ref={ref} className={styles.notifRoot}>
      <motion.button
        className={[styles.iconBtn, open ? styles.active : ''].join(' ')}
        onClick={() => setOpen((state) => !state)}
        whileTap={{ scale: 0.93 }}
        transition={t.fast}
        aria-label="Уведомления"
        aria-expanded={open}
      >
        <Bell size={16} strokeWidth={1.75} />
        {unread > 0 && <span className={styles.unreadDot} />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.notifPanel}
            variants={popoverVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={isMobile ? { right: 0 } : undefined}
          >
            <div className={styles.notifHeader}>
              <span className={styles.notifTitle}>Уведомления</span>
              {unread > 0 && (
                <button className={styles.notifMarkAll} onClick={() => markAllRead.mutate()}>
                  Прочитать все
                </button>
              )}
            </div>

            {localNotifs.length === 0 && (data?.results ?? []).length === 0 ? (
              <div className={styles.notifEmpty}>Уведомлений нет</div>
            ) : (
              <>
                {localNotifs.map((item) => (
                  <div key={item.id} className={`${styles.notifItem} ${styles.unread}`}>
                    <div className={styles.notifItemTitle}>{item.title}</div>
                    <div className={styles.notifItemBody}>{item.body}</div>
                  </div>
                ))}

                {(data?.results ?? []).map((item) => (
                  <div key={item.id} className={[styles.notifItem, !item.is_read ? styles.unread : ''].join(' ')}>
                    <div className={styles.notifItemTitle}>{item.title}</div>
                    <div className={styles.notifItemBody}>{item.body}</div>
                  </div>
                ))}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function useDynamicCrumb(enabled: boolean): { parent: string; parentPath: string; current: string } | null {
  const matchCustomer = useMatch('/crm/customers/:id');
  const matchTask = useMatch('/crm/tasks/:id');
  const customerId = matchCustomer?.params.id;

  const { data: customer } = useQuery({
    queryKey: ['customer-name', customerId],
    queryFn: () => api.get(`/customers/${customerId}/`),
    enabled: enabled && Boolean(customerId),
    staleTime: 60000,
    select: (data: any) => data.full_name as string,
  });

  if (customerId) return { parent: 'Клиенты', parentPath: '/crm/customers', current: customer ?? '...' };
  if (matchTask) return { parent: 'Задачи', parentPath: '/crm/tasks', current: 'Задача' };
  return null;
}

const BREADCRUMBS: Record<string, string> = {
  '/': 'Главная',
  // CRM
  '/crm/leads': 'Лиды',
  '/crm/customers': 'Клиенты',
  '/crm/tasks': 'Задачи',
  // Sales
  '/sales': 'Продажи',
  '/sales/new': 'Новый заказ',
  '/sales/archive': 'Архив заказов',
  '/sales/trash': 'Корзина',
  '/sales/returns': 'Возвраты',
  '/sales/kaspi': 'Kaspi',
  '/sales/kaspi/new': 'Kaspi · Новые',
  '/sales/kaspi/in-progress': 'Kaspi · В работе',
  '/sales/kaspi/completed': 'Kaspi · Завершённые',
  '/sales/kaspi/cancelled': 'Kaspi · Отменённые',
  '/sales/kaspi/issues': 'Kaspi · Проблемы',
  '/sales/kaspi/stock': 'Kaspi · Остатки',
  // Warehouse & operations
  '/warehouse': 'Склад',
  '/warehouse/purchase': 'Закупки',
  '/production': 'Производство',
  '/production/ready': 'Готово',
  '/logistics': 'Логистика',
  '/products': 'Продукты',
  // Finance
  '/finance': 'Финансы',
  // Reports
  '/reports': 'Отчёты',
  '/reports/analytics': 'Аналитика',
  // Documents
  '/documents': 'Документы',
  '/documents/invoices': 'Накладные',
  // Settings
  '/settings': 'Настройки',
  '/settings/operations': 'Операционные настройки',
  '/settings/order-templates': 'Шаблоны заказов',
  '/settings/profile': 'Профиль',
  // Onboarding
  '/onboarding': 'Онбординг',
};

// Top-level section paths (anything the sidebar links to). The Back button
// is hidden on these — the sidebar IS the navigation. Sub-routes get a
// back button.
const TOP_LEVEL_PATHS = new Set<string>([
  '/',
  '/onboarding',
  '/crm/leads',
  '/crm/customers',
  '/crm/tasks',
  '/sales',
  '/warehouse',
  '/production',
  '/logistics',
  '/products',
  '/finance',
  '/reports',
  '/documents',
  '/settings',
]);

/** Fallback: strip the last path segment. `/a/b/c` → `/a/b`; `/a` → `/`. */
function parentPath(pathname: string): string {
  const idx = pathname.lastIndexOf('/');
  if (idx <= 0) return '/';
  return pathname.slice(0, idx);
}

export function Topbar({ chromeTone = 'dark' }: { chromeTone?: 'canvas' | 'dark' | 'light' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toggle } = useCommandPalette();
  const user = useAuthStore((state) => state.user);
  const hasCompanyAccess = useAuthStore((state) => state.membership.status === 'active');
  const isMobile = useIsMobile();
  const { locale, setLocale } = useT();
  const dynamic = useDynamicCrumb(hasCompanyAccess);
  // Unknown paths render an empty crumb (preferable to a raw URL slug
  // bleeding through as a pseudo-heading). Add the path to BREADCRUMBS
  // above when introducing a new top-level route.
  const crumb = BREADCRUMBS[location.pathname] ?? '';
  const isDashboard = location.pathname === '/';
  // Back button: only when we're DEEPER than a top-level section. The
  // sidebar already covers section-level navigation. Target = parent
  // path (one segment up), so `/settings/order-templates/abc` → `/settings/
  // order-templates`, then a second click takes the user to `/settings`.
  const showBack = !TOP_LEVEL_PATHS.has(location.pathname) && location.pathname !== '/';
  const handleBack = () => {
    // Use real browser history first — that's what the user actually
    // wants: "вернись на предыдущий экран, где я был". This correctly
    // handles cross-section navigation (e.g., reached
    // /settings/order-templates from /sales via the template picker —
    // Back should land on /sales, not on /settings).
    //
    // Falls back to the structural parent path only when there's no
    // navigable history (e.g., the user opened the URL directly).
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(parentPath(location.pathname));
    }
  };
  const plan = usePlan();
  const [showPlanModal, setShowPlanModal] = useState(false);
  const { onlineStatus, lastActivityAt } = useProfileStore();
  const [profileHover, setProfileHover] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initials = (user?.full_name ?? 'U')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const computedStatus = getComputedOnlineStatus(lastActivityAt, onlineStatus);
  const currentStatus = ONLINE_STATUSES.find((s) => s.key === computedStatus);

  function handleProfileMouseEnter() {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setProfileHover(true);
  }

  function handleProfileMouseLeave() {
    hoverTimeout.current = setTimeout(() => setProfileHover(false), 200);
  }

  return (
  <>
    <header className={styles.topbar} data-chrome={chromeTone}>
      <div className={styles.left}>
        {showBack && (
          <button className={styles.backBtn} onClick={handleBack} aria-label="Назад">
            <ArrowLeft size={14} />
            {!isMobile && <span>Назад</span>}
          </button>
        )}

        {!isDashboard && !showBack && (
          <nav className={styles.breadcrumb} aria-label="breadcrumb">
            {dynamic ? (
              <>
                <button className={styles.crumbParent} onClick={() => navigate(dynamic.parentPath)}>
                  {dynamic.parent}
                </button>
                <ChevronRight size={12} className={styles.crumbSep} />
                <span className={styles.crumbCurrent}>{dynamic.current}</span>
              </>
            ) : (
              <span className={styles.crumbCurrent}>{crumb}</span>
            )}
          </nav>
        )}
      </div>

      <div className={styles.right}>
        <button className={styles.searchBtn} onClick={toggle} aria-label="Поиск">
          <Search size={14} />
          {!isMobile && <span>Поиск</span>}
          {!isMobile && <kbd className={styles.searchKbd}>⌘K</kbd>}
        </button>

        <NotificationBell enabled={hasCompanyAccess} />

        <ThemeSwitcher />

        <button className={styles.langBtn} onClick={() => setLocale(locale === 'ru' ? 'kk' : 'ru')}>
          {locale === 'ru' ? 'KK' : 'RU'}
        </button>

        {hasCompanyAccess && (
          <button
            type="button"
            className={[styles.planBadge, plan === 'industrial' ? styles.planBadgeStatic : ''].join(' ')}
            data-plan={plan}
            onClick={plan !== 'industrial' ? () => setShowPlanModal(true) : undefined}
            aria-label={plan === 'industrial' ? `Текущий план: ${PLAN_LABELS[plan]}` : `Сменить план (${PLAN_LABELS[plan]})`}
          >
            {PLAN_LABELS[plan]}
          </button>
        )}

        <div
          ref={profileRef}
          className={styles.profileRoot}
          onMouseEnter={handleProfileMouseEnter}
          onMouseLeave={handleProfileMouseLeave}
        >
          <button
            className={styles.avatarBtn}
            onClick={() => navigate('/settings/profile')}
            aria-label="Профиль"
          >
            {initials}
          </button>

          <AnimatePresence>
            {profileHover && (
              <motion.div
                className={styles.profilePopover}
                variants={popoverVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onMouseEnter={handleProfileMouseEnter}
                onMouseLeave={handleProfileMouseLeave}
              >
                <div className={styles.profilePopoverAvatar}>{initials}</div>
                <div className={styles.profilePopoverName}>{user?.full_name ?? '—'}</div>
                {(user?.email || user?.phone) && (
                  <div className={styles.profilePopoverContact}>
                    {user.email ?? user.phone}
                  </div>
                )}
                {currentStatus && (
                  <div className={styles.profilePopoverStatus}>
                    <span className={styles.profilePopoverStatusDot} style={{ background: currentStatus.color }} />
                    <span>{currentStatus.label}</span>
                  </div>
                )}
                <button
                  className={styles.profilePopoverLink}
                  onClick={() => { setProfileHover(false); navigate('/settings/profile'); }}
                >
                  <User size={12} />
                  Открыть профиль
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>

    {showPlanModal && (
      <PlanUpgradeModal onClose={() => setShowPlanModal(false)} />
    )}
  </>
  );
}

export { NotificationBell };
