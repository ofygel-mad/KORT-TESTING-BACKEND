import type { CSSProperties, ReactNode } from 'react';

type HeadingLevel = 1 | 2 | 3 | 'display-xl' | 'display-lg' | 'title';
type HeadingAs    = 'h1' | 'h2' | 'h3' | 'h4' | 'div' | 'span';

const LEVEL_STYLES: Record<string, CSSProperties> = {
  'display-xl': {
    fontFamily:    'var(--font-display)',
    fontSize:      'var(--text-size-4xl)',
    fontWeight:    800,
    lineHeight:    1.1,
    letterSpacing: '-0.03em',
  },
  'display-lg': {
    fontFamily:    'var(--font-display)',
    fontSize:      'var(--text-size-3xl)',
    fontWeight:    700,
    lineHeight:    1.15,
    letterSpacing: '-0.025em',
  },
  1: {
    fontFamily:    'var(--font-display)',
    fontSize:      'var(--text-size-2xl)',
    fontWeight:    700,
    lineHeight:    1.2,
    letterSpacing: '-0.02em',
  },
  2: {
    fontFamily:    'var(--font-display)',
    fontSize:      'var(--text-size-xl)',
    fontWeight:    600,
    lineHeight:    1.3,
    letterSpacing: '-0.015em',
  },
  3: {
    fontFamily:    'var(--font-display)',
    fontSize:      'var(--text-size-lg)',
    fontWeight:    600,
    lineHeight:    1.35,
    letterSpacing: '-0.01em',
  },
  title: {
    fontFamily:    'var(--font-body)',
    fontSize:      'var(--text-size-md)',
    fontWeight:    600,
    lineHeight:    1.4,
    letterSpacing: '0',
  },
};

const DEFAULT_TAG: Record<string, HeadingAs> = {
  'display-xl': 'h1',
  'display-lg': 'h1',
  1: 'h1',
  2: 'h2',
  3: 'h3',
  title: 'div',
};

interface HeadingProps {
  children: ReactNode;
  level?: HeadingLevel;
  as?: HeadingAs;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Heading — заголовки с фиксированной иерархией.
 *
 * @example
 * <Heading level={1}>Клиенты</Heading>
 * <Heading level={2}>Активные сделки</Heading>
 * <Heading level="title">Карточка клиента</Heading>
 * <Heading level="display-lg">Добро пожаловать</Heading>
 */
export function Heading({
  children,
  level = 2,
  as,
  color = 'var(--text-primary)',
  className,
  style,
}: HeadingProps) {
  const levelKey = String(level);
  const Tag = (as ?? DEFAULT_TAG[levelKey] ?? 'h2') as React.ElementType;
  const levelStyle = LEVEL_STYLES[levelKey] ?? LEVEL_STYLES[2];

  return (
    <Tag
      className={className}
      style={{ color, ...levelStyle, ...style }}
    >
      {children}
    </Tag>
  );
}
