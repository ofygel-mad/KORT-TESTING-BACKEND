import s from '../customers/spa/CustomersSPA.module.css';
import styles from '../../components/Workspace.module.css';

export function DraftTilePreview() {
  return (
    <div className={styles.previewFrame}>
      <div className={styles.previewHeaderRow}>
        <span>Блок</span><span>Тип</span><span>Статус</span>
      </div>
      <div className={styles.previewBody}>
        <div className={styles.previewEmpty}>
          Пустой черновик. Настройте под себя.
        </div>
      </div>
    </div>
  );
}
