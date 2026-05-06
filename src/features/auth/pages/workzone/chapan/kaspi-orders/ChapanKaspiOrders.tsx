import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, PackageSearch, RefreshCw, ShieldCheck, Store } from 'lucide-react';
import {
  useKaspiConnection,
  useKaspiOrders,
  useKaspiOrdersSummary,
  useSaveKaspiConnection,
  useSyncKaspiOrders,
  useTestKaspiConnection,
} from '../../../../../../entities/kaspi/queries';
import type { KaspiOrder, SaveKaspiConnectionDto } from '../../../../../../entities/kaspi/types';
import { useRole } from '../../../../../../shared/hooks/useRole';
import styles from './ChapanKaspiOrders.module.css';

type PresetKey = 'all' | 'new' | 'accepted' | 'handoff' | 'completed' | 'cancelled' | 'issues';

const PRESETS: Array<{ key: PresetKey; label: string }> = [
  { key: 'all', label: '\u0412\u0441\u0435' },
  { key: 'new', label: '\u041d\u043e\u0432\u044b\u0435' },
  { key: 'accepted', label: '\u041f\u0440\u0438\u043d\u044f\u0442\u044b\u0435' },
  { key: 'handoff', label: '\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430' },
  { key: 'completed', label: '\u0417\u0430\u0432\u0435\u0440\u0448\u0451\u043d\u043d\u044b\u0435' },
  { key: 'cancelled', label: '\u041e\u0442\u043c\u0435\u043d\u0430 / \u0432\u043e\u0437\u0432\u0440\u0430\u0442' },
  { key: 'issues', label: '\u041f\u0440\u043e\u0431\u043b\u0435\u043c\u044b' },
];

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

function getStatusTone(order: KaspiOrder) {
  if (order.externalStatus === 'COMPLETED') {
    return styles.statusGood;
  }
  if (order.externalStatus === 'CANCELLED' || order.externalStatus === 'RETURNED') {
    return styles.statusBad;
  }
  if (order.externalStatus === 'ACCEPTED_BY_MERCHANT') {
    return styles.statusInfo;
  }
  if (order.externalStatus === 'APPROVED_BY_BANK') {
    return styles.statusWarn;
  }
  return styles.statusDefault;
}

function getStockTone(order: KaspiOrder) {
  if (order.stockImpactState === 'reserved' || order.stockImpactState === 'released') {
    return styles.statusGood;
  }
  if (order.stockImpactState === 'pending_reservation' || order.stockImpactState === 'partial_reserved') {
    return styles.statusWarn;
  }
  if (order.stockImpactState === 'no_match' || order.stockImpactState === 'no_active_site') {
    return styles.statusBad;
  }
  return styles.statusDefault;
}

function matchesPreset(order: KaspiOrder, preset: PresetKey) {
  if (preset === 'all') {
    return true;
  }
  if (preset === 'new') {
    return order.externalStatus === 'APPROVED_BY_BANK';
  }
  if (preset === 'accepted') {
    return order.externalStatus === 'ACCEPTED_BY_MERCHANT' && (!order.externalState || order.externalState === 'NEW' || order.externalState === 'SIGN_REQUIRED');
  }
  if (preset === 'handoff') {
    return order.externalStatus === 'ACCEPTED_BY_MERCHANT' && !!order.externalState && ['PICKUP', 'DELIVERY', 'KASPI_DELIVERY', 'ARCHIVE'].includes(order.externalState);
  }
  if (preset === 'completed') {
    return order.externalStatus === 'COMPLETED';
  }
  if (preset === 'cancelled') {
    return order.externalStatus === 'CANCELLED' || order.externalStatus === 'RETURNED' || order.externalStatus === 'CANCELLING';
  }

  return order.matchState !== 'matched'
    || !['pending_acceptance', 'reserved', 'released'].includes(order.stockImpactState);
}

function matchesSearch(order: KaspiOrder, search: string) {
  if (!search.trim()) {
    return true;
  }

  const term = search.trim().toLowerCase();
  return [
    order.externalOrderCode,
    order.externalOrderId,
    order.customerName,
    order.customerPhone,
    ...order.matchedItems.map((item) => item.productName),
    ...order.unmatchedItems.map((item) => item.productName),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term));
}

