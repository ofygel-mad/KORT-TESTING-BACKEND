import { X, Clock3, User2 } from 'lucide-react';
import styles from './Warehouse.module.css';

type TimelineEntry = {
  id: string;
  eventType: string;
  actorName?: string | null;
  payloadJson?: Record<string, unknown> | null;
  createdAt: string;
};

function formatDate(value?: string | null) {
  if (!value) return 'No timestamp';
  return new Intl.DateTimeFormat('ru-KZ', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function summarizePayload(payload?: Record<string, unknown> | null) {
  if (!payload) return null;
  const parts = Object.entries(payload)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`);
  return parts.length ? parts.join(' • ') : null;
}

export function WarehouseTwinTimelineModal({
  open,
  title,
  subtitle,
  loading,
  entries,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string | null;
  loading?: boolean;
  entries: TimelineEntry[];
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(event) => event.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <div>
            <div className={styles.drawerTitle}>{title}</div>
            <div className={styles.drawerSubtitle}>{subtitle ?? 'Event timeline for this warehouse entity.'}</div>
          </div>
          <button type="button" className={styles.drawerClose} onClick={onClose} aria-label="Close timeline">
            <X size={16} />
          </button>
        </div>
        <div className={styles.drawerBody}>
          {loading ? (
            <div className={styles.drawerCardRowSecondary}>Loading timeline...</div>
          ) : entries.length ? (
            entries.map((entry) => (
              <div key={entry.id} className={styles.drawerCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div className={styles.tdName}>{entry.eventType}</div>
                  <span className={styles.stockBadge} data-status="ok">
                    {formatDate(entry.createdAt)}
                  </span>
                </div>
                <div className={styles.drawerCardRowSecondary}>
                  <Clock3 size={13} />
                  {formatDate(entry.createdAt)}
                </div>
                {entry.actorName ? (
                  <div className={styles.drawerCardRowSecondary}>
                    <User2 size={13} />
                    {entry.actorName}
                  </div>
                ) : null}
                {summarizePayload(entry.payloadJson) ? (
                  <div className={styles.tdSecondary}>{summarizePayload(entry.payloadJson)}</div>
                ) : null}
              </div>
            ))
          ) : (
            <div className={styles.drawerCardRowSecondary}>No timeline events yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
