import styles from './PayProgress.module.css';

interface PayProgressProps {
  paid: number;
  total: number;
  className?: string;
}

type Tone = 'ok' | 'warn' | 'bad';

function fmt(n: number): string {
  return n.toLocaleString('ru-KZ');
}

export function PayProgress({ paid, total, className }: PayProgressProps) {
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const tone: Tone = pct >= 100 ? 'ok' : pct > 0 ? 'warn' : 'bad';

  let label: string;
  if (tone === 'ok') label = '✓ Оплачен';
  else if (tone === 'warn') label = `${pct}% оплачено`;
  else label = 'Не оплачен';

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <div className={styles.bar}>
        <div
          className={styles.fill}
          data-tone={tone}
          style={tone !== 'bad' ? { width: `${pct}%` } : undefined}
        />
      </div>
      <span className={styles.label} data-tone={tone}>{label}</span>
      {tone === 'warn' && (
        <span className={styles.sub}>{fmt(paid)} из {fmt(total)} ₸</span>
      )}
    </div>
  );
}
