import { type ReactNode } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import s from './ResponsiveDataView.module.css';

export interface ColumnDef<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
  /** Hint to hide on smaller breakpoints when caller renders the table itself. */
  hiddenOn?: 'mobile' | 'tablet';
}

export interface ResponsiveDataViewProps<T> {
  rows: T[];
  rowKey: (row: T) => string;
  columns: ColumnDef<T>[];
  /** Mobile-only card render. Receives the full row plus an isActive flag for decoration. */
  renderCard: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  /** Override the desktop/mobile breakpoint. Default 768. */
  breakpoint?: number;
  emptyState?: ReactNode;
  loading?: boolean;
  loadingState?: ReactNode;
  stickyHeader?: boolean;
  ariaLabel?: string;
  /** Force one mode regardless of viewport. Useful for tests / Storybook. */
  forceMode?: 'table' | 'cards';
}

const ALIGN_CLASS: Record<NonNullable<ColumnDef<unknown>['align']>, string> = {
  left:   s.alignLeft,
  right:  s.alignRight,
  center: s.alignCenter,
};

/**
 * Renders a <table> on desktop (≥breakpoint) and a list of cards on mobile.
 * Same data source, two presentations — caller doesn't fork its data layer.
 */
export function ResponsiveDataView<T>({
  rows,
  rowKey,
  columns,
  renderCard,
  onRowClick,
  breakpoint = 768,
  emptyState,
  loading = false,
  loadingState,
  stickyHeader = false,
  ariaLabel,
  forceMode,
}: ResponsiveDataViewProps<T>) {
  const isMobile = useIsMobile(breakpoint);
  const mode = forceMode ?? (isMobile ? 'cards' : 'table');

  if (loading) return <div className={s.loading}>{loadingState ?? 'Загрузка...'}</div>;
  if (rows.length === 0) return <div className={s.empty}>{emptyState ?? 'Ничего не найдено'}</div>;

  if (mode === 'cards') {
    return (
      <ul className={s.cardList} aria-label={ariaLabel}>
        {rows.map((row) => {
          const key = rowKey(row);
          const interactive = !!onRowClick;
          return (
            <li
              key={key}
              className={`${s.cardItem} ${interactive ? '' : s.cardItemNonInteractive}`}
              onClick={interactive ? () => onRowClick(row) : undefined}
              onKeyDown={interactive ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); }
              } : undefined}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
            >
              {renderCard(row)}
            </li>
          );
        })}
      </ul>
    );
  }

  // Desktop table
  const visibleColumns = columns.filter((c) => c.hiddenOn !== 'tablet' || !isMobile);

  return (
    <div className={s.tableWrap}>
      <table className={s.table} aria-label={ariaLabel}>
        <thead>
          <tr>
            {visibleColumns.map((col) => (
              <th
                key={col.key}
                className={`${col.align ? ALIGN_CLASS[col.align] : ''} ${stickyHeader ? s.thSticky : ''}`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            return (
              <tr
                key={key}
                className={onRowClick ? s.rowClickable : ''}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {visibleColumns.map((col) => (
                  <td key={col.key} className={col.align ? ALIGN_CLASS[col.align] : ''}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
