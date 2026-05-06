// features/workspace/widgets/warehouse/WarehouseTilePreview.tsx

import { useEffect } from 'react';
import { AlertTriangle, Package } from 'lucide-react';
import { useWarehouseStore } from '../../../warehouse-spa/model/warehouse.store';
import styles from '../../components/Workspace.module.css';
import s from './WarehouseTilePreview.module.css';

export function WarehouseTilePreview({ tileId: _tileId }: { tileId: string }) {
  const { summary, loadSummary } = useWarehouseStore();

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  if (!summary) {
    return (
      <div className={styles.previewFrame}>
        <div className={s.empty}>
          <Package size={18} strokeWidth={1.5} />
          <span>Загрузка...</span>
        </div>
      </div>
    );
  }

  const { totalItems, openAlerts, lowStockCount, lowItems } = summary;

  return (
    <div className={styles.previewFrame}>
      <div className={styles.previewHeaderRow}>
        <span>Позиции</span>
        <span>Мало</span>
        <span>Оповещения</span>
      </div>

      <div className={styles.previewBody}>
        <div className={styles.tableRow3}>
          <strong>{totalItems}</strong>
          <span className={lowStockCount > 0 ? s.warn : ''}>{lowStockCount}</span>
          <span className={openAlerts > 0 ? s.danger : s.ok}>
            {openAlerts > 0 ? openAlerts : '—'}
          </span>
        </div>

        {lowItems.slice(0, 2).map((item) => (
          <div key={item.id} className={`${styles.tableRow3} ${s.lowRow}`}>
            <span className={s.itemName}>{item.name}</span>
            <span className={s.warn}>
              {(item.qty - item.qtyReserved).toFixed(1)} / {item.qtyMin} {item.unit}
            </span>
            <span>
              <AlertTriangle size={11} className={s.alertIcon} />
            </span>
          </div>
        ))}

        {lowItems.length === 0 && (
          <div className={`${styles.tableRow3} ${s.allGood}`}>
            <span className={s.ok}>Все запасы в норме</span>
            <span />
            <span />
          </div>
        )}
      </div>
    </div>
  );
}
