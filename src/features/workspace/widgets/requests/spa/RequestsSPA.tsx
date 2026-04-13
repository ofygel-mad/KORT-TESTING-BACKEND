/**
 * features/workspace/widgets/requests/spa/RequestsSPA.tsx
 *
 * Менеджерский SPA — зона ответственности отдела приёма заказов.
 * Разделы: Заявки, Заказы, Настройки.
 * Данные берутся из общего useChapanStore, который ожидает подключения к backend.
 *
 * TODO (backend):
 *  - POST   /api/requests/            создать заявку
 *  - PATCH  /api/requests/:id/status  обновить статус
 *  - GET    /api/orders/              список заказов
 *  - POST   /api/orders/              создать заказ
 *  - PATCH  /api/orders/:id/status    изменить статус заказа
 *  - POST   /api/orders/:id/payments  добавить оплату
 *  - GET    /api/workshop/profile     настройки мастерской
 *  - PATCH  /api/workshop/profile     обновить настройки
 */
import { useEffect, useMemo } from 'react';
import {
  ExternalLink,
  Factory,
  Inbox,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShoppingBag,
} from 'lucide-react';
import { useChapanStore } from '../../../../chapan-spa/model/chapan.store';
import { useTileChapanUI } from '../../../../chapan-spa/model/tile-ui.store';
import type { ChapanSection } from '../../../../chapan-spa/model/tile-ui.store';
import type {
  OrderPriority,
  OrderSortBy,
  OrderStatus,
  PaymentStatus,
} from '../../../../chapan-spa/api/types';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_ORDER,
  PAYMENT_STATUS_LABEL,
  PRIORITY_LABEL,
} from '../../../../chapan-spa/api/types';
import { OrderList } from '../../../../chapan-spa/components/orders/OrderList';
import { CreateOrderModal } from '../../../../chapan-spa/components/orders/CreateOrderModal';
import { OrderDrawer } from '../../../../chapan-spa/components/drawer/OrderDrawer';
import { WorkshopSettings } from '../../../../chapan-spa/components/settings/WorkshopSettings';
import { RequestInbox } from '../../../../chapan-spa/components/requests/RequestInbox';
import s from './RequestsSPA.module.css';

// Only manager-side sections — production stays in the Chapan tile
type RequestsSection = Extract<ChapanSection, 'requests' | 'orders' | 'settings'>;

interface Props {
  tileId: string;
}

const SECTIONS: { id: RequestsSection; label: string; icon: typeof Factory }[] = [
  { id: 'requests', label: 'Заявки',   icon: Inbox },
  { id: 'orders',   label: 'Заказы',   icon: ShoppingBag },
  { id: 'settings', label: 'Настройки', icon: Settings },
];

export function RequestsSPA({ tileId }: Props) {
  const { loading, load, orders, requests, profile } = useChapanStore();
  const ui = useTileChapanUI(tileId);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    activeRequests: requests.filter(
      (r) => r.status === 'new' || r.status === 'reviewed',
    ).length,
    readyOrders: orders.filter((o) => o.status === 'ready').length,
  }), [orders, requests]);

  // Clamp section to manager-only sections
  const section: RequestsSection =
    (ui.section === 'production' ? 'orders' : ui.section) as RequestsSection;

  if (loading) {
    return (
      <div className={s.loading}>
        <RefreshCw size={20} className={s.spin} />
        <span>Загружаю данные менеджера...</span>
      </div>
    );
  }

  return (
    <div className={s.root} data-tile-id={tileId}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className={s.topBar}>
        <div className={s.headMain}>
          <h1 className={s.title}>{profile.displayName}</h1>
        </div>

        <div className={s.actionRow}>
          {profile.publicIntakeEnabled && (
            <button
              className={s.secondaryBtn}
              onClick={() => window.open('/workzone/request', '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink size={14} />
              Форма заявки
            </button>
          )}
          <button className={s.primaryBtn} onClick={() => ui.openCreateModal()}>
            <Plus size={14} />
            Новый заказ
          </button>
        </div>
      </div>

      {/* ── Tab nav ─────────────────────────────────────────── */}
      <nav className={s.nav}>
        {SECTIONS.map((sec) => (
          <button
            key={sec.id}
            className={`${s.navItem} ${section === sec.id ? s.navItemActive : ''}`}
            onClick={() => ui.setSection(sec.id)}
          >
            <sec.icon size={14} />
            <span>{sec.label}</span>
            {sec.id === 'requests' && stats.activeRequests > 0 && (
              <span className={s.navBadge}>{stats.activeRequests}</span>
            )}
            {sec.id === 'orders' && stats.readyOrders > 0 && (
              <span className={s.navBadge} data-tone="success">{stats.readyOrders}</span>
            )}
          </button>
        ))}
      </nav>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className={s.content}>

        {/* Заявки — входящие обращения */}
        {section === 'requests' && (
          <RequestInbox tileId={tileId} />
        )}

        {/* Заказы — список с фильтрами */}
        {section === 'orders' && (
          <>
            <div className={s.filtersBar}>
              <div className={s.searchField}>
                <Search size={14} />
                <input
                  className={s.filterInput}
                  placeholder="Найти по коду, клиенту или изделию"
                  value={ui.searchQuery}
                  onChange={(e) => ui.setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className={s.filterSelect}
                value={ui.filterStatus}
                onChange={(e) => ui.setFilterStatus(e.target.value as OrderStatus | 'all')}
              >
                <option value="all">Все статусы</option>
                {ORDER_STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>{ORDER_STATUS_LABEL[status]}</option>
                ))}
                <option value="cancelled">Отменённые</option>
              </select>

              <select
                className={s.filterSelect}
                value={ui.filterPriority}
                onChange={(e) => ui.setFilterPriority(e.target.value as OrderPriority | 'all')}
              >
                <option value="all">Все приоритеты</option>
                {(Object.keys(PRIORITY_LABEL) as OrderPriority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
                ))}
              </select>

              <select
                className={s.filterSelect}
                value={ui.filterPayment}
                onChange={(e) => ui.setFilterPayment(e.target.value as PaymentStatus | 'all')}
              >
                <option value="all">Вся оплата</option>
                {(Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[]).map((ps) => (
                  <option key={ps} value={ps}>{PAYMENT_STATUS_LABEL[ps]}</option>
                ))}
              </select>

              <select
                className={s.filterSelect}
                value={ui.sortBy}
                onChange={(e) => ui.setSortBy(e.target.value as OrderSortBy)}
              >
                <option value="createdAt">Сначала новые</option>
                <option value="dueDate">По сроку</option>
                <option value="totalAmount">По сумме</option>
                <option value="updatedAt">По последнему действию</option>
              </select>
            </div>

            <OrderList tileId={tileId} />
          </>
        )}

        {/* Настройки мастерской */}
        {section === 'settings' && (
          <WorkshopSettings />
        )}
      </div>

      {/* Drawer + Modal — per-tile UI */}
      <OrderDrawer tileId={tileId} />
      <CreateOrderModal tileId={tileId} />
    </div>
  );
}
