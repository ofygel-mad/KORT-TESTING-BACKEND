import { useChapanStore } from '../../../chapan-spa/model/chapan.store';
import styles from '../../components/Workspace.module.css';

export function RequestsTilePreview({ tileId: _tileId }: { tileId: string }) {
  const { orders, requests, profile } = useChapanStore();

  const activeOrders = orders.filter(
    (o) => o.status !== 'cancelled' && o.status !== 'completed',
  );
  const newRequests = requests.filter((r) => r.status === 'new');
  const inWorkRequests = requests.filter((r) => r.status === 'reviewed');
  const unpaidOrders = activeOrders.filter((o) => o.paymentStatus === 'unpaid').length;
  const readyOrders = orders.filter((o) => o.status === 'ready').length;

  return (
    <div className={styles.previewFrame}>
      <div className={styles.previewHeaderRow}>
        <span>Менеджер</span>
        <span>Заявки</span>
        <span>Заказы</span>
      </div>

      <div className={styles.previewBody}>
        <div className={styles.tableRow3}>
          <strong>{profile.displayName}</strong>
          <span>{newRequests.length} новых</span>
          <span>{activeOrders.length} активных</span>
        </div>
        <div className={styles.tableRow3}>
          <strong>Статус</strong>
          <span>{inWorkRequests.length} в работе</span>
          <span>{readyOrders > 0 ? `${readyOrders} к выдаче` : unpaidOrders > 0 ? `${unpaidOrders} долг` : 'ок'}</span>
        </div>
      </div>
    </div>
  );
}
