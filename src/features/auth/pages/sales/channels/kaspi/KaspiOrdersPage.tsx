import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  Download,
  History,
  PackageSearch,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  useDisconnectKaspiConnection,
  useExportKaspiConnection,
  useKaspiConnection,
  useKaspiConnections,
  useKaspiOrdersSummary,
  useSaveKaspiConnection,
  useSyncKaspiOrders,
  useTestKaspiConnection,
} from '@/entities/kaspi/queries';
import type { KaspiConnection, SaveKaspiConnectionDto } from '@/entities/kaspi/types';
import { useRole } from '@/shared/hooks/useRole';
import { Button } from '@/shared/ui/Button';
import { Drawer } from '@/shared/ui/Drawer';
import { Input } from '@/shared/ui/Input';
import {
  formatKaspiDateTime,
  getKaspiStageCount,
  KASPI_STAGE_META,
} from './kaspi-view-model';
import styles from './KaspiOrdersPage.module.css';

// ── Helpers ────────────────────────────────────────────────────────────────

function connectionStatus(connection: KaspiConnection | null | undefined): {
  label: string;
  dotClass: string;
} {
  if (!connection) {
    return { label: 'Не подключено', dotClass: styles.ribbonDotOff };
  }
  if (connection.lastSyncError) {
    return { label: 'Ошибка синхронизации', dotClass: styles.ribbonDotWarn };
  }
  if (connection.isActive) {
    return { label: 'Активно', dotClass: styles.ribbonDotOk };
  }
  return { label: 'Выключено', dotClass: styles.ribbonDotOff };
}

// ── Connection Drawer ──────────────────────────────────────────────────────

interface ConnectionDrawerProps {
  open: boolean;
  onClose: () => void;
  connection: KaspiConnection | null | undefined;
}

