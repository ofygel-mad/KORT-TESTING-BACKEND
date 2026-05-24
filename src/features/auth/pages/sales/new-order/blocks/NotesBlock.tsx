// ЧАСТЬ X / P2a — new-order form block 05: internal notes. JSX lifted verbatim
// from NewOrderPage.tsx section 05; closure refs come from context.

import { useNewOrderForm } from '../NewOrderFormContext';
import styles from '../../NewOrderPage.module.css';

export function NotesBlock() {
  const { register } = useNewOrderForm();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionNum}>05</span>
        <span className={styles.sectionTitle}>Примечания</span>
      </div>
      <div className={styles.sectionBody}>
        <div className={styles.field}>
          <label className={styles.label}>Внутренняя заметка (только для команды)</label>
          <textarea {...register('managerNote')} className={styles.textarea} placeholder="Особые пожелания, договорённости..." rows={3} aria-label="Внутренняя заметка" />
        </div>
      </div>
    </section>
  );
}
