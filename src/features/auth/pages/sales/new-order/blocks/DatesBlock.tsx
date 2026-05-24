// ЧАСТЬ X / P2a — new-order form block 03: dates & priority. JSX lifted
// verbatim from NewOrderPage.tsx section 03; closure refs come from context.

import { AlertTriangle, Star } from 'lucide-react';
import { useNewOrderForm } from '../NewOrderFormContext';
import styles from '../../NewOrderPage.module.css';

export function DatesBlock() {
  const { register, urgency, setValue, isDemandingClient } = useNewOrderForm();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionNum}>03</span>
        <span className={styles.sectionTitle}>Сроки и приоритет</span>
      </div>
      <div className={styles.sectionBody}>
        <div className={styles.row3}>
          <div className={styles.field}>
            <label className={styles.label}>Дата принятия заказа</label>
            <input {...register('orderDate')} type="date" className={styles.input} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Срок готовности</label>
            <input {...register('dueDate')} type="date" className={styles.input} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Приоритет</label>
            <div className={styles.priorityGroup}>
              <button
                type="button"
                className={`${styles.priorityBtn} ${urgency === 'normal' ? styles.priorityBtnActive : ''}`}
                onClick={() => setValue('urgency', 'normal')}
              >
                Обычный
              </button>
              <button
                type="button"
                className={`${styles.priorityBtn} ${styles.priorityBtnUrgent} ${urgency === 'urgent' ? styles.priorityBtnActive : ''}`}
                onClick={() => setValue('urgency', 'urgent')}
              >
                <AlertTriangle size={11} /> Срочно
              </button>
            </div>
            <label className={styles.demandingToggle}>
              <input
                type="checkbox"
                checked={isDemandingClient}
                onChange={e => setValue('isDemandingClient', e.target.checked)}
                className={styles.demandingCheckbox}
              />
              <span><Star size={11} /> Требовательный клиент</span>
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
