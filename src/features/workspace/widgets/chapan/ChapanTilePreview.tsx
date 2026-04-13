import { useChapanStore } from '../../../chapan-spa/model/chapan.store';
import { useTileProductionShell } from './spa/production-shell.store';
import styles from '../../components/Workspace.module.css';

export function ChapanTilePreview({ tileId }: { tileId: string }) {
  const { orders, profile } = useChapanStore();
  const { templateName } = useTileProductionShell(tileId);

  const active = orders.filter(
    (o) => o.status !== 'cancelled' && o.status !== 'completed',
  );
  const tasks = active.flatMap((o) => o.productionTasks);
  const blocked = tasks.filter((t) => t.isBlocked).length;
  const inFlow  = tasks.filter((t) => t.status !== 'pending' && t.status !== 'done').length;
  const done    = tasks.filter((t) => t.status === 'done').length;

  return (
    <div className={styles.previewFrame}>
      <div className={styles.previewHeaderRow}>
        <span>Цех</span>
        <span>В работе</span>
        <span>Статус</span>
      </div>

      <div className={styles.previewBody}>
        <div className={styles.tableRow3}>
          <strong>{profile.displayName}</strong>
          <span>{inFlow} заданий</span>
          <span>{blocked > 0 ? `${blocked} блок.` : 'без блоков'}</span>
        </div>
        <div className={styles.tableRow3}>
          <strong>{templateName || 'Шаблон'}</strong>
          <span>{done} готово</span>
          <span>{active.length} заказов</span>
        </div>
      </div>
    </div>
  );
}
