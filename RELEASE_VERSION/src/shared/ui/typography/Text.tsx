import type { CSSProperties, ElementType, ReactNode } from 'react';

type TextSize   = 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl';
type TextColor  = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'inverse' | 'inherit';
type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold';
type TextAs     = 'p' | 'span' | 'div' | 'label' | 'small' | 'strong' | 'em';

const SIZE_MAP: Record<TextSize, string> = {
  xs:   'var(--text-size-xs)',
  sm:   'var(--text-size-sm)',
  base: 'var(--text-size-base)',
  md:   'var(--text-size-md)',
  lg:   'var(--text-size-lg)',
  xl:   'var(--text-size-xl)',
};

const COLOR_MAP: Record<TextColor, string> = {
  primary:   'var(--text-primary)',
  secondary: 'var(--text-secondary)',
  tertiary:  'var(--text-tertiary)',
  accent:    'var(--text-accent)',
  inverse:   'var(--text-inverse)',
  inherit:   'inherit',
};

const WEIGHT_MAP: Record<TextWeight, number> = {
  normal:   400,
  medium:   500,
  semibold: 600,
  bold:     700,
};

interface TextProps {
  children: ReactNode;
  as?: TextAs;
  size?: TextSize;
  color?: TextColor;
  weight?: TextWeight;
  mono?: boolean;
  truncate?: boolean;
  className?: string;
  style?: CSSProperties;
  htmlFor?: string; // for label
}

/**
 * Text — base typography primitive.
 * Использовать вместо ad-hoc fontSize/fontWeight/color в inline-стилях.
 *
 * @example
 * <Text size="base" color="secondary">Вторичный текст</Text>
 * <Text size="sm" color="tertiary" mono>2024-01-15</Text>
 * <Text size="md" weight="semibold">Заголовок карточки</Text>
 */
export function Text({
  children,
  as: Tag = 'span',
  size = 'md',
  color = 'primary',
  weight = 'normal',
  mono = false,
  truncate = false,
  className,
  style,
  htmlFor,
}: TextProps) {
  const computedStyle: CSSProperties = {
    fontSize:   SIZE_MAP[size],
    color:      COLOR_MAP[color],
    fontWeight: WEIGHT_MAP[weight],
    fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
    ...(truncate ? {
      overflow:     'hidden',
      textOverflow: 'ellipsis',
      whiteSpace:   'nowrap',
    } : {}),
    ...style,
  };

  return (
    // @ts-ignore — dynamic tag
    <Tag
      className={className}
      style={computedStyle}
      {...(htmlFor ? { htmlFor } : {})}
    >
      {children}
    </Tag>
  );
}

// ─── Convenience wrappers ──────────────────────────────────────────────────
/**
 * Caption — метаинформация, timestamp, подсказки.
 * 12px, secondary color.
 */
export function Caption({ children, color = 'tertiary', style, className }: Omit<TextProps, 'size'>) {
  return <Text as="span" size="sm" color={color} style={style} className={className}>{children}</Text>;
}

/**
 * Label — для контролов и форм.
 * 13px, medium weight, secondary.
 */
export function Label({ children, htmlFor, style, className }: Omit<TextProps, 'size' | 'as'>) {
  return (
    <Text as="label" size="base" weight="medium" color="secondary" htmlFor={htmlFor} style={style} className={className}>
      {children}
    </Text>
  );
}
