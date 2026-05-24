import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageSearch, RefreshCw } from 'lucide-react';
import { useKaspiOrders } from '@/entities/kaspi/queries';
import type { KaspiOrder } from '@/entities/kaspi/types';
import { SearchInput } from '@/shared/ui/SearchInput';
import { EmptyState } from '@/shared/ui/EmptyState';
import {
  buildKaspiIssueLabel,
  formatKaspiDateTime,
  formatKaspiMoney,
  getKaspiStatusTone,
  getKaspiStockTone,
  KASPI_STAGE_META,
  matchesKaspiSearch,
  matchesKaspiStage,
  type KaspiStageKey,
} from './kaspi-view-model';
import styles from './KaspiOrdersPage.module.css';

type StagePageProps = {
  stage: Exclude<KaspiStageKey, 'stock'>;
};

function statusToneClass(tone: ReturnType<typeof getKaspiStatusTone>) {
  if (tone === 'good') return styles.statusGood;
  if (tone === 'warn') return styles.statusWarn;
  if (tone === 'bad') return styles.statusBad;
  if (tone === 'info') return styles.statusInfo;
  return styles.statusDefault;
}

function stockToneClass(tone: ReturnType<typeof getKaspiStockTone>) {
  if (tone === 'good') return styles.statusGood;
  if (tone === 'warn') return styles.statusWarn;
  if (tone === 'bad') return styles.statusBad;
  return styles.statusDefault;
}

function renderIssueColumn(order: KaspiOrder, stage: Exclude<KaspiStageKey, 'stock'>) {
  if (stage !== 'issues') {
    return (
      <div className={styles.stack}>
        <span>{formatKaspiDateTime(order.lastExternalUpdateAt)}</span>
        <span className={styles.metaLabel}>{order.syncError || '—'}</span>
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <span>{buildKaspiIssueLabel(order)}</span>
      <span className={styles.metaLabel}>{order.syncError || order.stockImpactState}</span>
    </div>
  );
}

export default function KaspiStagePage({ stage }: StagePageProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data: ordersData, isLoading, isError } = useKaspiOrders({ limit: 500, offset: 0 });

  const stageMeta = KASPI_STAGE_META.find((item) => item.key === stage)!;
  const filteredOrders = useMemo(() => {
    return (ordersData?.results ?? []).filter(
      (order) => matchesKaspiStage(order, stage) && matchesKaspiSearch(order, search),
    );
  }, [ordersData?.results, search, stage]);

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleGroup}>
          <div className={styles.cardTitle}>{stageMeta.label}</div>
          <div className={styles.cardSub}>{stageMeta.description}</div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Номер заказа, клиент, SKU..."
          />
        </div>
        <div className={styles.toolbarSpacer} />
        <span className={styles.toolbarCount}>
          В виде: <strong>{filteredOrders.length}</strong>
        </span>
      </div>

      {isLoading && (
        <div className={styles.statePanel}>
          <RefreshCw size={22} />
          <div>Загрузка Kaspi заказов...</div>
        </div>
      )}

      {isError && (
        <EmptyState
          icon={<PackageSearch size={36} />}
          title="Не удалось загрузить Kaspi заказы"
          description="Проверьте подключение и попробуйте синхронизировать ещё раз."
        />
      )}

      {!isLoading && !isError && filteredOrders.length === 0 && (
        <EmptyState
          icon={<PackageSearch size={36} />}
          title="Нет заказов под текущие фильтры"
          description="Попробуйте другую вкладку или поиск."
        />
      )}

      {!isLoading && !isError && filteredOrders.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Заказ</th>
                <th>Клиент</th>
                <th>Статус Kaspi</th>
                <th>Склад / match</th>
                <th>Сумма</th>
                <th>{stage === 'issues' ? 'Проблема' : 'Обновлено'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr
                  key={order.externalOrderId}
                  className={styles.rowButton}
                  onClick={() => navigate(`/sales/kaspi/${order.externalOrderId}`)}
                >
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.primaryCell}>
                        {order.externalOrderCode || order.externalOrderId}
                      </span>
                      <span className={`${styles.metaLabel} ${styles.mono}`}>
                        {order.externalOrderId}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.primaryCell}>{order.customerName || '—'}</span>
                      <span className={styles.metaLabel}>{order.customerPhone || '—'}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.badgeRow}>
                      <span className={`${styles.badge} ${statusToneClass(getKaspiStatusTone(order))}`}>
                        {order.externalStatus || '—'}
                      </span>
                      <span className={`${styles.badge} ${styles.statusDefault}`}>
                        {order.externalState || '—'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.badgeRow}>
                      <span className={`${styles.badge} ${order.matchState === 'matched' ? styles.statusGood : styles.statusWarn}`}>
                        {order.matchState}
                      </span>
                      <span className={`${styles.badge} ${stockToneClass(getKaspiStockTone(order))}`}>
                        {order.stockImpactState}
                      </span>
                    </div>
                  </td>
                  <td>{formatKaspiMoney(order.totalPrice)}</td>
                  <td>{renderIssueColumn(order, stage === 'issues' ? 'issues' : stage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
