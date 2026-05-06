import { ExternalLink, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOrderPreview } from '../hooks';
import { Skeleton, SkeletonText } from '../../../shared/ui/Skeleton';
import styles from './OrderRefCard.module.css';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  confirmed: 'Подтверждён',
  in_production: 'В производстве',
  ready: 'Готов',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
  on_hold: 'На удержании',
  returned: 'Возврат',
  closed: 'Закрыт',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#9e9e9e',
  confirmed: '#42a5f5',
  in_production: '#ffa726',
  ready: '#66bb6a',
  delivered: '#26c6da',
  cancelled: '#ef5350',
  on_hold: '#ab47bc',
  returned: '#ec407a',
  closed: '#8d6e63',
};

function formatAmount(amount: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'decimal', maximumFractionDigits: 0 }).format(amount) + ' ₸';
}

interface Props {
  orderId: string;
}

export function OrderRefCard({ orderId }: Props) {
  const navigate = useNavigate();
  const { data: order, isLoading, isError } = useOrderPreview(orderId);

  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.loadingRow}>
          <Skeleton width={24} height={24} radius="var(--radius-sm)" />
          <div style={{ flex: 1 }}>
            <SkeletonText width="60%" />
            <SkeletonText width="40%" style={{ marginTop: 4 }} />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className={[styles.card, styles.cardError].join(' ')}>
        <Package size={16} />
        <span>Заказ недоступен</span>
      </div>
    );
  }

  const statusLabel = STATUS_LABELS[order.status] ?? order.status;
  const statusColor = STATUS_COLORS[order.status] ?? '#9e9e9e';

  return (
    <div
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/workzone/chapan/orders/${orderId}`)}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/workzone/chapan/orders/${orderId}`)}
    >
      <div className={styles.header}>
        <Package size={14} className={styles.icon} />
        <span className={styles.orderNumber}>Заказ №{order.order_number}</span>
        <ExternalLink size={12} className={styles.extIcon} />
      </div>
      <div className={styles.client}>{order.client_name}</div>
      <div className={styles.footer}>
        <span className={styles.status} style={{ color: statusColor }}>
          {statusLabel}
        </span>
        <span className={styles.amount}>{formatAmount(order.total_amount)}</span>
      </div>
    </div>
  );
}
