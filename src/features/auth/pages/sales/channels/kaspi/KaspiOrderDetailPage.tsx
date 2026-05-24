import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PackageSearch, RefreshCw, Store } from 'lucide-react';
import { useKaspiOrder } from '@/entities/kaspi/queries';
import type { KaspiOrderDetail } from '@/entities/kaspi/types';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import styles from './KaspiOrdersPage.module.css';

const MONEY = new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 });

function fmtMoney(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  return `${MONEY.format(value)} ₸`;
}

function fmtDateTime(value: string | null) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString('ru-KZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function stringifySnapshot(snapshot: Record<string, unknown> | null) {
  if (!snapshot) {
    return null;
  }
  return JSON.stringify(snapshot, null, 2);
}

function DetailMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metaCard}>
      <div className={styles.metaCardLabel}>{label}</div>
      <div className={styles.metaCardValue}>{value}</div>
    </div>
  );
}

function ItemsTable({ order }: { order: KaspiOrderDetail }) {
  const rows = [...order.matchedItems, ...order.unmatchedItems].sort((a, b) => {
    const left = a.entryNumber ?? 0;
    const right = b.entryNumber ?? 0;
    return left - right;
  });

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Позиция</th>
            <th>SKU</th>
            <th>Кол-во / сумма</th>
            <th>Match</th>
            <th>Stock</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.externalEntryId}>
              <td>
                <div className={styles.stack}>
                  <span className={styles.primaryCell}>{item.productName || '—'}</span>
                  <span className={styles.metaLabel}>
                    {item.manufacturer || item.categoryTitle || '—'}
                  </span>
                </div>
              </td>
              <td>
                <div className={styles.stack}>
                  <span className={styles.mono}>{item.merchantSku || '—'}</span>
                  <span className={styles.metaLabel}>{item.warehouseSku || '—'}</span>
                </div>
              </td>
              <td>
                <div className={styles.stack}>
                  <span>{item.quantity ?? '—'}</span>
                  <span className={styles.metaLabel}>{fmtMoney(item.totalPrice)}</span>
                </div>
              </td>
              <td>
                <div className={styles.stack}>
                  <span>{item.matchState}</span>
                  <span className={styles.metaLabel}>{item.matchReason || '—'}</span>
                </div>
              </td>
              <td>
                <div className={styles.stack}>
                  <span>{item.stockImpactState}</span>
                  <span className={styles.metaLabel}>{item.reservationStatus || '—'}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function KaspiOrderDetailPage() {
  const navigate = useNavigate();
  const { externalOrderId } = useParams<{ externalOrderId: string }>();
  const { data: order, isLoading, isError } = useKaspiOrder(externalOrderId);

  const customerJson = useMemo(
    () => stringifySnapshot(order?.customerSnapshot ?? null),
    [order?.customerSnapshot],
  );
  const deliveryJson = useMemo(
    () => stringifySnapshot(order?.deliverySnapshot ?? null),
    [order?.deliverySnapshot],
  );

  if (isLoading) {
    return (
      <section className={styles.card}>
        <div className={styles.statePanel}>
          <RefreshCw size={22} />
          <div>Загрузка Kaspi заказа...</div>
        </div>
      </section>
    );
  }

  if (isError || !order) {
    return (
      <section className={styles.card}>
        <EmptyState
          icon={<PackageSearch size={36} />}
          title="Не удалось открыть Kaspi заказ"
          description="Возможно, заказ был удалён или sync не доходит."
          action={
            <Button variant="secondary" onClick={() => navigate(-1)} icon={<ArrowLeft size={14} />}>
              Назад
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <>
      <section className={styles.card}>
        <div className={styles.detailHeader}>
          <div className={styles.detailTitleGroup}>
            <div className={styles.detailBackRow}>
              <Button
                variant="ghost"
                size="sm"
                icon={<ArrowLeft size={14} />}
                onClick={() => navigate(-1)}
              >
                Назад
              </Button>
              <div className={styles.detailTitleText}>
                <div className={styles.detailTitleHeading}>
                  <Store size={16} />
                  <span>{order.externalOrderCode || order.externalOrderId}</span>
                </div>
                <div className={styles.detailMeta}>
                  {order.customerName || '—'} · {order.externalStatus || '—'} / {order.externalState || '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.detailGrid}>
        <div className={styles.detailColumn}>
          <section className={styles.card}>
            <div className={styles.cardTitle}>Основная информация</div>
            <div className={styles.metaGrid}>
              <DetailMeta label="Kaspi order ID" value={order.externalOrderId} />
              <DetailMeta label="Kaspi code" value={order.externalOrderCode || '—'} />
              <DetailMeta label="Delivery mode" value={order.deliveryMode || '—'} />
              <DetailMeta label="Payment mode" value={order.paymentMode || '—'} />
              <DetailMeta label="Сумма" value={fmtMoney(order.totalPrice)} />
              <DetailMeta label="План. дата" value={fmtDateTime(order.plannedDeliveryDate)} />
              <DetailMeta label="Создан" value={fmtDateTime(order.creationDate)} />
              <DetailMeta label="Обновлён в Kaspi" value={fmtDateTime(order.lastExternalUpdateAt)} />
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>Товары и match state</div>
            <ItemsTable order={order} />
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>Снимок клиента и delivery</div>
            <div className={styles.detailGrid}>
              <div className={styles.detailColumn}>
                <div className={styles.subSectionTitle}>Клиент</div>
                {customerJson ? (
                  <pre className={styles.jsonBox}>{customerJson}</pre>
                ) : (
                  <div className={styles.metaLabel}>—</div>
                )}
              </div>
              <div className={styles.detailColumn}>
                <div className={styles.subSectionTitle}>Delivery</div>
                {deliveryJson ? (
                  <pre className={styles.jsonBox}>{deliveryJson}</pre>
                ) : (
                  <div className={styles.metaLabel}>—</div>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className={styles.detailColumn}>
          <section className={styles.card}>
            <div className={styles.cardTitle}>Статус и stock tracking</div>
            <div className={styles.kvList}>
              <div className={styles.kvRow}>
                <span className={styles.kvKey}>Kaspi status</span>
                <span className={styles.kvValue}>{order.externalStatus || '—'}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvKey}>Kaspi state</span>
                <span className={styles.kvValue}>{order.externalState || '—'}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvKey}>Match state</span>
                <span className={styles.kvValue}>{order.matchState}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvKey}>Stock impact</span>
                <span className={styles.kvValue}>{order.stockImpactState}</span>
              </div>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>Снимок history</div>
            <div className={styles.kvList}>
              {order.statusHistory.map((item) => (
                <div key={item.key} className={styles.kvRow}>
                  <span className={styles.kvKey}>{item.label}</span>
                  <span className={styles.kvValue}>{fmtDateTime(item.at)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>Связи и sync diagnostics</div>
            <div className={styles.kvList}>
              <div className={styles.kvRow}>
                <span className={styles.kvKey}>Внутренний order</span>
                <span className={styles.kvValue}>{order.internalOrderId || '—'}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvKey}>Тип связи</span>
                <span className={styles.kvValue}>{order.internalOrderType || '—'}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvKey}>Последний sync</span>
                <span className={styles.kvValue}>{fmtDateTime(order.syncDiagnostics.lastSyncedAt)}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvKey}>Raw payload</span>
                <span className={styles.kvValue}>
                  {order.syncDiagnostics.rawPayloadPresent ? 'yes' : 'no'}
                </span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvKey}>Ошибка sync</span>
                <span className={styles.kvValue}>{order.syncDiagnostics.syncError || '—'}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
