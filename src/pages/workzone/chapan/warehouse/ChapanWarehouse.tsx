import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle, AlertTriangle, Archive, CheckCircle2, ChevronRight, Download,
  FileText, Package, PackageCheck, Phone, Plus, RotateCcw, Search, Send, TrendingDown, User, Upload, X, XCircle, CheckSquare, BookOpen,
} from 'lucide-react';
import { WarehouseCatalog } from '../../../warehouse/WarehouseCatalog';
import {
  useWarehouseItems, useWarehouseMovements, useWarehouseAlerts,
  useWarehouseCategories, useCreateItem, useAddMovement, useDeleteItem, useResolveAlert,
  useWarehouseFoundationSites, useWarehouseFoundationSiteControlTower, useWarehouseFoundationSiteHealth,
  useImportOpeningBalance,
} from '../../../../entities/warehouse/queries';
import {
  useInvoices, useConfirmWarehouse, useOrders, useShipOrder, useOrder, useArchiveInvoice,
  useCloseOrder, useReturnToReady, useRejectInvoice,
} from '../../../../entities/order/queries';
import type { WarehouseItem, MovementType, CreateItemDto, AddMovementDto, ImportOpeningBalanceRow } from '../../../../entities/warehouse/types';
import type { ChapanInvoice, ChapanOrder } from '../../../../entities/order/types';
import { getStockStatus } from '../../../../entities/warehouse/types';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { exportToCSV } from '../../../../shared/lib/export';
import { toast } from 'sonner';
import styles from '../../../warehouse/Warehouse.module.css';

type Tab = 'incoming' | 'invoice_archive' | 'orders_wh' | 'to_ship' | 'shipped' | 'items' | 'movements' | 'alerts' | 'catalog';

const MOVEMENT_LABEL: Record<MovementType, string> = {
  in: 'Приход', out: 'Расход', adjustment: 'Корректировка', write_off: 'Списание', return: 'Возврат',
};
const MOVEMENT_COLOR: Record<MovementType, string> = {
  in: 'var(--fill-positive)', out: 'var(--fill-negative)', adjustment: 'var(--fill-warning)',
  write_off: 'var(--fill-negative)', return: 'var(--fill-info)',
};

const PAY_LABEL: Record<string, string> = {
  not_paid: 'Не оплачен', partial: 'Частично оплачен', paid: 'Оплачен',
};
const PAY_COLOR: Record<string, string> = {
  not_paid: 'var(--fill-negative)', partial: 'var(--fill-warning)', paid: 'var(--fill-positive)',
};
const URGENCY_LABEL: Record<string, string> = { normal: '', urgent: '🔴 Срочно' };
const URGENCY_COLOR: Record<string, string> = { normal: 'var(--text-tertiary)', urgent: '#D94F4F' };
const DEMANDING_LABEL = '⭐ Требовательный';
const DEMANDING_COLOR = '#C9A84C';
const DATE_FORMATTER = new Intl.DateTimeFormat('ru-KZ', { day: '2-digit', month: 'short', year: 'numeric' });
const NUMBER_FORMATTER = new Intl.NumberFormat('ru-KZ');
const MONEY_FORMATTER = new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 });

function fmtDate(s: string) {
  return DATE_FORMATTER.format(new Date(s));
}
function fmtNum(n: number) { return NUMBER_FORMATTER.format(n); }
function fmtMoney(n: number) {
  return MONEY_FORMATTER.format(n) + ' ₸';
}

// ── Invoice Detail Drawer ─────────────────────────────────────────────────────

