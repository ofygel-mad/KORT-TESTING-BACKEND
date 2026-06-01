import type { OrderStatus } from '@/entities/order/types';
import styles from './OrderPipeline.module.css';

interface OrderPipelineProps {
  status: OrderStatus;
  className?: string;
}

type PipelineStage = {
  key: string;
  label: string;
};

const STAGES: PipelineStage[] = [
  { key: 'new',           label: 'Новый' },
  { key: 'confirmed',     label: 'Подтверждён' },
  { key: 'in_production', label: 'В производстве' },
  { key: 'ready',         label: 'Готов' },
  { key: 'shipped',       label: 'Отправлен' },
  { key: 'completed',     label: 'Завершён' },
];

// Map statuses that sit between pipeline stages to a canonical stage
const STATUS_TO_STAGE: Record<OrderStatus, string> = {
  new:           'new',
  confirmed:     'confirmed',
  in_production: 'in_production',
  ready:         'ready',
  transferred:   'shipped',
  on_warehouse:  'shipped',
  shipped:       'shipped',
  completed:     'completed',
  cancelled:     'cancelled',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  new:           'Новый',
  confirmed:     'Подтверждён',
  in_production: 'В производстве',
  ready:         'Готов',
  transferred:   'Передан',
  on_warehouse:  'На складе',
  shipped:       'Отправлен',
  completed:     'Завершён',
  cancelled:     'Отменён',
};

export function OrderPipeline({ status, className }: OrderPipelineProps) {
  if (status === 'cancelled') {
    return (
      <div className={[styles.cancelled, className].filter(Boolean).join(' ')}>
        <span className={styles.cancelledIcon}>✕</span>
        Отменён
      </div>
    );
  }

  const activeKey = STATUS_TO_STAGE[status];
  const activeIdx = STAGES.findIndex((s) => s.key === activeKey);

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <div className={styles.dots}>
        {STAGES.map((stage, idx) => {
          let state: 'done' | 'active' | 'future';
          if (idx < activeIdx) state = 'done';
          else if (idx === activeIdx) state = 'active';
          else state = 'future';

          return (
            <span key={stage.key} style={{ display: 'contents' }}>
              {idx > 0 && <span className={styles.connector} />}
              <span className={styles.dot} data-state={state} />
            </span>
          );
        })}
      </div>
      <span className={styles.label}>{STATUS_LABELS[status]}</span>
    </div>
  );
}
