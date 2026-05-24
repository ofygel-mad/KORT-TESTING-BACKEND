import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, PackageSearch, RefreshCw } from 'lucide-react';
import { useKaspiOrders } from '@/entities/kaspi/queries';
import { SearchInput } from '@/shared/ui/SearchInput';
import { EmptyState } from '@/shared/ui/EmptyState';
import {
  buildKaspiStockRows,
  formatKaspiDateTime,
  formatKaspiMoney,
  matchesKaspiStockRow,
} from './kaspi-view-model';
import styles from './KaspiOrdersPage.module.css';

type StockFilterKey = 'all' | 'attention' | 'matched' | 'reserved';

const STOCK_FILTERS: Array<{ key: StockFilterKey; label: string }> = [
  { key: 'all', label: 'Все позиции' },
  { key: 'attention', label: 'Требуют внимания' },
  { key: 'matched', label: 'С match' },
  { key: 'reserved', label: 'С reserve / consume' },
];

function matchesStockFilter(
  key: StockFilterKey,
  row: ReturnType<typeof buildKaspiStockRows>[number],
) {
  if (key === 'all') {
    return true;
  }
  if (key === 'attention') {
    return (
      row.item.matchState !== 'matched'
      || !['reserved', 'released', 'pending_acceptance', 'not_tracked'].includes(row.item.stockImpactState)
      || !!row.item.matchReason
    );
  }
  if (key === 'matched') {
    return row.item.matchState === 'matched';
  }
  return row.item.reservationStatus === 'active' || row.item.reservationStatus === 'consumed';
}

export default function KaspiStockPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilterKey>('attention');
  const { data: ordersData, isLoading, isError } = useKaspiOrders({ limit: 500, offset: 0 });

  const rows = useMemo(() => {
    return buildKaspiStockRows(ordersData?.results ?? [])
      .filter((row) => matchesStockFilter(filter, row) && matchesKaspiStockRow(row, search));
  }, [filter, ordersData?.results, search]);

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleGroup}>
          <div className={styles.cardTitle}>Склад Kaspi</div>
          <div className={styles.cardSub}>
            Отдельный реестр SKU, match и reservations для Kaspi — без вмешательства в общий warehouse UI.
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="SKU, товар, заказ, клиент..."
          />
        </div>
        <div className={styles.chipRow}>
          {STOCK_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`${styles.chip} ${filter === item.key ? styles.chipActive : ''}`}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className={styles.toolbarSpacer} />
        <span className={styles.toolbarCount}>
          Строк: <strong>{rows.length}</strong>
        </span>
      </div>

      <div className={styles.toolbarNote}>
        <Activity size={13} />
        <span>Если merchant SKU не совпадает с warehouse SKU, позиция остаётся здесь как unmatched.</span>
      </div>

      {isLoading && (
        <div className={styles.statePanel}>
          <RefreshCw size={22} />
          <div>Загрузка Kaspi stock registry...</div>
        </div>
      )}

      {isError && (
        <EmptyState
          icon={<PackageSearch size={36} />}
          title="Не удалось загрузить Kaspi stock registry"
          description="Проверьте подключение и попробуйте синхронизировать ещё раз."
        />
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState
          icon={<PackageSearch size={36} />}
          title="По текущим фильтрам нет позиций"
          description="Попробуйте другой фильтр или поиск."
        />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Заказ</th>
                <th>Товар</th>
                <th>SKU</th>
                <th>Кол-во / сумма</th>
                <th>Match / stock</th>
                <th>Резерв / status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.orderId}:${row.item.externalEntryId}`}
                  className={styles.rowButton}
                  onClick={() => navigate(`/sales/kaspi/${row.orderId}`)}
                >
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.primaryCell}>{row.orderCode || row.orderId}</span>
                      <span className={styles.metaLabel}>
                        {row.customerName || row.customerPhone || '—'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.primaryCell}>{row.item.productName || '—'}</span>
                      <span className={styles.metaLabel}>
                        {row.item.manufacturer || row.item.categoryTitle || '—'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.mono}>{row.item.merchantSku || '—'}</span>
                      <span className={styles.metaLabel}>{row.item.warehouseSku || '—'}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <span>{row.item.quantity ?? '—'}</span>
                      <span className={styles.metaLabel}>{formatKaspiMoney(row.item.totalPrice)}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <span>{row.item.matchState}</span>
                      <span className={styles.metaLabel}>
                        {row.item.matchReason || row.item.stockImpactState}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <span>{row.item.reservationStatus || '—'}</span>
                      <span className={styles.metaLabel}>
                        {row.externalStatus || '—'} / {formatKaspiDateTime(row.lastExternalUpdateAt)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
