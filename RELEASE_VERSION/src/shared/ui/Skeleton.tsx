import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  style?: CSSProperties;
  className?: string;
}

const BASE: CSSProperties = {
  background:     'linear-gradient(90deg, var(--skeleton-from) 25%, var(--skeleton-to) 50%, var(--skeleton-from) 75%)',
  backgroundSize: '200% 100%',
  animation:      'shimmer 1.5s ease-in-out infinite',
};

/** Base skeleton primitive */
export function Skeleton({ width = '100%', height = 16, radius = 'var(--radius-sm)', style, className }: SkeletonProps) {
  return <div className={className} style={{ width, height, borderRadius: radius, flexShrink: 0, ...BASE, ...style }} />;
}

/** Skeleton for a single line of text */
export function SkeletonText({ width = '70%', style }: { width?: string | number; style?: CSSProperties }) {
  return <Skeleton width={width} height={14} radius="var(--radius-xs)" style={style} />;
}

/** Skeleton for a circular avatar */
export function SkeletonAvatar({ size = 36 }: { size?: number }) {
  return <Skeleton width={size} height={size} radius="50%" />;
}

/** Skeleton for a stat/metric card */
export function SkeletonCard({ style }: { style?: CSSProperties }) {
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--card-border)',
      borderRadius: 'var(--radius-lg)', padding: '16px 18px', ...style,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Skeleton width={32} height={32} radius="var(--radius-md)" />
      </div>
      <Skeleton width={80} height={24} radius="var(--radius-sm)" style={{ marginBottom: 8 }} />
      <SkeletonText width="60%" />
    </div>
  );
}

/** Skeleton for a table row */
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  const widths = ['40%', '25%', '20%', '15%'];
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 16,
      padding: '12px 16px',
      borderBottom: '1px solid var(--table-border)',
      alignItems: 'center',
    }}>
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonText key={i} width={widths[i] ?? '50%'} />
      ))}
    </div>
  );
}

/** Full-page skeleton rows */
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </div>
  );
}
