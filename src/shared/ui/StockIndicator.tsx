import styles from './StockIndicator.module.css';

interface StockIndicatorProps {
  qty: number;
  reserved: number;
  className?: string;
}

type Tone = 'ok' | 'low' | 'zero';

function getTone(available: number): Tone {
  if (available <= 0) return 'zero';
  if (available <= 2) return 'low';
  return 'ok';
}

export function StockIndicator({ qty, reserved, className }: StockIndicatorProps) {
  const available = Math.max(0, qty - reserved);
  const tone = getTone(available);
  const fillPct = qty > 0 ? Math.round((available / qty) * 100) : 0;

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <div className={styles.row}>
        <span className={styles.qty} data-tone={tone}>{qty}</span>
        {reserved > 0 && (
          <span className={styles.reserved}>−{reserved} резерв</span>
        )}
      </div>
      <div className={styles.bar}>
        <div
          className={styles.fill}
          data-tone={tone}
          style={tone !== 'zero' ? { width: `${fillPct}%` } : undefined}
        />
      </div>
    </div>
  );
}