function ConnectionDrawer({ open, onClose, connection }: ConnectionDrawerProps) {
  const { isOwner, isAdmin } = useRole();
  const canManage = isOwner || isAdmin;
  const saveConnection = useSaveKaspiConnection();
  const [form, setForm] = useState<SaveKaspiConnectionDto>({
    sellerName: '',
    apiToken: '',
    isActive: true,
  });

  const sellerPlaceholder = connection?.sellerName || 'Kaspi seller';
  const isEdit = !!connection;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Изменить подключение Kaspi' : 'Подключить Kaspi'}
      subtitle={
        isEdit
          ? 'При смене token прошлый магазин уходит в архив, заказы не теряются.'
          : 'Magazine читается в read-only режиме.'
      }
      size="md"
      footer={
        canManage ? (
          <div className={styles.formFooter}>
            <Button variant="ghost" onClick={onClose}>Отмена</Button>
            <Button
              variant="primary"
              icon={<ShieldCheck size={14} />}
              onClick={() =>
                saveConnection.mutate(
                  {
                    sellerName:
                      (form.sellerName ?? connection?.sellerName ?? '').trim() || undefined,
                    apiToken: form.apiToken,
                    isActive: true,
                  },
                  { onSuccess: () => onClose() },
                )
              }
              disabled={saveConnection.isPending || !(form.apiToken ?? '').trim()}
              loading={saveConnection.isPending}
            >
              {isEdit ? 'Подвязать другой token' : 'Подключить магазин'}
            </Button>
          </div>
        ) : null
      }
    >
      {!canManage && (
        <div className={styles.formNote}>
          Подключение Kaspi должен настроить владелец или администратор.
        </div>
      )}
      {canManage && (
        <div className={styles.formGrid}>
          <Input
            label="Название магазина"
            value={form.sellerName ?? ''}
            onChange={(e) => setForm((current) => ({ ...current, sellerName: e.target.value }))}
            placeholder={sellerPlaceholder}
          />
          <Input
            label="API token"
            value={form.apiToken ?? ''}
            onChange={(e) => setForm((current) => ({ ...current, apiToken: e.target.value }))}
            placeholder="X-Auth-Token"
            type="password"
            required
          />
          {isEdit && (
            <div className={styles.formNote}>
              Текущий магазин: <strong>{connection.sellerName || '—'}</strong> · token{' '}
              <span className={styles.mono}>{connection.tokenMasked}</span>.
              При сохранении новый token заменит старый.
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

// ── History Drawer ─────────────────────────────────────────────────────────

interface HistoryDrawerProps {
  open: boolean;
  onClose: () => void;
}

function HistoryDrawer({ open, onClose }: HistoryDrawerProps) {
  const { data: connections, isLoading } = useKaspiConnections();
  const exportConnection = useExportKaspiConnection();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="История магазинов Kaspi"
      subtitle="После смены token старый магазин уходит в архив. Записи сохраняются и могут быть выгружены в Excel."
      size="lg"
    >
      {isLoading ? (
        <div className={styles.statePanel}>
          <RefreshCw size={22} />
          <div>Загрузка истории...</div>
        </div>
      ) : (connections ?? []).length === 0 ? (
        <div className={styles.statePanel}>
          <PackageSearch size={22} />
          <div>Истории подключений пока нет.</div>
        </div>
      ) : (
        <div className={styles.historyList}>
          {(connections ?? []).map((connection) => (
            <div
              key={connection.id}
              className={`${styles.historyRow} ${connection.isActive ? styles.historyRowActive : ''}`}
            >
              <div className={styles.historyMain}>
                <div className={styles.historyTitle}>
                  {connection.sellerName || '—'}
                  {' '}
                  <span className={`${styles.badge} ${connection.isActive ? styles.statusGood : styles.statusDefault}`}>
                    {connection.isActive ? 'Текущий' : 'Архив'}
                  </span>
                </div>
                <div className={`${styles.historySub} ${styles.mono}`}>{connection.tokenMasked}</div>
                <div className={styles.historyCounters}>
                  <span>заказов: <strong>{connection.ordersCount}</strong></span>
                  <span>completed: <strong>{connection.completedOrdersCount}</strong></span>
                  <span>cancelled: <strong>{connection.cancelledOrdersCount}</strong></span>
                </div>
                <div className={styles.historySub}>
                  обновлён в Kaspi: {formatKaspiDateTime(connection.lastOrderUpdateAt)}
                  {' · '}
                  {connection.isActive ? 'обновлён' : 'архив'}: {formatKaspiDateTime(connection.archivedAt || connection.updatedAt)}
                </div>
              </div>
              <div className={styles.historyActions}>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download size={14} />}
                  onClick={() => exportConnection.mutate(connection.id)}
                  disabled={exportConnection.isPending}
                  loading={exportConnection.isPending}
                >
                  XLSX
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}

// ── Layout ─────────────────────────────────────────────────────────────────

export default function KaspiOrdersLayout() {
  const { isOwner, isAdmin } = useRole();
  const canManage = isOwner || isAdmin;
  const location = useLocation();
  const { data: connection, isLoading: isConnLoading } = useKaspiConnection();
  const disconnectConnection = useDisconnectKaspiConnection();
  const testConnection = useTestKaspiConnection();
  const syncOrders = useSyncKaspiOrders();
  const summaryQuery = useKaspiOrdersSummary();
  const summary = summaryQuery.data;

  const [showConnectionDrawer, setShowConnectionDrawer] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  const status = useMemo(() => connectionStatus(connection), [connection]);

  const totalCount = summary?.total ?? 0;

  const isOnStock = location.pathname.endsWith('/sales/kaspi/stock');

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Store size={20} />
          <span>Kaspi заказы</span>
        </div>
        <div className={styles.headerSub}>
          Отдельный operational surface — без manual create/edit flow и без dashboard-витрин.
        </div>
      </div>

      {/* Connection ribbon */}
      <div className={styles.ribbon}>
        <div className={styles.ribbonStatus}>
          <span className={`${styles.ribbonDot} ${status.dotClass}`} />
          {isConnLoading ? 'Загрузка...' : status.label}
        </div>
        {connection && (
          <>
            <div className={styles.ribbonSeparator} />
            <div className={styles.ribbonMeta}>
              <Store size={13} />
              <strong>{connection.sellerName || '—'}</strong>
            </div>
            <div className={styles.ribbonSeparator} />
            <div className={styles.ribbonMeta}>
              <span>token</span>
              <span className={styles.ribbonMono}>{connection.tokenMasked}</span>
            </div>
            <div className={styles.ribbonSeparator} />
            <div className={styles.ribbonMeta}>
              <span>последний sync</span>
              <strong>{formatKaspiDateTime(connection.lastSyncAt)}</strong>
            </div>
          </>
        )}

        <div className={styles.ribbonActions}>
          <Button
            variant="ghost"
            size="sm"
            icon={<History size={14} />}
            onClick={() => setShowHistoryDrawer(true)}
          >
            История
          </Button>
          {canManage && connection && (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={<ShieldCheck size={14} />}
                onClick={() => testConnection.mutate()}
                disabled={testConnection.isPending}
                loading={testConnection.isPending}
              >
                Проверить
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<PlugZap size={14} />}
                onClick={() => disconnectConnection.mutate()}
                disabled={disconnectConnection.isPending}
              >
                Отвязать
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<RefreshCw size={14} />}
                onClick={() => syncOrders.mutate()}
                disabled={syncOrders.isPending}
                loading={syncOrders.isPending}
              >
                Синхронизировать
              </Button>
            </>
          )}
          {canManage && (
            <Button
              variant={connection ? 'secondary' : 'primary'}
              size="sm"
              icon={<PlugZap size={14} />}
              onClick={() => setShowConnectionDrawer(true)}
            >
              {connection ? 'Изменить token' : 'Подключить магазин'}
            </Button>
          )}
        </div>

        {connection?.lastSyncError && (
          <div className={styles.ribbonError}>
            <AlertTriangle size={12} />
            <span>Ошибка sync: {connection.lastSyncError}</span>
          </div>
        )}
      </div>

      {/* Stat bar — clickable KPI tiles */}
      <div className={styles.statBar}>
        {KASPI_STAGE_META.map((item) => {
          const count = summaryQuery.isLoading || summaryQuery.isError
            ? '—'
            : getKaspiStageCount(summary, item.key);
          const active = location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.key}
              to={item.to}
              className={`${styles.statTile} ${active ? styles.statTileActive : ''}`}
            >
              <div className={styles.statLabel}>{item.label}</div>
              <div className={styles.statValue}>{count}</div>
              <div className={styles.statDesc}>{item.description}</div>
            </NavLink>
          );
        })}
      </div>

      {/* Tab bar (mirrors OrdersPage) */}
      <div className={styles.tabBar}>
        {KASPI_STAGE_META.map((item) => {
          const count = summaryQuery.isLoading || summaryQuery.isError
            ? null
            : getKaspiStageCount(summary, item.key);
          const isActive = location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.key}
              to={item.to}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
            >
              {item.key === 'stock' ? <PackageSearch size={13} /> : null}
              <span>{item.label}</span>
              {count !== null && <span className={styles.tabBadge}>{count}</span>}
            </NavLink>
          );
        })}
        <div className={styles.tabBarSummary}>
          <span className={styles.toolbarCount}>
            всего синхронизировано: <strong>{summaryQuery.isLoading ? '—' : totalCount}</strong>
          </span>
        </div>
      </div>

      {/* Indicate stock route in tabBar via a visual highlight already; the
          summary errors land here (above outlet) so sub-pages stay clean. */}
      {summaryQuery.isError && !isOnStock && (
        <div className={styles.toolbarNote}>
          <AlertTriangle size={13} />
          <span>Не удалось загрузить summary. Если sync даёт timeout — это отдельно видно, а не маскируется нулями.</span>
        </div>
      )}

      {/* Sub-page outlet */}
      <Outlet />

      {/* Drawers */}
      <ConnectionDrawer
        open={showConnectionDrawer}
        onClose={() => setShowConnectionDrawer(false)}
        connection={connection}
      />
      <HistoryDrawer
        open={showHistoryDrawer}
        onClose={() => setShowHistoryDrawer(false)}
      />
    </div>
  );
}
