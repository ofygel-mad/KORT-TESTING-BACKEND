import { useDeferredValue, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CircleCheck, Check, X, AlertCircle, ExternalLink } from 'lucide-react';
import { useOrders } from '@/entities/order/queries';
import type { Order, OrderStatus } from '@/entities/order/types';
import { calculateOrderFinancials } from '@/shared/lib/orderFinancials';
import styles from './ArchivePage.module.css';

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  in_production: 'В производстве',
  ready: 'Готов',
  transferred: 'Передан',
  on_warehouse: 'На складе',
  shipped: 'Отправлен',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

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
  return new Date(d).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ArchivePage() {
  const navigate = useNavigate();
  const [completedSearch, setCompletedSearch] = useState('');
  const deferredCompletedSearch = useDeferredValue(completedSearch);

  // Archive page = long-term storage. Returns ALL archived orders
  // (regardless of status — completed AND cancelled both belong here once
  // the manager hits "Архивировать"). Status-based filtering lives in
  // OrdersPage's lifecycle chips, not here.
  const {
    data: completedData,
    isLoading: isCompletedLoading,
    isError: isCompletedError,
  } = useOrders({
    archived: true,
    search: deferredCompletedSearch || undefined,
    limit: 200,
  });

  const completedOrders: Order[] = completedData?.results ?? [];

  return (
    <>
      <div className={`${styles.root} kort-page-enter`}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <CircleCheck size={18} />
            <span>Архив</span>
          </div>
          <div className={styles.headerSub}>Долгосрочное хранилище завершённых и отменённых заказов</div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              value={completedSearch}
              onChange={(e) => setCompletedSearch(e.target.value)}
              placeholder="Номер, клиент, модель..."
            />
          </div>
        </div>

        {!isCompletedLoading && (
          <div className={styles.count}>{`${completedData?.count ?? 0} \u0437\u0430\u043a\u0430\u0437\u043e\u0432`}</div>
        )}

        {isCompletedLoading && (
          <div className={styles.loading}>
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className={styles.skeleton} />)}
          </div>
        )}

        {isCompletedError && (
          <div className="kort-inline-error">
            <AlertCircle size={16} />
            Не удалось загрузить заказы. Проверьте соединение и попробуйте обновить страницу.
          </div>
        )}

        {!isCompletedLoading && !isCompletedError && completedOrders.length === 0 && (
          <div className={styles.emptyState}>
            <CircleCheck size={36} className={styles.emptyIcon} />
            <div className={styles.emptyTitle}>В архиве пусто</div>
            <div className={styles.emptyText}>
              {completedSearch
                ? 'Ничего не найдено по заданным фильтрам'
                : 'Завершите заказ и нажмите «Архивировать» в карточке — он попадёт сюда'}
            </div>
          </div>
        )}

        {!isCompletedLoading && !isCompletedError && completedOrders.length > 0 && (
          <div className={styles.list}>
            {completedOrders.map((order) => (
              <ArchiveRow
                key={order.id}
                order={order}
                onClick={() => navigate(`/sales/${order.id}`)}
              />
            ))}
          </div>
        )}
      </div>

    </>
  );
}

function ArchiveRow({ order, onClick }: { order: Order; onClick: () => void }) {
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
        <span className={styles.statusBadge}>{STATUS_LABEL[order.status]}</span>
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
        <span className={styles.amount}>{fmt(calculateOrderFinancials({
          itemsSubtotal: order.totalAmount,
          orderDiscount: order.orderDiscount,
          deliveryFee: order.deliveryFee,
          bankCommissionPercent: order.bankCommissionPercent,
          bankCommissionAmount: order.bankCommissionAmount,
        }).totalDue)}</span>
        <span className={styles.payStatus} style={{ color: PAY_COLOR[order.paymentStatus] }}>
          {PAY_LABEL[order.paymentStatus]}
        </span>
      </div>

      <div className={styles.rowDates}>
        {order.status === 'completed' && order.completedAt && (
          <span className={styles.dateLabel}><Check size={10} className={styles.dateIcon} />{fmtDate(order.completedAt)}</span>
        )}
        {order.status === 'cancelled' && order.cancelledAt && (
          <span className={`${styles.dateLabel} ${styles.dateCancelled}`}><X size={10} className={styles.dateIcon} />{fmtDate(order.cancelledAt)}</span>
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
