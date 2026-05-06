import styles from '../../components/Workspace.module.css';

export function ImportsTilePreview() {
  return (
    <div className={styles.importPreview}>
      <div className={styles.importStageList}>
        <div className={styles.importStageItem}><span>01</span><strong>Загрузка файла</strong></div>
        <div className={styles.importStageItem}><span>02</span><strong>Проверка структуры</strong></div>
        <div className={styles.importStageItem}><span>03</span><strong>Сопоставление полей</strong></div>
        <div className={styles.importStageItem}><span>04</span><strong>Финальный импорт</strong></div>
      </div>
    </div>
  );
}
