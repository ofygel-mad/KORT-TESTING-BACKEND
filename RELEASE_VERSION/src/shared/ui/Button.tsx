import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import { buttonHover, buttonTap, t } from '../motion/presets';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'amber-outline';
type Size    = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?:  Variant;
  size?:     Size;
  icon?:     ReactNode;
  iconRight?: ReactNode;
  loading?:  boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

const VARIANT_CLASS: Record<Variant, string> = {
  'primary':       styles.primary,
  'secondary':     styles.secondary,
  'ghost':         styles.ghost,
  'danger':        styles.danger,
  'amber-outline': styles.amberOutline,
};

const SIZE_CLASS: Record<Size, string> = {
  xs: styles.xs,
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
};

/**
 * Button — core interactive primitive.
 *
 * @example
 * <Button variant="primary" size="md" icon={<Plus size={15} />}>
 *   Новый клиент
 * </Button>
 *
 * <Button variant="secondary" loading={isPending}>
 *   Сохранить
 * </Button>
 */
export function Button({
  variant  = 'primary',
  size     = 'md',
  icon,
  iconRight,
  loading,
  fullWidth,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const cls = [
    styles.btn,
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    fullWidth ? styles.fullWidth : '',
    className ?? '',
  ].join(' ').trim();

  return (
    <motion.button
      className={cls}
      disabled={isDisabled}
      whileHover={!isDisabled ? buttonHover : undefined}
      whileTap={!isDisabled ? buttonTap : undefined}
      transition={t.fast}
      {...props}
    >
      {loading ? (
        <span className={styles.spinner} />
      ) : (
        <>
          {icon      && <span className={styles.icon}>{icon}</span>}
          {children}
          {iconRight && <span className={styles.icon}>{iconRight}</span>}
        </>
      )}
    </motion.button>
  );
}