function ConnectionPanel() {
  const { isOwner, isAdmin } = useRole();
  const canManage = isOwner || isAdmin;
  const { data: connection, isLoading } = useKaspiConnection();
  const saveConnection = useSaveKaspiConnection();
  const testConnection = useTestKaspiConnection();
  const syncOrders = useSyncKaspiOrders();
  const [form, setForm] = useState<SaveKaspiConnectionDto>({
    sellerName: '',
    apiToken: '',
    isActive: true,
  });

  if (isLoading) {
    return (
      <section className={styles.panel}>
        <div className={styles.panelTitle}>{'\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 Kaspi'}</div>
      </section>
    );
  }

  if (!connection) {
    return (
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelTitle}>{'\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 Kaspi'}</div>
            <div className={styles.panelSub}>{'\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043d\u0443\u0436\u0435\u043d API token \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430.'}</div>
          </div>
        </div>

        {canManage ? (
          <>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="kaspi-seller-name">{'\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430'}</label>
                <input
                  id="kaspi-seller-name"
                  value={form.sellerName ?? ''}
                  onChange={(event) => setForm((current) => ({ ...current, sellerName: event.target.value }))}
                  placeholder="Kaspi seller"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="kaspi-api-token">API token</label>
                <input
                  id="kaspi-api-token"
                  value={form.apiToken}
                  onChange={(event) => setForm((current) => ({ ...current, apiToken: event.target.value }))}
                  placeholder="X-Auth-Token"
                />
              </div>
            </div>
            <div className={styles.headerActions}>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonPrimary}`}
                onClick={() => saveConnection.mutate(form)}
                disabled={saveConnection.isPending || !form.apiToken.trim()}
              >
                <ShieldCheck size={14} />
                <span>{'\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0442\u043e\u043a\u0435\u043d'}</span>
              </button>
            </div>
          </>
        ) : (
          <div className={styles.empty}>
            <Store size={24} />
            <div>{'\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 Kaspi \u0434\u043e\u043b\u0436\u0435\u043d \u043d\u0430\u0441\u0442\u0440\u043e\u0438\u0442\u044c admin \u0438\u043b\u0438 owner.'}</div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelTitle}>{'\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 Kaspi'}</div>
          <div className={styles.panelSub}>{'\u0427\u0442\u0435\u043d\u0438\u0435 \u0437\u0430\u043a\u0430\u0437\u043e\u0432 \u0438 \u0438\u0445 \u0441\u0442\u0430\u0442\u0443\u0441\u043e\u0432 \u0431\u0435\u0437 lifecycle-control.'}</div>
        </div>
        {canManage && (
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.button}
              onClick={() => testConnection.mutate()}
              disabled={testConnection.isPending}
            >
              <ShieldCheck size={14} />
              <span>{'\u041f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c'}</span>
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonPrimary}`}
              onClick={() => syncOrders.mutate()}
              disabled={syncOrders.isPending}
            >
              <RefreshCw size={14} />
              <span>{'\u0421\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u0442\u044c'}</span>
            </button>
          </div>
        )}
      </div>

      <div className={styles.metaGrid}>
        <div className={styles.metaCard}>
          <div className={styles.metaLabel}>{'\u041f\u0440\u043e\u0434\u0430\u0432\u0435\u0446'}</div>
          <div className={styles.metaValue}>{connection.sellerName || '—'}</div>
        </div>
        <div className={styles.metaCard}>
          <div className={styles.metaLabel}>Token</div>
          <div className={`${styles.metaValue} ${styles.mono}`}>{connection.tokenMasked}</div>
        </div>
        <div className={styles.metaCard}>
          <div className={styles.metaLabel}>{'\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 sync'}</div>
          <div className={styles.metaValue}>{fmtDateTime(connection.lastSyncAt)}</div>
        </div>
        <div className={styles.metaCard}>
          <div className={styles.metaLabel}>{'\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u044f\u044f \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0430'}</div>
          <div className={styles.metaValue}>{fmtDateTime(connection.lastCheckedAt)}</div>
        </div>
      </div>

      {connection.lastSyncError && (
        <div className={`${styles.badge} ${styles.statusBad}`}>{connection.lastSyncError}</div>
      )}
    </section>
  );
}