function InvoiceDetailDrawer({ invoice, onClose }: { invoice: ChapanInvoice; onClose: () => void }) {
  const confirmWarehouse = useConfirmWarehouse();
  const archiveInvoice = useArchiveInvoice();
  const rejectInvoice = useRejectInvoice();
  const [downloading, setDownloading] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const alreadyConfirmed = invoice.warehouseConfirmed;
  const alreadyRejected = invoice.status === 'rejected';

  function handleReject() {
    if (!rejectReason.trim()) return;
    rejectInvoice.mutate(
      { id: invoice.id, reason: rejectReason.trim() },
      { onSuccess: () => { setShowRejectForm(false); setRejectReason(''); onClose(); } },
    );
  }

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      const { apiClient } = await import('../../../../shared/api/client');
      const response = await apiClient.get(`/chapan/invoices/${invoice.id}/download`, {
        params: { style: 'branded' },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nakladnaya-${invoice.invoiceNumber}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      archiveInvoice.mutate(invoice.id);
    } finally {
      setDownloading(false);
    }
  }

  const orders = invoice.items?.map((it) => it.order).filter(Boolean) ?? [];

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <div>
            <div className={styles.drawerTitle}>Накладная #{invoice.invoiceNumber}</div>
            <div className={styles.drawerSubtitle}>{fmtDate(invoice.createdAt)} · Создал: {invoice.createdByName}</div>
          </div>
          <button className={styles.drawerClose} onClick={onClose}><X size={14} /></button>
        </div>

        <div className={styles.drawerStatusRow}>
          <div className={styles.drawerStatusItem}>
            {invoice.seamstressConfirmed
              ? <CheckCircle2 size={14} style={{ color: 'var(--fill-positive)', flexShrink: 0 }} />
              : <AlertCircle size={14} style={{ color: 'var(--fill-warning)', flexShrink: 0 }} />}
            <span style={{ color: invoice.seamstressConfirmed ? 'var(--fill-positive)' : 'var(--text-tertiary)' }}>
              {invoice.seamstressConfirmed ? `Цех отправил${invoice.seamstressConfirmedBy ? ` (${invoice.seamstressConfirmedBy})` : ''}` : 'Цех ещё не подтвердил'}
            </span>
          </div>
          <div className={styles.drawerStatusItem}>
            {alreadyConfirmed
              ? <CheckCircle2 size={14} style={{ color: 'var(--fill-positive)', flexShrink: 0 }} />
              : <AlertCircle size={14} style={{ color: 'var(--fill-warning)', flexShrink: 0 }} />}
            <span style={{ color: alreadyConfirmed ? 'var(--fill-positive)' : 'var(--text-tertiary)' }}>
              {alreadyConfirmed ? `Склад принял${invoice.warehouseConfirmedBy ? ` (${invoice.warehouseConfirmedBy})` : ''}` : 'Склад ещё не принял'}
            </span>
          </div>
        </div>

        <div className={styles.drawerBody}>
          {orders.length === 0 && (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>Нет заказов в накладной</div>
          )}

          {orders.map((order) => {
            const orderTotal = order.items?.reduce((s, i) => s + i.quantity * i.unitPrice, 0) ?? order.totalAmount;
            return (
              <div key={order.id} className={styles.invOrderCard}>
                <div className={styles.invOrderHead}>
                  <span className={styles.invOrderNum}>#{order.orderNumber}</span>
                  {(order.urgency ?? order.priority) === 'urgent' && (
                    <span style={{ fontSize: 11, color: URGENCY_COLOR['urgent'], fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: `${URGENCY_COLOR['urgent']}1a` }}>
                      {URGENCY_LABEL['urgent']}
                    </span>
                  )}
                  {(order.isDemandingClient ?? (order.priority === 'vip')) && (
                    <span style={{ fontSize: 11, color: DEMANDING_COLOR, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: `${DEMANDING_COLOR}1a` }}>
                      {DEMANDING_LABEL}
                    </span>
                  )}
                  <div className={styles.invOrderClient}>
                    <User size={12} /> {order.clientName}
                    {order.clientPhone && <><Phone size={12} style={{ marginLeft: 8 }} /> {order.clientPhone}</>}
                  </div>
                </div>

                <div className={styles.drawerTableWrap}>
                  <table>
                    <thead>
                      <tr>
                        {['Модель', 'Размер', 'Кол-во', 'Цена', 'Сумма'].map((h) => (
                          <th key={h} style={{ padding: '6px 14px', fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(order.items ?? []).map((item) => (
                        <tr key={item.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '8px 14px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{item.productName}</td>
                          <td style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.size}</td>
                          <td style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.quantity} шт.</td>
                          <td style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtMoney(item.unitPrice)}</td>
                          <td style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{fmtMoney(item.quantity * item.unitPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.invOrderFoot}>
                  <span style={{ fontSize: 12, color: PAY_COLOR[order.paymentStatus] ?? 'var(--text-tertiary)', fontWeight: 600 }}>
                    {PAY_LABEL[order.paymentStatus] ?? order.paymentStatus}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Итого: {fmtMoney(orderTotal)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.drawerFooter}>
          <button
            className={styles.drawerActionBtn}
            onClick={() => void handleDownload()}
            disabled={downloading}
            style={{ background: 'var(--bg-surface-inset)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            <Download size={15} />
            {downloading ? 'Скачивание...' : 'Скачать накладную'}
          </button>
          {alreadyRejected ? (
            <div className={styles.drawerRejectedNotice}>
              <XCircle size={16} />
              Накладная отклонена{invoice.rejectionReason ? `: ${invoice.rejectionReason}` : ''}
            </div>
          ) : alreadyConfirmed ? (
            <div className={styles.drawerConfirmedNotice}>
              <CheckCircle2 size={16} />
              Накладная принята — товар поступил на склад
            </div>
          ) : showRejectForm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                Причина отклонения
              </div>
              <input
                className={styles.input}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Несоответствие состава, брак, нет сопроводительных документов..."
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleReject(); if (e.key === 'Escape') setShowRejectForm(false); }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={styles.drawerSecondaryBtn}
                  style={{ flex: 1 }}
                  onClick={() => { setShowRejectForm(false); setRejectReason(''); }}
                >
                  Отмена
                </button>
                <button
                  className={`${styles.drawerActionBtn} ${styles.drawerActionBtnDanger}`}
                  style={{ flex: 2 }}
                  onClick={handleReject}
                  disabled={rejectInvoice.isPending || !rejectReason.trim()}
                >
                  <XCircle size={14} />
                  {rejectInvoice.isPending ? 'Отклонение...' : 'Отклонить накладную'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                className={`${styles.drawerActionBtn} ${styles.drawerActionBtnPrimary}`}
                onClick={() => { confirmWarehouse.mutate(invoice.id); onClose(); }}
                disabled={confirmWarehouse.isPending}
              >
                <PackageCheck size={16} />
                {confirmWarehouse.isPending ? 'Подтверждение...' : 'Подтвердить получение товара'}
              </button>
              <button
                className={`${styles.drawerActionBtn} ${styles.drawerActionBtnDanger}`}
                onClick={() => setShowRejectForm(true)}
              >
                <XCircle size={14} />
                Отклонить накладную
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Order Detail Drawer (warehouse view) ──────────────────────────────────────

function OrderDetailDrawer({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { data: order, isLoading } = useOrder(orderId);
  const shipOrder = useShipOrder();
  const closeOrder = useCloseOrder();
  const returnToReady = useReturnToReady();
  const [closeUnpaidWarning, setCloseUnpaidWarning] = useState(false);
  const [showShipForm, setShowShipForm] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [shipFormData, setShipFormData] = useState({
    courierType: '',
    recipientName: '',
    recipientAddress: '',
    shippingNote: '',
  });

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        {isLoading || !order ? (
          <>
            <div className={styles.drawerHeader}>
              <span className={styles.drawerTitle}>Загрузка...</span>
              <button className={styles.drawerClose} onClick={onClose}><X size={14} /></button>
            </div>
            <div className={styles.drawerBody}>
              {[...Array(4)].map((_, i) => <Skeleton key={i} height={48} radius={8} />)}
            </div>
          </>
        ) : (
          <>
            <div className={styles.drawerHeader}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div className={styles.drawerTitle}>#{order.orderNumber}</div>
                  {(order.urgency ?? order.priority) === 'urgent' && (
                    <span style={{ fontSize: 11, color: URGENCY_COLOR['urgent'], fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: `${URGENCY_COLOR['urgent']}1a`, flexShrink: 0 }}>
                      {URGENCY_LABEL['urgent']}
                    </span>
                  )}
                  {(order.isDemandingClient ?? (order.priority === 'vip')) && (
                    <span style={{ fontSize: 11, color: DEMANDING_COLOR, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: `${DEMANDING_COLOR}1a`, flexShrink: 0 }}>
                      {DEMANDING_LABEL}
                    </span>
                  )}
                </div>
                <div className={styles.drawerSubtitle} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={11} /> {order.clientName}</span>
                  {order.clientPhone && <a href={`tel:${order.clientPhone}`} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)', textDecoration: 'none' }}><Phone size={11} /> {order.clientPhone}</a>}
                  {order.dueDate && <span>Срок: {fmtDate(order.dueDate)}</span>}
                </div>
              </div>
              <button className={styles.drawerClose} onClick={onClose}><X size={14} /></button>
            </div>

            <div className={styles.drawerBody}>
              {/* Items */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                  Позиции — {order.items?.length ?? 0} шт.
                </div>
                <div className={styles.drawerTableWrap}>
                  <table>
                    <tbody>
                      {(order.items ?? []).map((item, idx) => (
                        <tr key={item.id} style={{ borderTop: idx > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                          <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                            {item.productName}
                            {item.fabric ? <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> · {item.fabric}</span> : null}
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>р.{item.size}</td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>×{item.quantity}</td>
                          <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {fmtMoney(item.unitPrice * item.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ padding: '9px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-surface)' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Итого: {fmtMoney(order.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Payment */}
              <div className={styles.drawerCard}>
                <div className={styles.drawerCardLabel}>Оплата</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: 13, color: PAY_COLOR[order.paymentStatus], fontWeight: 700 }}>
                    {PAY_LABEL[order.paymentStatus]}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <span style={{ fontSize: 12, color: 'var(--fill-positive)' }}>Оплачено: {fmtMoney(order.paidAmount)}</span>
                    {order.paidAmount < order.totalAmount && (
                      <span style={{ fontSize: 12, color: 'var(--fill-negative)' }}>Остаток: {fmtMoney(order.totalAmount - order.paidAmount)}</span>
                    )}
                  </div>
                </div>
                {order.expectedPaymentMethod && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Ожидаемый способ доплаты: <strong style={{ color: 'var(--text-primary)' }}>{order.expectedPaymentMethod}</strong>
                  </div>
                )}
              </div>

              {/* Invoice link */}
              {(order.invoiceOrders ?? []).length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>Накладная</div>
                  {order.invoiceOrders!.map((io) => (
                    <div key={io.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', padding: '9px 12px', background: 'var(--bg-surface-inset)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                      <FileText size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                      <span>Накладная #{io.invoice.invoiceNumber}</span>
                      <span style={{ marginLeft: 'auto', color: io.invoice.warehouseConfirmed ? 'var(--fill-positive)' : 'var(--fill-warning)', fontWeight: 600, flexShrink: 0 }}>
                        {io.invoice.warehouseConfirmed ? 'Принята' : 'Ожидает приёмки'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* requiresInvoice flag */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--bg-surface-inset)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <FileText size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                <span>Накладная обязательна:</span>
                <strong style={{ marginLeft: 'auto', color: order.requiresInvoice ? 'var(--fill-warning)' : 'var(--fill-positive)', flexShrink: 0 }}>
                  {order.requiresInvoice ? 'Да' : 'Нет'}
                </strong>
              </div>
            </div>

            <div className={styles.drawerFooter}>
              {/* Return-to-Ready form (replaces all other actions when active) */}
              {showReturnForm ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                    Причина возврата в «Готово»
                  </div>
                  <input
                    className={styles.input}
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Несоответствие состава, расхождение по количеству, нет накладной..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setShowReturnForm(false); setReturnReason(''); }
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className={styles.drawerSecondaryBtn}
                      style={{ flex: 1 }}
                      onClick={() => { setShowReturnForm(false); setReturnReason(''); }}
                    >
                      Отмена
                    </button>
                    <button
                      className={`${styles.drawerActionBtn} ${styles.drawerActionBtnDanger}`}
                      style={{ flex: 2 }}
                      onClick={() => {
                        if (!returnReason.trim()) return;
                        returnToReady.mutate({ id: order.id, reason: returnReason.trim() }, { onSuccess: onClose });
                      }}
                      disabled={returnToReady.isPending || !returnReason.trim()}
                    >
                      <RotateCcw size={14} />
                      {returnToReady.isPending ? 'Возврат...' : 'Вернуть в «Готово»'}
                    </button>
                  </div>
                </div>
              ) : order.status === 'shipped' ? (
                <>
                  <button
                    className={`${styles.drawerActionBtn} ${styles.drawerActionBtnSuccess}`}
                    onClick={() => {
                      if (order.paymentStatus !== 'paid') setCloseUnpaidWarning(true);
                      else { closeOrder.mutate(order.id); onClose(); }
                    }}
                    disabled={closeOrder.isPending}
                  >
                    <CheckSquare size={16} />
                    {closeOrder.isPending ? 'Закрытие...' : 'Завершить сделку'}
                  </button>
                  {closeUnpaidWarning && (
                    <div className={styles.drawerUnpaidNote}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                        <strong>Остаток: {fmtMoney(order.totalAmount - order.paidAmount)}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button className={styles.drawerSecondaryBtn} style={{ flex: 1, fontSize: 12 }} onClick={() => setCloseUnpaidWarning(false)}>Отмена</button>
                        <button className={`${styles.drawerActionBtn} ${styles.drawerActionBtnSuccess}`} style={{ flex: 1, fontSize: 12 }} onClick={() => { closeOrder.mutate(order.id); onClose(); }}>Закрыть всё равно</button>
                      </div>
                    </div>
                  )}
                </>
              ) : order.paymentStatus === 'paid' ? (
                <>
                  {showShipForm ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 2 }}>
                        Пометки к отгрузке
                      </div>
                      {[
                        { key: 'courierType',      label: 'Способ доставки',         placeholder: 'Курьер, самовывоз, СДЭК…' },
                        { key: 'recipientName',    label: 'ФИО получателя',          placeholder: 'Иванов Иван Иванович' },
                        { key: 'recipientAddress', label: 'Адрес доставки',          placeholder: 'ул. Абая 10, кв. 5' },
                        { key: 'shippingNote',     label: 'Комментарий по доставке', placeholder: 'Любые дополнительные пометки' },
                      ].map(({ key, label, placeholder }) => (
                        <div key={key}>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>{label}</div>
                          <input
                            style={{
                              width: '100%', boxSizing: 'border-box',
                              padding: '7px 10px', fontSize: 13,
                              background: 'var(--bg-surface-inset)',
                              border: '1px solid var(--border-default)',
                              borderRadius: 6, color: 'var(--text-primary)',
                            }}
                            placeholder={placeholder}
                            value={shipFormData[key as keyof typeof shipFormData]}
                            onChange={(e) => setShipFormData((prev) => ({ ...prev, [key]: e.target.value }))}
                          />
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button
                          className={styles.drawerSecondaryBtn}
                          style={{ flex: 1, fontSize: 12 }}
                          onClick={() => setShowShipForm(false)}
                        >
                          Отмена
                        </button>
                        <button
                          className={`${styles.drawerActionBtn} ${styles.drawerActionBtnSuccess}`}
                          style={{ flex: 2, fontSize: 12 }}
                          disabled={shipOrder.isPending}
                          onClick={() => {
                            shipOrder.mutate({
                              id: order.id,
                              courierType:      shipFormData.courierType.trim()      || undefined,
                              recipientName:    shipFormData.recipientName.trim()    || undefined,
                              recipientAddress: shipFormData.recipientAddress.trim() || undefined,
                              shippingNote:     shipFormData.shippingNote.trim()     || undefined,
                            }, { onSuccess: onClose });
                          }}
                        >
                          <Send size={14} />
                          {shipOrder.isPending ? 'Отправка...' : 'Подтвердить отгрузку'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className={`${styles.drawerActionBtn} ${styles.drawerActionBtnSuccess}`}
                      onClick={() => setShowShipForm(true)}
                    >
                      <Send size={16} />
                      Отправить клиенту
                    </button>
                  )}
                  {!showShipForm && order.status === 'on_warehouse' && (
                    <button
                      className={`${styles.drawerActionBtn} ${styles.drawerActionBtnDanger}`}
                      style={{ fontSize: 12 }}
                      onClick={() => setShowReturnForm(true)}
                    >
                      <RotateCcw size={14} />
                      Вернуть в «Готово»
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className={styles.drawerUnpaidNote}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                      <strong>Заказ не оплачен</strong>
                    </div>
                    <div style={{ marginTop: 4, paddingLeft: 23 }}>
                      Остаток: {fmtMoney(order.totalAmount - order.paidAmount)} — свяжитесь с менеджером
                    </div>
                  </div>
                  {order.status === 'on_warehouse' && (
                    <button
                      className={`${styles.drawerActionBtn} ${styles.drawerActionBtnDanger}`}
                      style={{ fontSize: 12 }}
                      onClick={() => setShowReturnForm(true)}
                    >
                      <RotateCcw size={14} />
                      Вернуть в «Готово»
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Add Item Drawer ────────────────────────────────────────────────────────────

function AddItemDrawer({ onClose }: { onClose: () => void }) {
  const createItem = useCreateItem();
  const { data: catData } = useWarehouseCategories();
  const categories = catData?.results ?? [];
  const [form, setForm] = useState<CreateItemDto>({ name: '', unit: 'шт', qty: 0, qtyMin: 0 });
  const sf = (k: keyof CreateItemDto) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await createItem.mutateAsync({ ...form, qty: Number(form.qty), qtyMin: Number(form.qtyMin) });
    onClose();
  }

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Добавить позицию</span>
          <button className={styles.drawerClose} onClick={onClose}><X size={14} /></button>
        </div>
        <form className={styles.drawerBody} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Название <span className={styles.req}>*</span></label>
            <input className={styles.input} value={form.name} onChange={sf('name')} placeholder="Чапан классик" required autoFocus />
          </div>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>Уникальный номер</label>
              <input className={styles.input} value={form.sku ?? ''} onChange={sf('sku')} placeholder="CHAP-01" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Ед. изм.</label>
              <input className={styles.input} value={form.unit ?? 'шт'} onChange={sf('unit')} placeholder="шт / кг / м" />
            </div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginTop: 4 }}>
            Вариант товара
          </div>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>Цвет</label>
              <input className={styles.input} value={form.color ?? ''} onChange={sf('color')} placeholder="Синий" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Пол</label>
              <input className={styles.input} value={form.gender ?? ''} onChange={sf('gender')} placeholder="Мужской" />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Размер</label>
            <input className={styles.input} value={form.size ?? ''} onChange={sf('size')} placeholder="48, XL, 42-60..." />
          </div>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>Остаток</label>
              <input className={styles.input} type="number" min="0" value={form.qty ?? 0} onChange={sf('qty')} onFocus={(e) => e.target.select()} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Минимум (алерт)</label>
              <input className={styles.input} type="number" min="0" value={form.qtyMin ?? 0} onChange={sf('qtyMin')} onFocus={(e) => e.target.select()} />
            </div>
          </div>
          {categories.length > 0 && (
            <div className={styles.field}>
              <label className={styles.label}>Категория</label>
              <select className={styles.select} value={form.categoryId ?? ''} onChange={sf('categoryId')}>
                <option value="">Без категории</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className={styles.field}>
            <label className={styles.label}>Цена (₸)</label>
            <input className={styles.input} type="number" min="0" value={form.costPrice ?? ''} onChange={sf('costPrice')} placeholder="0" />
          </div>
          <div className={styles.drawerActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Отмена</button>
            <button type="submit" className={styles.submitBtn} disabled={createItem.isPending}>
              {createItem.isPending ? 'Создание...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Movement Drawer ────────────────────────────────────────────────────────

function AddMovementDrawer({ items, preselectItemId, onClose }: { items: WarehouseItem[]; preselectItemId?: string; onClose: () => void }) {
  const addMovement = useAddMovement();
  const [form, setForm] = useState<AddMovementDto>({ itemId: preselectItemId ?? '', type: 'in', qty: 1, reason: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.itemId || !form.qty) return;
    await addMovement.mutateAsync({ ...form, qty: Number(form.qty) });
    onClose();
  }

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Новое движение</span>
          <button className={styles.drawerClose} onClick={onClose}><X size={14} /></button>
        </div>
        <form className={styles.drawerBody} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Тип операции</label>
            <div className={styles.typeGroup}>
              {(['in','out','return','adjustment','write_off'] as MovementType[]).map(t => (
                <button key={t} type="button"
                  className={`${styles.typeBtn} ${form.type === t ? styles.typeBtnActive : ''}`}
                  onClick={() => setForm(f => ({ ...f, type: t }))}
                  style={{ '--tc': MOVEMENT_COLOR[t] } as React.CSSProperties}
                >{MOVEMENT_LABEL[t]}</button>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Позиция <span className={styles.req}>*</span></label>
            <select className={styles.select} value={form.itemId} onChange={e => setForm(f => ({ ...f, itemId: e.target.value }))} required>
              <option value="">Выберите позицию</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </select>
          </div>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>Количество <span className={styles.req}>*</span></label>
              <input className={styles.input} type="number" min="0.01" step="any" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: parseFloat(e.target.value) || 0 }))} onFocus={(e) => e.target.select()} required />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Причина / Комментарий</label>
            <input className={styles.input} value={form.reason ?? ''} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Поступление от поставщика..." />
          </div>
          <div className={styles.drawerActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Отмена</button>
            <button type="submit" className={styles.submitBtn} disabled={addMovement.isPending}>
              {addMovement.isPending ? 'Запись...' : 'Записать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Import Opening Balance Drawer ─────────────────────────────────────────────

const IMPORT_TEMPLATE = 'наименование,цвет,пол,размер,остаток,цена\nЧапан классик,Синий,Мужской,52,10,15000\nЧапан классик,Чёрный,Женский,48,5,14000';

function parseImportCsv(raw: string): ImportOpeningBalanceRow[] {
  const lines = raw.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const nameIdx = header.findIndex(h => h.includes('наим') || h.includes('name') || h.includes('товар') || h.includes('модель'));
  const colorIdx = header.findIndex(h => h.includes('цвет') || h === 'color');
  const genderIdx = header.findIndex(h => h.includes('пол') || h === 'gender');
  const sizeIdx = header.findIndex(h => h.includes('разм') || h === 'size');
  const qtyIdx = header.findIndex(h => h.includes('остат') || h.includes('кол') || h === 'qty' || h === 'quantity');
  const priceIdx = header.findIndex(h => h.includes('цена') || h === 'price' || h === 'cost');

  if (nameIdx === -1 || qtyIdx === -1) return [];

  return lines.slice(1).map(line => {
    const cells = line.split(',').map(c => c.trim());
    return {
      name: cells[nameIdx] ?? '',
      color: colorIdx >= 0 ? (cells[colorIdx] || undefined) : undefined,
      gender: genderIdx >= 0 ? (cells[genderIdx] || undefined) : undefined,
      size: sizeIdx >= 0 ? (cells[sizeIdx] || undefined) : undefined,
      qty: parseFloat(cells[qtyIdx] ?? '0') || 0,
      costPrice: priceIdx >= 0 ? (parseFloat(cells[priceIdx] ?? '') || undefined) : undefined,
    };
  }).filter(r => r.name && r.qty >= 0);
}

function ImportBalanceDrawer({ onClose }: { onClose: () => void }) {
  const importBalance = useImportOpeningBalance();
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<ImportOpeningBalanceRow[]>([]);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: Array<{ row: number; reason: string }> } | null>(null);

  function handleParse() {
    setPreview(parseImportCsv(csvText));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvText(text);
      setPreview(parseImportCsv(text));
    };
    reader.readAsText(file, 'utf-8');
  }

  async function handleImport() {
    if (preview.length === 0) return;
    const res = await importBalance.mutateAsync(preview);
    setResult(res);
    setPreview([]);
  }

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} style={{ width: 680 }} onClick={e => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <div>
            <div className={styles.drawerTitle}>Загрузить начальные остатки</div>
            <div className={styles.drawerSubtitle}>CSV файл: наименование, цвет, пол, размер, остаток, цена</div>
          </div>
          <button className={styles.drawerClose} onClick={onClose}><X size={14} /></button>
        </div>

        <div className={styles.drawerBody}>
          {result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { label: 'Создано', value: result.created, color: 'var(--fill-positive)' },
                  { label: 'Обновлено', value: result.updated, color: 'var(--fill-accent)' },
                  { label: 'Пропущено', value: result.skipped, color: 'var(--text-tertiary)' },
                ].map(({ label, value, color }) => (
                  <div key={label} className={styles.drawerCard} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
                    <div className={styles.drawerCardLabel}>{label}</div>
                  </div>
                ))}
              </div>
              {result.errors.length > 0 && (
                <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 9, padding: '10px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fill-negative)', marginBottom: 6 }}>
                    Ошибки ({result.errors.length})
                  </div>
                  {result.errors.map(e => (
                    <div key={e.row} style={{ fontSize: 12, color: 'var(--fill-negative)' }}>
                      Строка {e.row}: {e.reason}
                    </div>
                  ))}
                </div>
              )}
              <button className={`${styles.drawerActionBtn} ${styles.drawerActionBtnPrimary}`} onClick={onClose}>
                Закрыть
              </button>
            </div>
          ) : preview.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Распознано строк: <strong style={{ color: 'var(--text-primary)' }}>{preview.length}</strong>. Проверьте данные перед импортом.
              </div>
              <div className={styles.tableWrap} style={{ maxHeight: 300 }}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Название</th><th>Цвет</th><th>Пол</th><th>Размер</th><th>Остаток</th><th>Цена</th></tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map((row, i) => (
                      <tr key={i} className={styles.row}>
                        <td className={styles.tdName}>{row.name}</td>
                        <td className={styles.tdSecondary}>{row.color || '—'}</td>
                        <td className={styles.tdSecondary}>{row.gender || '—'}</td>
                        <td className={styles.tdSecondary}>{row.size || '—'}</td>
                        <td className={styles.tdNum}>{row.qty}</td>
                        <td className={styles.tdSecondary}>{row.costPrice != null ? fmtMoney(row.costPrice) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 50 && (
                  <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                    ...и ещё {preview.length - 50} строк
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={styles.drawerSecondaryBtn} style={{ flex: 1 }} onClick={() => setPreview([])}>
                  Назад
                </button>
                <button
                  className={`${styles.drawerActionBtn} ${styles.drawerActionBtnPrimary}`}
                  style={{ flex: 2 }}
                  onClick={() => void handleImport()}
                  disabled={importBalance.isPending}
                >
                  <Upload size={14} />
                  {importBalance.isPending ? 'Импорт...' : `Загрузить ${preview.length} позиций`}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '9px 14px', border: '1px dashed var(--border-default)', borderRadius: 8,
                  cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-surface-inset)',
                }}>
                  <Upload size={14} />
                  Выбрать CSV файл
                  <input type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFileChange} />
                </label>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>— или —</div>
              <div className={styles.field}>
                <label className={styles.label}>Вставить CSV текст</label>
                <textarea
                  className={styles.input}
                  style={{ minHeight: 160, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  placeholder={IMPORT_TEMPLATE}
                />
              </div>
              <div style={{ background: 'var(--bg-surface-inset)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                <strong style={{ color: 'var(--text-secondary)' }}>Формат CSV:</strong> наименование, цвет, пол, размер, остаток, цена (первая строка — заголовок)
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={styles.drawerSecondaryBtn} style={{ flex: 1 }} onClick={onClose}>Отмена</button>
                <button
                  className={`${styles.drawerActionBtn} ${styles.drawerActionBtnPrimary}`}
                  style={{ flex: 2 }}
                  onClick={handleParse}
                  disabled={!csvText.trim()}
                >
                  Проверить данные
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Clickable table row helper ────────────────────────────────────────────────

function ClickRow({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <tr
      className={styles.row}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {children}
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ChapanWarehousePage() {
  const [tab, setTab] = useState<Tab>('items');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addMovOpen, setAddMovOpen] = useState(false);
  const [importBalanceOpen, setImportBalanceOpen] = useState(false);
  const [preselectItem, setPreselectItem] = useState<string | undefined>();
  const [selectedCanonicalSiteId, setSelectedCanonicalSiteId] = useState('');

  // Detail drawers
  const [selectedInvoice, setSelectedInvoice] = useState<ChapanInvoice | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Inventory data
  const { data: itemsData, isLoading: itemsLoading } = useWarehouseItems({ search: deferredSearch || undefined });
  const { data: movData, isLoading: movLoading } = useWarehouseMovements({ limit: 100 });
  const { data: alertsData } = useWarehouseAlerts();
  const deleteItem = useDeleteItem();
  const resolveAlert = useResolveAlert();

  // Chapan handoff data
  const { data: invoicesData, isLoading: invoicesLoading } = useInvoices({ status: 'pending_confirmation', limit: 200 });
  const { data: archivedInvoicesData, isLoading: archivedInvoicesLoading } = useInvoices({ status: 'archived', limit: 200 });
  const archivedInvoices: ChapanInvoice[] = useMemo(() => archivedInvoicesData?.results ?? [], [archivedInvoicesData?.results]);
  const pendingInvoices: ChapanInvoice[] = useMemo(
    () => (invoicesData?.results ?? []).filter((inv) => !inv.warehouseConfirmed),
    [invoicesData?.results],
  );
  const { data: whOrdersData, isLoading: whOrdersLoading } = useOrders({ status: 'on_warehouse', limit: 200 });
  const warehouseOrders: ChapanOrder[] = useMemo(() => whOrdersData?.results ?? [], [whOrdersData?.results]);
  const toShipOrders = useMemo(
    () => warehouseOrders.filter((o) => o.paymentStatus === 'paid'),
    [warehouseOrders],
  );
  const unpaidOrders = useMemo(
    () => warehouseOrders.filter((o) => o.paymentStatus !== 'paid'),
    [warehouseOrders],
  );

  // Partial warehouse orders
  const { data: partialWhData, isLoading: partialWhLoading } = useOrders({ hasWarehouseItems: true, limit: 200 });
  const partialWarehouseOrders: ChapanOrder[] = useMemo(() => partialWhData?.results ?? [], [partialWhData?.results]);
  const { data: shippedOrdersData, isLoading: shippedOrdersLoading } = useOrders({ status: 'shipped', limit: 200 });
  const shippedOrders: ChapanOrder[] = useMemo(() => shippedOrdersData?.results ?? [], [shippedOrdersData?.results]);

  const items = useMemo(() => itemsData?.results ?? [], [itemsData?.results]);
  const movements = useMemo(() => movData?.results ?? [], [movData?.results]);
  const alerts = useMemo(() => alertsData?.results ?? [], [alertsData?.results]);
  const alertCount = alerts.length;
  const incomingCount = pendingInvoices.length;
  const totalUnits = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);
  const { data: canonicalSites } = useWarehouseFoundationSites();
  const { data: canonicalSiteHealth } = useWarehouseFoundationSiteHealth(selectedCanonicalSiteId || undefined);
  const { data: canonicalControlTower } = useWarehouseFoundationSiteControlTower(selectedCanonicalSiteId || undefined);

  useEffect(() => {
    if (!selectedCanonicalSiteId && canonicalSites?.results?.length) {
      setSelectedCanonicalSiteId(canonicalSites.results[0].id);
    }
  }, [canonicalSites?.results, selectedCanonicalSiteId]);

  function handleExportItems() {
    if (!items.length) {
      toast.info('Нет данных для экспорта');
      return;
    }
    exportToCSV(items.map(i => ({
      'Название': i.name,
      'Вариант': i.attributesSummary ?? '',
      'Уникальный номер': i.sku ?? '',
      'Ед.изм': i.unit,
      'Остаток': i.qty,
      'Зарезервировано': i.qtyReserved,
      'Доступно': i.qty - i.qtyReserved,
      'Мин.остаток': i.qtyMin,
      'Категория': i.category?.name ?? '',
      'Цена закупки': i.costPrice ?? '',
    })), 'склад_остатки.csv');
  }
  function handleExportMovements() {
    exportToCSV(movements.map(m => ({
      'Дата': fmtDate(m.createdAt), 'Тип': MOVEMENT_LABEL[m.type], 'Позиция': m.item?.name ?? m.itemId,
      'Количество': m.qty, 'Причина': m.reason ?? '', 'Автор': m.author,
    })), 'склад_движения.csv');
  }

  return (
    <div className={styles.root} style={{ height: 'auto', overflow: 'visible' }}>
      {/* Header + tabs */}
      <div className={styles.header}>
        <h1 className={styles.title}>Склад</h1>
        <div className={styles.headerRight}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${tab === 'items' ? styles.tabActive : ''}`} onClick={() => setTab('items')}>
              <Package size={13} /> Остатки
            </button>
            <button className={`${styles.tab} ${tab === 'movements' ? styles.tabActive : ''}`} onClick={() => setTab('movements')}>
              <TrendingDown size={13} /> Движения
            </button>
            <button className={`${styles.tab} ${tab === 'alerts' ? styles.tabActive : ''}`} onClick={() => setTab('alerts')}>
              <AlertTriangle size={13} /> Оповещения {alertCount > 0 && <span className={styles.alertBadge}>{alertCount}</span>}
            </button>
            <button className={`${styles.tab} ${tab === 'catalog' ? styles.tabActive : ''}`} onClick={() => setTab('catalog')}>
              <BookOpen size={13} /> Каталог
            </button>

            <div className={styles.tabDivider} />
            <span className={styles.tabGroupLabel}>Чапан</span>

            <button className={`${styles.tab} ${tab === 'incoming' ? styles.tabActive : ''}`} onClick={() => setTab('incoming')}>
              <FileText size={13} /> Приёмка {incomingCount > 0 && <span className={styles.alertBadge}>{incomingCount}</span>}
            </button>
            <button className={`${styles.tab} ${tab === 'invoice_archive' ? styles.tabActive : ''}`} onClick={() => setTab('invoice_archive')}>
              <Archive size={13} /> Архив накладных
            </button>
            <button className={`${styles.tab} ${tab === 'orders_wh' ? styles.tabActive : ''}`} onClick={() => setTab('orders_wh')}>
              <Package size={13} /> Заказы {(warehouseOrders.length + partialWarehouseOrders.length) > 0 && <span className={styles.alertBadge}>{warehouseOrders.length + partialWarehouseOrders.length}</span>}
            </button>
            <button className={`${styles.tab} ${tab === 'to_ship' ? styles.tabActive : ''}`} onClick={() => setTab('to_ship')}>
              <Send size={13} /> К отправке {toShipOrders.length > 0 && <span className={styles.alertBadge}>{toShipOrders.length}</span>}
            </button>
            <button className={`${styles.tab} ${tab === 'shipped' ? styles.tabActive : ''}`} onClick={() => setTab('shipped')}>
              <CheckSquare size={13} /> Отгружено {shippedOrders.length > 0 && <span className={styles.alertBadge}>{shippedOrders.length}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      {!itemsLoading && (
        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{items.length}</span>
            <span className={styles.statLabel}>Позиций в базе</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{fmtNum(totalUnits)}</span>
            <span className={styles.statLabel}>Единиц на складе</span>
          </div>
          {alertCount > 0 && (
            <div className={styles.statItem}>
              <span className={styles.statValue} style={{ color: 'var(--fill-warning)' }}>{alertCount}</span>
              <span className={styles.statLabel}>Алертов</span>
            </div>
          )}
          {incomingCount > 0 && (
            <div className={styles.statItem}>
              <span className={styles.statValue} style={{ color: 'var(--fill-accent)' }}>{incomingCount}</span>
              <span className={styles.statLabel}>Накладных на приёмку</span>
            </div>
          )}
        </div>
      )}

      {tab === 'incoming' && (
        invoicesLoading ? (
          <div className={styles.skeletons}>{[...Array(4)].map((_, i) => <Skeleton key={i} height={56} radius={8} />)}</div>
        ) : pendingInvoices.length === 0 ? (
          <div className={styles.empty}>
            <PackageCheck size={32} className={styles.emptyIcon} />
            <p>Нет входящих накладных</p>
            <span className={styles.emptyNote}>Когда цех отправит заказы на склад, накладные появятся здесь</span>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Накладная</th><th>Дата</th><th>Заказов</th><th>Создал</th><th>Статус цеха</th><th></th>
                </tr>
              </thead>
              <tbody>
                {pendingInvoices.map((inv) => {
                  const oneConfirmed = inv.seamstressConfirmed !== inv.warehouseConfirmed;
                  const confirmedAt = inv.seamstressConfirmedAt || inv.warehouseConfirmedAt;
                  const ageHours = confirmedAt
                    ? (Date.now() - new Date(confirmedAt).getTime()) / 3_600_000
                    : 0;
                  const isStale = oneConfirmed && ageHours >= 24;
                  return (
                  <ClickRow key={inv.id} onClick={() => setSelectedInvoice(inv)}>
                    <td className={styles.tdName}>
                      #{inv.invoiceNumber}
                      {isStale && (
                        <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#EF4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, padding: '1px 5px' }}>
                          <AlertCircle size={10} /> Зависла
                        </span>
                      )}
                    </td>
                    <td className={styles.tdDate}>{fmtDate(inv.createdAt)}</td>
                    <td className={styles.tdNum}>{inv.items?.length ?? 0} заказ(а)</td>
                    <td className={styles.tdSecondary}>{inv.createdByName}</td>
                    <td>
                      {inv.seamstressConfirmed
                        ? <span style={{ color: 'var(--fill-positive)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> Цех отправил</span>
                        : <span style={{ color: 'var(--fill-warning)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={12} /> Ожидает цех</span>}
                    </td>
                    <td className={styles.tdActions} onClick={(e) => e.stopPropagation()}>
                      <button className={styles.incomBtn} onClick={() => setSelectedInvoice(inv)}>
                        <FileText size={12} /> Открыть
                      </button>
                    </td>
                  </ClickRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Архив накладных tab ── */}
      {tab === 'invoice_archive' && (
        archivedInvoicesLoading ? (
          <div className={styles.skeletons}>{[...Array(4)].map((_, i) => <Skeleton key={i} height={56} radius={8} />)}</div>
        ) : archivedInvoices.length === 0 ? (
          <div className={styles.empty}>
            <Archive size={32} className={styles.emptyIcon} />
            <p>Архив пуст</p>
            <span className={styles.emptyNote}>Накладные появятся здесь после скачивания</span>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Накладная</th><th>Дата</th><th>Заказов</th><th>Создал</th><th></th>
                </tr>
              </thead>
              <tbody>
                {archivedInvoices.map((inv) => (
                  <ClickRow key={inv.id} onClick={() => setSelectedInvoice(inv)}>
                    <td className={styles.tdName}>#{inv.invoiceNumber}</td>
                    <td className={styles.tdDate}>{fmtDate(inv.createdAt)}</td>
                    <td className={styles.tdNum}>{inv.items?.length ?? 0} заказ(а)</td>
                    <td className={styles.tdSecondary}>{inv.createdByName}</td>
                    <td className={styles.tdActions} onClick={(e) => e.stopPropagation()}>
                      <button className={styles.incomBtn} onClick={() => setSelectedInvoice(inv)}>
                        <FileText size={12} /> Открыть
                      </button>
                    </td>
                  </ClickRow>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Заказы на складе tab ── */}
      {tab === 'orders_wh' && (
        (whOrdersLoading || partialWhLoading) ? (
          <div className={styles.skeletons}>{[...Array(4)].map((_, i) => <Skeleton key={i} height={52} radius={8} />)}</div>
        ) : warehouseOrders.length === 0 && partialWarehouseOrders.length === 0 ? (
          <div className={styles.empty}>
            <Package size={32} className={styles.emptyIcon} />
            <p>Склад пуст</p>
            <span className={styles.emptyNote}>Принятые заказы появятся после подтверждения накладных</span>
          </div>
        ) : (
          <>
            {warehouseOrders.length > 0 && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Заказ</th><th>Клиент</th><th>Телефон</th><th>Позиции</th><th>Сумма</th><th>Оплата</th><th></th></tr>
                  </thead>
                  <tbody>
                    {warehouseOrders.map((order) => (
                      <ClickRow key={order.id} onClick={() => setSelectedOrderId(order.id)}>
                        <td className={styles.tdMono}>#{order.orderNumber}</td>
                        <td className={styles.tdName}>{order.clientName}</td>
                        <td className={styles.tdSecondary} style={{ fontSize: 12 }}>{order.clientPhone}</td>
                        <td className={styles.tdSecondary}>
                          {(order.items ?? []).slice(0, 2).map((i) => i.productName).join(', ')}
                          {(order.items ?? []).length > 2 ? ` +${(order.items ?? []).length - 2}` : ''}
                        </td>
                        <td className={styles.tdNum}>{fmtMoney(order.totalAmount)}</td>
                        <td>
                          <span style={{ color: PAY_COLOR[order.paymentStatus], fontWeight: 500, fontSize: 12 }}>
                            {order.paymentStatus === 'paid' ? 'Оплачен' : order.paymentStatus === 'partial' ? 'Частично' : 'Не оплачен'}
                          </span>
                        </td>
                        <td className={styles.tdActions} style={{ color: 'var(--text-tertiary)' }}>
                          <ChevronRight size={14} />
                        </td>
                      </ClickRow>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {partialWarehouseOrders.length > 0 && (
              <>
                <div className={styles.sectionLabel}>
                  Ожидает производство — {partialWarehouseOrders.length} {partialWarehouseOrders.length === 1 ? 'заказ' : partialWarehouseOrders.length < 5 ? 'заказа' : 'заказов'}
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr><th>Заказ</th><th>Клиент</th><th>Позиции</th><th>Сумма</th><th>Статус</th><th></th></tr>
                    </thead>
                    <tbody>
                      {partialWarehouseOrders.map((order) => {
                        const whItems = order.items.filter(i => i.fulfillmentMode === 'warehouse');
                        const prodItems = order.items.filter(i => i.fulfillmentMode === 'production');
                        return (
                          <ClickRow key={order.id} onClick={() => setSelectedOrderId(order.id)}>
                            <td className={styles.tdMono}>#{order.orderNumber}</td>
                            <td className={styles.tdName}>{order.clientName}</td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {whItems.map(i => (
                                  <span key={i.id} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--fill-positive)' }}>
                                    <CheckCircle2 size={11} /> {i.productName}{i.quantity > 1 ? ` ×${i.quantity}` : ''}
                                  </span>
                                ))}
                                {prodItems.map(i => (
                                  <span key={i.id} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)' }}>
                                    <AlertCircle size={11} /> {i.productName}{i.quantity > 1 ? ` ×${i.quantity}` : ''} — в производстве
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className={styles.tdNum}>{fmtMoney(order.totalAmount)}</td>
                            <td>
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(245,158,11,.1)', color: '#F59E0B', fontWeight: 500 }}>
                                В производстве
                              </span>
                            </td>
                            <td className={styles.tdActions} style={{ color: 'var(--text-tertiary)' }}>
                              <ChevronRight size={14} />
                            </td>
                          </ClickRow>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )
      )}

      {/* ── К отправке tab ── */}
      {tab === 'to_ship' && (
        whOrdersLoading ? (
          <div className={styles.skeletons}>{[...Array(4)].map((_, i) => <Skeleton key={i} height={52} radius={8} />)}</div>
        ) : toShipOrders.length === 0 && unpaidOrders.length === 0 ? (
          <div className={styles.empty}>
            <Send size={32} className={styles.emptyIcon} />
            <p>Нет заказов к отправке</p>
            <span className={styles.emptyNote}>Оплаченные заказы со склада будут готовы к отгрузке</span>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Заказ</th><th>Клиент</th><th>Телефон</th><th>Позиции</th><th>Сумма</th><th>Оплата</th><th></th></tr>
              </thead>
              <tbody>
                {toShipOrders.map((order) => (
                  <ClickRow key={order.id} onClick={() => setSelectedOrderId(order.id)}>
                    <td className={styles.tdMono}>#{order.orderNumber}</td>
                    <td className={styles.tdName}>{order.clientName}</td>
                    <td className={styles.tdSecondary} style={{ fontSize: 12 }}>{order.clientPhone}</td>
                    <td className={styles.tdSecondary}>
                      {(order.items ?? []).slice(0, 2).map((i) => i.productName).join(', ')}
                      {(order.items ?? []).length > 2 ? ` +${(order.items ?? []).length - 2}` : ''}
                    </td>
                    <td className={styles.tdNum}>{fmtMoney(order.totalAmount)}</td>
                    <td><span style={{ color: 'var(--fill-positive)', fontWeight: 500, fontSize: 12 }}>Оплачен</span></td>
                    <td className={styles.tdActions} onClick={(e) => e.stopPropagation()}>
                      <button className={styles.incomBtn} onClick={() => setSelectedOrderId(order.id)}>
                        <Send size={12} /> Открыть
                      </button>
                    </td>
                  </ClickRow>
                ))}
                {unpaidOrders.map((order) => (
                  <ClickRow key={order.id} onClick={() => setSelectedOrderId(order.id)}>
                    <td className={styles.tdMono}>#{order.orderNumber}</td>
                    <td className={styles.tdName}>{order.clientName}</td>
                    <td className={styles.tdSecondary} style={{ fontSize: 12 }}>{order.clientPhone}</td>
                    <td className={styles.tdSecondary}>
                      {(order.items ?? []).slice(0, 2).map((i) => i.productName).join(', ')}
                      {(order.items ?? []).length > 2 ? ` +${(order.items ?? []).length - 2}` : ''}
                    </td>
                    <td className={styles.tdNum}>{fmtMoney(order.totalAmount)}</td>
                    <td><span style={{ color: 'var(--fill-negative)', fontWeight: 500, fontSize: 12 }}>Не оплачен</span></td>
                    <td className={styles.tdActions} style={{ color: 'var(--text-tertiary)' }}>
                      <ChevronRight size={14} />
                    </td>
                  </ClickRow>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Отгружено tab ── */}
      {tab === 'shipped' && (
        shippedOrdersLoading ? (
          <div className={styles.skeletons}>{[...Array(4)].map((_, i) => <Skeleton key={i} height={52} radius={8} />)}</div>
        ) : shippedOrders.length === 0 ? (
          <div className={styles.empty}>
            <CheckSquare size={32} className={styles.emptyIcon} />
            <p>Отгрузок пока нет</p>
            <span className={styles.emptyNote}>Отправленные клиентам заказы появятся здесь</span>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Заказ</th><th>Клиент</th><th>Телефон</th><th>Позиции</th><th>Сумма</th><th>Оплата</th><th></th></tr>
              </thead>
              <tbody>
                {shippedOrders.map((order) => (
                  <ClickRow key={order.id} onClick={() => setSelectedOrderId(order.id)}>
                    <td className={styles.tdMono}>#{order.orderNumber}</td>
                    <td className={styles.tdName}>{order.clientName}</td>
                    <td className={styles.tdSecondary} style={{ fontSize: 12 }}>{order.clientPhone}</td>
                    <td className={styles.tdSecondary}>
                      {(order.items ?? []).slice(0, 2).map((i) => i.productName).join(', ')}
                      {(order.items ?? []).length > 2 ? ` +${(order.items ?? []).length - 2}` : ''}
                    </td>
                    <td className={styles.tdNum}>{fmtMoney(order.totalAmount)}</td>
                    <td><span style={{ color: PAY_COLOR[order.paymentStatus], fontWeight: 500, fontSize: 12 }}>{PAY_LABEL[order.paymentStatus]}</span></td>
                    <td className={styles.tdActions} onClick={(e) => e.stopPropagation()}>
                      <button className={styles.incomBtn} onClick={() => setSelectedOrderId(order.id)}>
                        <CheckSquare size={12} /> Завершить
                      </button>
                    </td>
                  </ClickRow>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Остатки tab ── */}
      {tab === 'items' && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={13} className={styles.searchIcon} />
              <input className={styles.searchInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по названию..." />
            </div>
            <button className={styles.exportBtn} onClick={handleExportItems}><Download size={13} /> Excel</button>
            <button className={styles.exportBtn} onClick={() => setImportBalanceOpen(true)}><Upload size={13} /> Импорт остатков</button>
            <button className={styles.addBtn} onClick={() => setAddItemOpen(true)}><Plus size={14} /> Добавить</button>
          </div>

          {itemsLoading ? (
            <div className={styles.skeletons}>{[...Array(6)].map((_, i) => <Skeleton key={i} height={52} radius={8} />)}</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Название</th><th>Вариант</th><th>Кат.</th><th>Остаток</th><th>Мин.</th><th>Статус</th><th></th></tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const status = getStockStatus(item);
                    return (
                      <tr key={item.id} className={styles.row}>
                        <td className={styles.tdName}>{item.name}</td>
                        <td className={styles.tdSecondary} style={{ fontSize: 11 }}>
                          {item.attributesSummary ?? (item.sku ? <span className={styles.tdMono}>{item.sku}</span> : '—')}
                        </td>
                        <td className={styles.tdSecondary}>{item.category?.name ?? '—'}</td>
                        <td className={styles.tdNum}>{fmtNum(item.qty)} {item.unit}</td>
                        <td className={styles.tdSecondary}>{fmtNum(item.qtyMin)} {item.unit}</td>
                        <td>
                          <span className={styles.stockBadge} data-status={status}>
                            {status === 'ok' ? 'Норма' : status === 'low' ? 'Мало' : 'Критично'}
                          </span>
                        </td>
                        <td className={styles.tdActions}>
                          <button className={styles.incomBtn} onClick={() => { setPreselectItem(item.id); setAddMovOpen(true); }}>Приход</button>
                          <button className={styles.deleteBtn} onClick={() => { if (confirm('Удалить позицию?')) deleteItem.mutate(item.id); }}><X size={12} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {items.length === 0 && (
                <div className={styles.empty}>
                  <Package size={32} className={styles.emptyIcon} />
                  <p>Склад пуст</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button className={styles.emptyBtn} onClick={() => setImportBalanceOpen(true)}>
                      <Upload size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      Загрузить из CSV
                    </button>
                    <button className={styles.emptyBtn} onClick={() => setAddItemOpen(true)}>Добавить вручную</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Движения tab ── */}
      {tab === 'movements' && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.toolbarSpacer} />
            <button className={styles.exportBtn} onClick={handleExportMovements}><Download size={13} /> Excel</button>
            <button className={styles.addBtn} onClick={() => { setPreselectItem(undefined); setAddMovOpen(true); }}>
              <Plus size={14} /> Новое движение
            </button>
          </div>

          {movLoading ? (
            <div className={styles.skeletons}>{[...Array(8)].map((_, i) => <Skeleton key={i} height={48} radius={8} />)}</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Дата</th><th>Тип</th><th>Позиция</th><th>Кол-во</th><th>До → После</th><th>Причина</th><th>Автор</th></tr>
                </thead>
                <tbody>
                  {movements.map(m => {
                    const isIncoming = m.type === 'in' || m.type === 'return';
                    const sourceLabel = m.sourceType === 'chapan_order' ? 'Заказ'
                      : m.sourceType === 'opening_balance' ? 'Нач.остаток'
                      : m.sourceType === 'deal' ? 'Сделка'
                      : null;
                    return (
                      <tr key={m.id} className={styles.row}>
                        <td className={styles.tdDate}>{fmtDate(m.createdAt)}</td>
                        <td>
                          <span className={styles.movBadge} style={{ color: MOVEMENT_COLOR[m.type], background: `${MOVEMENT_COLOR[m.type]}18` }}>
                            {MOVEMENT_LABEL[m.type]}
                          </span>
                        </td>
                        <td className={styles.tdName}>{m.item?.name ?? m.itemId}</td>
                        <td className={styles.tdNum} style={{ color: isIncoming ? 'var(--fill-positive)' : 'var(--fill-negative)' }}>
                          {isIncoming ? '+' : '-'}{fmtNum(Math.abs(m.qty))} {m.item?.unit}
                        </td>
                        <td className={styles.tdSecondary} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                          {m.qtyBefore != null && m.qtyAfter != null
                            ? `${fmtNum(m.qtyBefore)} → ${fmtNum(m.qtyAfter)}`
                            : '—'}
                        </td>
                        <td className={styles.tdSecondary}>
                          {m.reason ?? '—'}
                          {sourceLabel && (
                            <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'var(--bg-surface-inset)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' }}>
                              {sourceLabel}
                            </span>
                          )}
                        </td>
                        <td className={styles.tdSecondary}>{m.author}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {movements.length === 0 && (
                <div className={styles.empty}>
                  <TrendingDown size={32} className={styles.emptyIcon} />
                  <p>Движений пока нет</p>
                  <button className={styles.emptyBtn} onClick={() => setAddMovOpen(true)}>Записать первое движение</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Оповещения tab ── */}
      {tab === 'alerts' && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Позиция</th><th>Остаток</th><th>Минимум</th><th>Ед.</th><th>Статус</th><th></th></tr></thead>
            <tbody>
              {alerts.map(a => (
                <tr key={a.id} className={styles.row}>
                  <td className={styles.tdName}>{a.item?.name ?? '—'}</td>
                  <td className={styles.tdNum} style={{ color: 'var(--fill-negative)' }}>{fmtNum(a.item?.qty ?? 0)}</td>
                  <td className={styles.tdSecondary}>{fmtNum(a.item?.qtyMin ?? 0)}</td>
                  <td className={styles.tdSecondary}>{a.item?.unit ?? '—'}</td>
                  <td><span className={styles.alertStatusBadge}>Низкий остаток</span></td>
                  <td className={styles.tdActions}>
                    <button className={styles.incomBtn} onClick={() => { setPreselectItem(a.itemId); setAddMovOpen(true); setTab('movements'); }}>Записать приход</button>
                    <button className={styles.resolveBtn} onClick={() => resolveAlert.mutate(a.id)}>Закрыть</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {alerts.length === 0 && (
            <div className={styles.empty}>
              <AlertTriangle size={32} className={styles.emptyIcon} style={{ color: 'var(--fill-positive)' }} />
              <p>Все в норме</p>
              <span className={styles.emptyNote}>Оповещения появятся когда остаток упадёт ниже минимума</span>
            </div>
          )}
        </div>
      )}

      {/* ── Каталог tab ── */}
      {tab === 'catalog' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <WarehouseCatalog />

          {canonicalSites?.results?.length ? (
            <div
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: 14,
                background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg-surface-elevated) 78%, transparent), var(--bg-surface))',
                display: 'grid',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Warehouse Foundation</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
                    Системный слой: хранилища, резервы, документы, контрол-тауэр
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <select
                    className={styles.select}
                    value={selectedCanonicalSiteId}
                    onChange={(event) => setSelectedCanonicalSiteId(event.target.value)}
                    style={{ minWidth: 160 }}
                  >
                    {canonicalSites.results.map((site) => (
                      <option key={site.id} value={site.id}>{site.code}</option>
                    ))}
                  </select>
                  <Link to="/warehouse" className={styles.exportBtn}>Foundation</Link>
                  <Link to="/warehouse/operations" className={styles.exportBtn}>Operations</Link>
                  <Link to="/warehouse/control-tower" className={styles.exportBtn}>Control Tower</Link>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                <div className={styles.drawerCard}>
                  <div className={styles.drawerCardLabel}>Health</div>
                  <div className={styles.drawerCardRowSecondary}>Score: {canonicalControlTower?.healthScore ?? 0}</div>
                  <div className={styles.drawerCardRowSecondary}>Alerts: {canonicalControlTower?.alerts.length ?? 0}</div>
                </div>
                <div className={styles.drawerCard}>
                  <div className={styles.drawerCardLabel}>Reservations</div>
                  <div className={styles.drawerCardRowSecondary}>Active: {canonicalSiteHealth?.operations.reservations.active ?? 0}</div>
                  <div className={styles.drawerCardRowSecondary}>Consumed: {canonicalSiteHealth?.operations.reservations.consumed ?? 0}</div>
                </div>
                <div className={styles.drawerCard}>
                  <div className={styles.drawerCardLabel}>Documents</div>
                  <div className={styles.drawerCardRowSecondary}>Handoffs: {canonicalSiteHealth?.operations.documents.handoffs ?? 0}</div>
                  <div className={styles.drawerCardRowSecondary}>Shipments: {canonicalSiteHealth?.operations.documents.shipments ?? 0}</div>
                </div>
                <div className={styles.drawerCard}>
                  <div className={styles.drawerCardLabel}>Inventory</div>
                  <div className={styles.drawerCardRowSecondary}>On hand: {fmtNum(canonicalSiteHealth?.inventory.qtyOnHand ?? 0)}</div>
                  <div className={styles.drawerCardRowSecondary}>Reserved: {fmtNum(canonicalSiteHealth?.inventory.qtyReserved ?? 0)}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Drawers */}
      {addItemOpen && <AddItemDrawer onClose={() => setAddItemOpen(false)} />}
      {addMovOpen && (
        <AddMovementDrawer items={items} preselectItemId={preselectItem} onClose={() => { setAddMovOpen(false); setPreselectItem(undefined); }} />
      )}
      {importBalanceOpen && <ImportBalanceDrawer onClose={() => setImportBalanceOpen(false)} />}
      {selectedInvoice && (
        <InvoiceDetailDrawer invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
      {selectedOrderId && (
        <OrderDetailDrawer orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
      )}
    </div>
  );
}
