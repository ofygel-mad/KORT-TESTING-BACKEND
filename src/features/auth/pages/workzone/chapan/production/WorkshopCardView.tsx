import { Check, ImageOff, AlertCircle, Star, MessageSquare } from 'lucide-react';
import type { ProductionTask, ProductionStatus } from '@/entities/order/types';
import { formatOrderItemNumber } from '../../../../../../shared/utils/orderItemNumber';
import styles from './WorkshopCardView.module.css';

interface WorkshopCardViewProps {
  tasks: ProductionTask[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  pendingDoneIds: Set<string>;
  photoMap: Map<string, string>;
  onMarkDone: (taskId: string, currentStatus: ProductionStatus) => void;
}

const DATE_TOKEN_RE = /\d{4}-\d{2}-\d{2}/;
const DASH = '—';
const SHORT_RU_DATE = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return DASH;
  const token = dateStr.match(DATE_TOKEN_RE)?.[0];
  if (!token) return DASH;
  try {
    const d = new Date(`${token}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return DASH;
    return SHORT_RU_DATE.format(d).replace(',', '');
  } catch {
    return DASH;
  }
}

function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const token = dateStr.match(DATE_TOKEN_RE)?.[0];
  if (!token) return false;
  return token < new Date().toISOString().slice(0, 10);
}

function WorkshopCard({
  task,
  isSelected,
  isPending,
  photoUrl,
  onToggleSelect,
  onMarkDone,
}: {
  task: ProductionTask;
  isSelected: boolean;
  isPending: boolean;
  photoUrl: string | undefined;
  onToggleSelect: (id: string) => void;
  onMarkDone: (taskId: string, currentStatus: ProductionStatus) => void;
}) {
  const urgency = task.order.urgency ?? task.order.priority;
  const isUrgent = urgency === 'urgent';
  const isVip = task.order.isDemandingClient && !isUrgent;

  const parsedSuffix = Number(task.id.split('-').pop());
  const position =
    task.orderItemPosition ??
    (Number.isFinite(parsedSuffix) && parsedSuffix > 0 ? parsedSuffix : null);

  const noteText = task.workshopNotes || task.notes;
  const dueDateOverdue = isOverdue(task.order.dueDate);

  const specs: string[] = [];
  if (task.color) specs.push(task.color);
  if (task.length) specs.push(task.length);
  if (task.gender) specs.push(task.gender);

  const cardClass = [
    styles.card,
    isUrgent ? styles.cardUrgent : '',
    isVip ? styles.cardVip : '',
    isSelected ? styles.cardSelected : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClass}>
      {/* Photo */}
      <div className={styles.photoWrap}>
        {photoUrl ? (
          <img src={photoUrl} alt={task.productName} className={styles.photo} />
        ) : (
          <div className={styles.photoPlaceholder}>
            <ImageOff size={28} />
          </div>
        )}

        {/* Checkbox overlay */}
        <button
          type="button"
          className={`${styles.checkboxOverlay} ${isSelected ? styles.checkboxOverlayChecked : ''}`}
          onClick={() => onToggleSelect(task.id)}
          disabled={isPending}
          aria-label={isSelected ? 'Снять выбор' : 'Выбрать'}
        >
          {isSelected && <Check size={13} className={styles.checkmark} />}
        </button>

        {/* Urgency badge */}
        {isUrgent && (
          <span className={`${styles.urgencyBadge} ${styles.urgencyBadgeUrgent}`}>
            <AlertCircle size={10} />
            Срочно
          </span>
        )}
        {isVip && (
          <span className={`${styles.urgencyBadge} ${styles.urgencyBadgeVip}`}>
            <Star size={10} />
            Требовательный
          </span>
        )}
      </div>

      {/* Body */}
      <div className={styles.body}>
        <span className={styles.orderNum}>
          №{formatOrderItemNumber(task.order.orderNumber, position)}
        </span>

        <span className={styles.productName}>{task.productName}</span>

        <div className={styles.specs}>
          {specs.map((s, i) => (
            <span key={i} className={styles.specChip}>{s}</span>
          ))}
          <span className={styles.specChip}>Разм. {task.size}</span>
          <span className={styles.specChip}>× {task.quantity}</span>
        </div>

        {noteText && (
          <div className={styles.note}>
            <MessageSquare size={11} className={styles.noteIcon} />
            {noteText}
          </div>
        )}

        <div className={styles.dates}>
          {task.order.dueDate && (
            <span className={`${styles.dateItem} ${dueDateOverdue ? styles.dateOverdue : ''}`}>
              Срок: {formatDate(task.order.dueDate)}
            </span>
          )}
          {task.startedAt && (
            <span className={styles.dateItem}>
              Принят: {formatDate(task.startedAt)}
            </span>
          )}
        </div>
      </div>

      {/* Action */}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.doneBtn}
          onClick={() => onMarkDone(task.id, task.status)}
          disabled={isPending || task.status === 'done'}
          title="Отметить как готово"
        >
          <Check size={12} />
          Готово
        </button>
      </div>
    </div>
  );
}

export default function WorkshopCardView({
  tasks,
  selectedIds,
  onToggleSelect,
  pendingDoneIds,
  photoMap,
  onMarkDone,
}: WorkshopCardViewProps) {
  return (
    <div className={styles.grid}>
      {tasks.map((task) => (
        <WorkshopCard
          key={task.id}
          task={task}
          isSelected={selectedIds.has(task.id)}
          isPending={pendingDoneIds.has(task.id)}
          photoUrl={photoMap.get(task.productName)}
          onToggleSelect={onToggleSelect}
          onMarkDone={onMarkDone}
        />
      ))}
    </div>
  );
}
