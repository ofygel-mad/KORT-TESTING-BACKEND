import { useDeferredValue, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ExternalLink, Package, Search, Truck } from 'lucide-react';
import { useOrders } from '../../../../entities/order/queries';
import type { ChapanOrder, OrderStatus } from '../../../../entities/order/types';
import styles from './ChapanShipping.module.css';

type ShippingTab = 'pending' | 'shipped';

const STATUS_COLOR: Record<OrderStatus, string> = {
  new: '#7C3AED',
  confirmed: '#3B82F6',
  in_production: '#F59E0B',
  ready: '#10B981',
  transferred: '#8B5CF6',
  on_warehouse: '#8B5CF6',
  shipped: '#3B82F6',
  completed: '#4A5268',
  cancelled: '#EF4444',
};

const PAY_LABEL: Record<string, string> = {
  not_paid: 'Не оплачен',
  partial: 'Частично',
  paid: 'Оплачен',
};

const PAY_COLOR: Record<string, string> = {
  not_paid: '#EF4444',
  partial: '#F59E0B',
  paid: '#10B981',
};

function fmt(n: number) {
  return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n) + ' ₸';
}

function fmtDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short' });
}

export default function ChapanShippingPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<ShippingTab>('pending');
  const [search, setSearch] = useState('');
  const deferred = useDeferredValue(search);

  const pendingQuery = useOrders({
    statuses: 'on_warehouse',
    search: deferred || undefined,
    limit: 200,
  });

  const shippedQuery = useOrders({
    statuses: 'shipped',
    search: deferred || undefined,
    limit: 200,
  });

  const activeQuery = tab === 'pending' ? pendingQuery : shippedQuery;
  const orders: ChapanOrder[] = activeQuery.data?.results ?? [];

  return (
    <div className={`${styles.root} kort-page-enter`}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Truck size={18} />
          <span>Отправка</span>
        </div>
        <div className={styles.headerSub}>Управление отгрузкой заказов клиентам</div>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'pending' ? styles.tabActive : ''}`}
          onClick={() => setTab('pending')}
        >
          <Package size={14} />
          <span>На складе</span>
          {pendingQuery.data && (
            <span className={styles.tabBadge}>{pendingQuery.data.count}</span>
          )}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'shipped' ? styles.tabActive : ''}`}
          onClick={() => setTab('shipped')}
        >
          <Truck size={14} />
          <span>Отправлены</span>
          {shippedQuery.data && (
            <span className={styles.tabBadge}>{shippedQuery.data.count}</span>
          )}
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Номер, клиент, модель..."
          />
        </div>
      </div>

      {!activeQuery.isLoading && (
        <div className={styles.count}>{activeQuery.data?.count ?? 0} заказов</div>
      )}

      {activeQuery.isLoading && (
        <div className={styles.loading}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      )}

      {activeQuery.isError && (
        <div className="kort-inline-error">
          <AlertCircle size={16} />
          Не удалось загрузить данные. Проверьте соединение и обновите страницу.
        </div>
      )}

      {!activeQuery.isLoading && !activeQuery.isError && orders.length === 0 && (
        <div className={styles.emptyState}>
          <Truck size={36} className={styles.emptyIcon} />
          <div className={styles.emptyTitle}>
            {tab === 'pending' ? 'Нет заказов на складе' : 'Нет отправленных заказов'}
          </div>
          <div className={styles.emptyText}>
            {search
              ? 'Ничего не найдено по заданному запросу'
              : tab === 'pending'
                ? 'Заказы, принятые складом через накладную, появятся здесь'
                : 'Отправленные клиентам заказы появятся здесь'}
          </div>
        </div>
      )}

      {!activeQuery.isLoading && !activeQuery.isError && orders.length > 0 && (
        <div className={styles.list}>
          {orders.map(order => (
            <ShippingRow
              key={order.id}
              order={order}
              onClick={() => navigate(`/workzone/chapan/shipping/${order.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ShippingRow({ order, onClick }: { order: ChapanOrder; onClick: () => void }) {
  const first = order.items?.[0];
  const more = (order.items?.length ?? 0) - 1;

  return (
    <div
      className={styles.row}
      style={{ '--status-color': STATUS_COLOR[order.status] } as React.CSSProperties}
    >
      <span className={styles.rowStripe} />

      <div className={styles.rowNum}>
        <span className={styles.cardNum}>#{order.orderNumber}</span>
        <span className={styles.statusBadge}>
          {order.status === 'on_warehouse' ? 'На складе' : 'Отправлен'}
        </span>
      </div>

      <div className={styles.rowClient}>
        <span className={styles.clientName}>{order.clientName}</span>
        <span className={styles.clientPhone}>{order.clientPhone}</span>
      </div>

      <div className={styles.rowProduct}>
        {first ? (
          <>
            <span className={styles.itemName}>{first.productName}</span>
            <span className={styles.itemMeta}>
              {[first.size].filter(Boolean).join(' · ')}
              {first.quantity > 1 && ` × ${first.quantity}`}
            </span>
            {more > 0 && <span className={styles.itemMore}>+ещё {more}</span>}
          </>
        ) : (
          <span className={styles.itemMeta}>—</span>
        )}
      </div>

      <div className={styles.rowFin}>
        <span className={styles.amount}>{fmt(order.totalAmount)}</span>
        <span className={styles.payStatus} style={{ color: PAY_COLOR[order.paymentStatus] }}>
          {PAY_LABEL[order.paymentStatus]}
        </span>
      </div>

      <div className={styles.rowDates}>
        {order.dueDate && (
          <span className={styles.dateLabel}>Срок: {fmtDate(order.dueDate)}</span>
        )}
        {order.city && (
          <span className={styles.dateLabel}>{order.city}</span>
        )}
      </div>

      <div className={styles.rowActions}>
        <button
          type="button"
          className={styles.viewBtn}
          onClick={onClick}
          title="Открыть заказ"
        >
          <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );
}
