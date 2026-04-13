import type { WorkspaceSnapshot } from '../../model/types';
import styles from '../../components/Workspace.module.css';

const STATUS_LABEL: Record<string, string> = {
  active: 'Активный',
  new: 'Новый',
  inactive: 'Неактивный',
  archived: 'Архив',
};

export function CustomersTilePreview({ snapshot }: { snapshot?: WorkspaceSnapshot }) {
  const rows = snapshot?.recentCustomers ?? [];

  return (
    <div className={styles.previewFrame}>
      <div className={styles.previewHeaderRow}>
        <span>Клиент</span>
        <span>Компания</span>
        <span>Статус</span>
      </div>
      <div className={styles.previewBody}>
        {rows.length === 0 ? (
          <div className={styles.previewEmpty}>Пока пусто. Тут появится живая выборка клиентов.</div>
        ) : rows.map((row) => (
          <div key={row.id} className={styles.tableRow3}>
            <strong>{row.fullName}</strong>
            <span>{row.companyName || 'Без компании'}</span>
            <span>{STATUS_LABEL[row.status] ?? 'В работе'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