export default function ChapanKaspiOrdersPage() {
  const navigate = useNavigate();
  const [preset, setPreset] = useState<PresetKey>('all');
  const [search, setSearch] = useState('');
  const { data: ordersData, isLoading, isError } = useKaspiOrders({ limit: 200, offset: 0 });
  const { data: summary } = useKaspiOrdersSummary();

  const filteredOrders = useMemo(() => {
    return (ordersData?.results ?? []).filter((order) => matchesPreset(order, preset) && matchesSearch(order, search));
  }, [ordersData?.results, preset, search]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleWrap}>
          <div className={styles.title}>
            <Store size={20} />
            <span>{'Kaspi \u0437\u0430\u043a\u0430\u0437\u044b'}</span>
          </div>
          <div className={styles.subtitle}>
            {'\u041e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0439 read-only surface \u0434\u043b\u044f marketplace lifecycle \u0438 stock tracking.'}
          </div>
        </div>
      </header>

      <ConnectionPanel />

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelTitle}>{'\u0421\u0432\u043e\u0434\u043a\u0430'}</div>
            <div className={styles.panelSub}>{'\u0411\u044b\u0441\u0442\u0440\u044b\u0435 \u0441\u0447\u0451\u0442\u0447\u0438\u043a\u0438 \u043f\u043e Kaspi lifecycle.'}</div>
          </div>
        </div>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue}>{summary?.total ?? 0}</div>
            <div className={styles.summaryLabel}>{'\u0412\u0441\u0435 \u0437\u0430\u043a\u0430\u0437\u044b'}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue}>{summary?.newOrNeedsAcceptance ?? 0}</div>
            <div className={styles.summaryLabel}>{'\u041d\u043e\u0432\u044b\u0435 / \u043d\u0430 \u043f\u0440\u0438\u043d\u044f\u0442\u0438\u0435'}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue}>{summary?.accepted ?? 0}</div>
            <div className={styles.summaryLabel}>{'\u041f\u0440\u0438\u043d\u044f\u0442\u044b\u0435'}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue}>{summary?.handoffOrDeliveryInProgress ?? 0}</div>
            <div className={styles.summaryLabel}>{'\u041f\u0435\u0440\u0435\u0434\u0430\u0447\u0430 / \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0430'}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue}>{summary?.completed ?? 0}</div>
            <div className={styles.summaryLabel}>{'\u0417\u0430\u0432\u0435\u0440\u0448\u0451\u043d\u043d\u044b\u0435'}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue}>{summary?.unmatchedOrStockIssues ?? 0}</div>
            <div className={styles.summaryLabel}>{'\u041f\u0440\u043e\u0431\u043b\u0435\u043c\u044b \u0441 match / stock'}</div>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelTitle}>{'\u0421\u043f\u0438\u0441\u043e\u043a Kaspi \u0437\u0430\u043a\u0430\u0437\u043e\u0432'}</div>
            <div className={styles.panelSub}>{'\u0411\u0435\u0437 create/edit actions. \u0422\u043e\u043b\u044c\u043a\u043e tracking, matching \u0438 sync diagnostics.'}</div>
          </div>
          <div className={`${styles.badge} ${styles.statusDefault}`}>
            <Activity size={12} />
            <span>{filteredOrders.length}</span>
          </div>
        </div>

        <div className={styles.toolbar}>
          <input
            className={styles.search}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Order code / customer / sku"
          />
          <div className={styles.presetRow}>
            {PRESETS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`${styles.chip} ${preset === item.key ? styles.chipActive : ''}`}
                onClick={() => setPreset(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className={styles.empty}>
            <RefreshCw size={22} />
            <div>{'\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 Kaspi \u0437\u0430\u043a\u0430\u0437\u043e\u0432...'}</div>
          </div>
        )}

        {isError && (
          <div className={styles.empty}>
            <PackageSearch size={22} />
            <div>{'\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c Kaspi \u0437\u0430\u043a\u0430\u0437\u044b.'}</div>
          </div>
        )}

        {!isLoading && !isError && filteredOrders.length === 0 && (
          <div className={styles.empty}>
            <PackageSearch size={22} />
            <div>{'\u041f\u043e \u0442\u0435\u043a\u0443\u0449\u0438\u043c \u0444\u0438\u043b\u044c\u0442\u0440\u0430\u043c \u043d\u0435\u0442 Kaspi \u0437\u0430\u043a\u0430\u0437\u043e\u0432.'}</div>
          </div>
        )}

        {!isLoading && !isError && filteredOrders.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{'\u0417\u0430\u043a\u0430\u0437'}</th>
                  <th>{'\u041a\u043b\u0438\u0435\u043d\u0442'}</th>
                  <th>{'\u0421\u0442\u0430\u0442\u0443\u0441 Kaspi'}</th>
                  <th>{'Match / stock'}</th>
                  <th>{'\u0421\u0443\u043c\u043c\u0430'}</th>
                  <th>{'\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 update'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr
                    key={order.externalOrderId}
                    className={styles.rowButton}
                    onClick={() => navigate(`/workzone/chapan/kaspi-orders/${order.externalOrderId}`)}
                  >
                    <td>
                      <div className={styles.stack}>
                        <strong>{order.externalOrderCode || order.externalOrderId}</strong>
                        <span className={`${styles.metaLabel} ${styles.mono}`}>{order.externalOrderId}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.stack}>
                        <strong>{order.customerName || '—'}</strong>
                        <span className={styles.metaLabel}>{order.customerPhone || '—'}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.badgeRow}>
                        <span className={`${styles.badge} ${getStatusTone(order)}`}>
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
                        <span className={`${styles.badge} ${getStockTone(order)}`}>
                          {order.stockImpactState}
                        </span>
                      </div>
                    </td>
                    <td>{fmtMoney(order.totalPrice)}</td>
                    <td>
                      <div className={styles.stack}>
                        <span>{fmtDateTime(order.lastExternalUpdateAt)}</span>
                        {order.syncError && <span className={styles.metaLabel}>{order.syncError}</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
