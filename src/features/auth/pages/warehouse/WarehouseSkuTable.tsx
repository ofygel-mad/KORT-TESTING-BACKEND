// P7: schema-driven column rendering.
//
// Headings are derived from the active OrderTemplate's items-section fields
// that are flagged `affectsAvailability` — so a Chemicals org sees
// «Концентрация / Упаковка» columns and a Furniture org sees «Ширина /
// Высота / Глубина / Материал». Falls back to the legacy clothing-quartet
// (Цвет / Пол / Размер / Длина) only when the org has no template yet.
//
// Gender label normalisation is keyed off the field key — so it kicks in
// only when an actual `gender` field is present, not for any select with
// muж/жен strings inside.

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useWarehouseItems } from '@/entities/warehouse/queries';
import type { WarehouseItem } from '@/entities/warehouse/types';
import { useActiveOrderTemplate } from '@/entities/order/templatesApi';
import { getItemsSection, type OrderTemplateField } from '@/entities/order/templates';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StockIndicator } from '@/shared/ui/StockIndicator';
import { filterItemsByStatus } from './warehouseGrouping';
import styles from './WarehouseSkuTable.module.css';

type StatusFilter = 'all' | 'instock' | 'reserved' | 'empty';

interface WarehouseSkuTableProps {
  search: string;
  statusFilter: StatusFilter;
  onSelectItem: (itemId: string) => void;
  verificationRequired?: boolean;
}


const ITEMS_PER_PAGE = 25;
const EM_DASH = '—';
const EMPTY_TITLE = 'Нет товаров';
const EMPTY_DESCRIPTION = 'Попробуйте изменить фильтры или выполнить поиск.';
const HEADING_PRODUCT = 'Товар';
const HEADING_STOCK = 'На складе';
const GENDER_LABEL_MALE = 'Мужской';
const GENDER_LABEL_FEMALE = 'Женский';
const PAGINATION_PREV = 'Пред.';
const PAGINATION_NEXT = 'След.';
const PAGINATION_PAGE = 'Стр.';
const PAGINATION_OF = 'из';

// Legacy fallback used only when the org has no active OrderTemplate (e.g.
// freshly provisioned org during first GET). Once any template is in place,
// columns are 100% schema-driven.
const LEGACY_AXIS_COLUMNS: Array<{ key: string; label: string }> = [
  { key: 'color',  label: 'Цвет' },
  { key: 'gender', label: 'Пол' },
  { key: 'size',   label: 'Размер' },
  { key: 'length', label: 'Длина' },
];

const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });

const getAttributeValue = (item: WarehouseItem, key: string): string =>
  item.attributesJson?.[key]?.trim() || EM_DASH;

/**
 * P7: applies only to the conventional `gender` field key — so a Chemicals
 * select with values 'I'/'II' is left untouched. Generic fields render their
 * raw value as-is (no special-casing).
 */
const formatGenderLabel = (raw: string): string => {
  const value = raw.trim().toLowerCase();
  if (value === 'male' || value === 'муж' || value === 'мужской') return GENDER_LABEL_MALE;
  if (value === 'female' || value === 'жен' || value === 'женский') return GENDER_LABEL_FEMALE;
  return raw || EM_DASH;
};

const sortSkuItems = (items: WarehouseItem[], axisKeys: string[]) =>
  [...items].sort((left, right) => {
    const nameCompare = collator.compare(left.name, right.name);
    if (nameCompare !== 0) return nameCompare;

    for (const key of axisKeys) {
      const cmp = collator.compare(getAttributeValue(left, key), getAttributeValue(right, key));
      if (cmp !== 0) return cmp;
    }

    return collator.compare(left.id, right.id);
  });

export const WarehouseSkuTable: React.FC<WarehouseSkuTableProps> = ({
  search,
  statusFilter,
  onSelectItem,
  verificationRequired,
}) => {
  const { data: items, isLoading } = useWarehouseItems({
    search: search || undefined,
    verificationRequired,
  });
  // P7: column definitions are derived from the active OrderTemplate. We
  // can't pick a per-row template because the warehouse view is org-wide;
  // taking the default template is good enough for header labels — values
  // still render straight from `attributesJson[key]` so other-template rows
  // simply show «—» under foreign columns.
  const { data: activeTemplate } = useActiveOrderTemplate();

  const axisColumns = useMemo<Array<{ key: string; label: string }>>(() => {
    const itemsSection = getItemsSection(activeTemplate);
    const fields = (itemsSection?.fields ?? []).filter(
      (f: OrderTemplateField) => f.affectsAvailability === true,
    );
    if (fields.length === 0) {
      return LEGACY_AXIS_COLUMNS;
    }
    return fields.map((f) => ({ key: f.key, label: f.label }));
  }, [activeTemplate]);

  const axisKeys = useMemo(() => axisColumns.map((c) => c.key), [axisColumns]);

  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const itemsArray = items?.results || [];
    return sortSkuItems(filterItemsByStatus(itemsArray, statusFilter), axisKeys);
  }, [items, statusFilter, axisKeys]);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    setPage((currentPage) => Math.min(currentPage, totalPages - 1));
  }, [filtered.length]);

  const paginatedItems = useMemo(() => {
    const start = page * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.tableWrapper}>
          <div className={styles.table}>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className={styles.rowSkeleton}>
                <Skeleton width="80%" height={16} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className={styles.container}>
        <EmptyState title={EMPTY_TITLE} description={EMPTY_DESCRIPTION} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th className={styles.thCol}>{HEADING_PRODUCT}</th>
              {axisColumns.map((col) => (
                <th key={col.key} className={styles.thCol}>{col.label}</th>
              ))}
              <th className={styles.thCol}>{HEADING_STOCK}</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((item) => (
              <tr
                key={item.id}
                className={styles.row}
                onClick={() => onSelectItem(item.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectItem(item.id);
                  }
                }}
                tabIndex={0}
              >
                <td className={`${styles.col} ${styles.nameCol}`}>{item.name}</td>
                {axisColumns.map((col) => {
                  const raw = getAttributeValue(item, col.key);
                  const display = col.key === 'gender' && raw !== EM_DASH
                    ? formatGenderLabel(raw)
                    : raw;
                  return (
                    <td key={col.key} className={styles.col}>{display}</td>
                  );
                })}
                <td className={styles.col}>
                  <StockIndicator qty={item.qty} reserved={item.qtyReserved} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
          >
            <ChevronLeft size={16} />
            {PAGINATION_PREV}
          </button>

          <div className={styles.pageInfo}>
            {PAGINATION_PAGE} {page + 1} {PAGINATION_OF} {totalPages}
          </div>

          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
          >
            {PAGINATION_NEXT}
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
