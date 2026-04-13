import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { useReturns, useConfirmReturn, useDeleteReturnDraft } from '../../../../entities/order/queries';
import type { ReturnReason, ReturnStatus } from '../../../../entities/order/types';
import { RETURN_REASON_LABELS } from '../../../../entities/order/types';
import styles from './ChapanReturns.module.css';

type TabKey = '' | 'draft' | 'confirmed';

const TABS: { key: TabKey; label: string }[] = [
  { key: '', label: 'Все' },
  { key: 'draft', label: 'Черновики' },
  { key: 'confirmed', label: 'Подтверждённые' },
];

function fmt(n: number) {
  return `${new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n)} ₸`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ChapanReturnsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('');

  const { data, isLoading, isError } = useReturns({ status: tab || undefined });
  const returns = data?.results ?? [];

  const confirmReturn = useConfirmReturn();
  const deleteDraft = useDeleteReturnDraft();

  if (isLoading) {
    return (
      <div className={styles.root}>
        <div className={styles.loadingState}>Загрузка...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.root}>
        <div className={styles.errorState}>Не удалось загрузить возвраты</div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Возвраты</h1>
        <span className={styles.count}>{returns.length}</span>
      </div>

      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {returns.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>↩</div>
          <div className={styles.emptyText}>Возвратов нет</div>
        </div>
      ) : (
        <div className={styles.list}>
          {returns.map((ret) => (
            <div key={ret.id} className={styles.row}>
              <div className={styles.rowMain} onClick={() => navigate(`/workzone/chapan/orders/${ret.orderId}`)}>
                <div className={styles.rowTop}>
                  <span className={styles.returnNum}>{ret.returnNumber}</span>
                  <span className={styles.orderNum}>Заказ #{ret.order.orderNumber}</span>
                  <span className={`${styles.statusBadge} ${ret.status === 'confirmed' ? styles.statusConfirmed : styles.statusDraft}`}>
                    {ret.status === 'confirmed' ? 'Подтверждён' : 'Черновик'}
                  </span>
                </div>
                <div className={styles.rowBottom}>
                  <span className={styles.clientName}>{ret.order.clientName}</span>
                  <span className={styles.reason}>{RETURN_REASON_LABELS[ret.reason as ReturnReason]}</span>
                  <span className={styles.date}>{fmtDate(ret.createdAt)}</span>
                  {ret.items.length > 0 && (
                    <span className={styles.itemsCount}>{ret.items.length} поз.</span>
                  )}
                </div>
              </div>

              <div className={styles.rowRight}>
                <span className={styles.amount}>−{fmt(ret.totalRefundAmount)}</span>
                {ret.status === 'draft' && (
                  <div className={styles.draftActions}>
                    <button
                      className={styles.confirmBtn}
                      onClick={() => confirmReturn.mutate(ret.id)}
                      disabled={confirmReturn.isPending}
                      title="Подтвердить возврат"
                    >
                      <CheckCircle2 size={13} />
                      Подтвердить
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => deleteDraft.mutate(ret.id)}
                      disabled={deleteDraft.isPending}
                      title="Удалить черновик"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
                {ret.status === 'confirmed' && (
                  <span className={styles.confirmedBy}>
                    <CheckCircle2 size={11} />
                    {ret.confirmedBy}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
