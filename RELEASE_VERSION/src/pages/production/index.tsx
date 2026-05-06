import { AlertTriangle, Factory } from 'lucide-react';
import styles from './Production.module.css';

export default function ProductionPage() {
  return (
    <div className={styles.root}>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>
          <Factory size={14} />
          <span>Отдельный модуль</span>
        </div>

        <h1 className={styles.title}>Производство</h1>
        <div className={styles.warning}>
          <div className={styles.warningIcon}>
            <AlertTriangle size={18} />
          </div>
          <div className={styles.warningBody}>
            <strong>В разработке</strong>
            <p>
              Рабочие сценарии, статусы и маршруты ещё собираются. Раздел будет доступен
              после завершения разработки производственного контура.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
