import type { ReactNode } from 'react';
import { Button } from '../../shared/ui/Button';
import styles from './AuthRouteLayout.module.css';

export function AuthRouteLayout({ children }: { children?: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.grid} aria-hidden="true" />
      {children}
    </div>
  );
}

export function AuthRouteStatusCard({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  action?: () => void;
}) {
  return (
    <div className={styles.content}>
      <div className={styles.card}>
        {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
        {action && actionLabel && (
          <div className={styles.actions}>
            <Button size="sm" onClick={action}>{actionLabel}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
