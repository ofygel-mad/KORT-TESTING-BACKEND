import type { ReactNode } from 'react';
import styles from './Badge.module.css';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'amber';
type BadgeSize    = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  /** Custom override — use sparingly */
  color?: string;
  bg?: string;
}

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  default: styles.default,
  success: styles.success,
  warning: styles.warning,
  danger:  styles.danger,
  info:    styles.info,
  accent:  styles.accent,
  amber:   styles.accent, // alias
};

const SIZE_CLASS: Record<BadgeSize, string> = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
};

/**
 * Badge — статусный индикатор.
 *
 * @example
 * <Badge variant="success">Активный</Badge>
 * <Badge variant="warning" dot>Ожидание</Badge>
 * <Badge variant="danger" size="sm">Просрочен</Badge>
 */
export function Badge({
  children,
  variant = 'default',
  size    = 'md',
  dot     = false,
  color,
  bg,
}: BadgeProps) {
  const cls = [styles.badge, VARIANT_CLASS[variant], SIZE_CLASS[size]].join(' ');

  const inlineStyle = (color || bg) ? { color, background: bg } : undefined;

  return (
    <span className={cls} style={inlineStyle}>
      {dot && (
        <span
          className={styles.dot}
          style={color ? { background: color } : undefined}
        />
      )}
      {children}
    </span>
  );
}
