import type { OrderFormProduct, VariantAvailabilityResult } from '@/entities/warehouse/types';
import styles from './LiveStockPill.module.css';

interface LiveStockPillProps {
  product: OrderFormProduct | null | undefined;
  attrs: Record<string, string>;
  availability: VariantAvailabilityResult | null | undefined;
  loading?: boolean;
}

export function LiveStockPill({ product, attrs, availability, loading }: LiveStockPillProps) {
  if (!product) {
    return <span className={styles.pill} data-tone="grey">—</span>;
  }

  const requiredAxes = product.fields.filter((f) => f.affectsAvailability);
  const isComplete = requiredAxes.every((f) => Boolean(attrs[f.code]));

  if (!isComplete) {
    return (
      <span className={styles.pill} data-tone="grey">
        укажите характеристики
      </span>
    );
  }

  if (loading) {
    return <span className={styles.pill} data-tone="grey">…</span>;
  }

  if (!availability) {
    return <span className={styles.pill} data-tone="grey">нет варианта</span>;
  }

  const tone = availability.status === 'ok' ? 'ok'
    : availability.status === 'low' ? 'low'
    : 'zero';

  const qty = availability.qty;

  return (
    <span className={styles.pill} data-tone={tone}>
      <span className={styles.dot} data-tone={tone} />
      {qty}
    </span>
  );
}
