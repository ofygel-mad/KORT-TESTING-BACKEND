// ЧАСТЬ X / P2a — new-order form block 01: client data. JSX lifted verbatim
// from NewOrderPage.tsx section 01; closure refs now come from the form context.

import { Controller } from 'react-hook-form';
import { formatPersonNameInput } from '@/shared/utils/person';
import { formatKazakhPhoneInput } from '@/shared/utils/kz';
import { useNewOrderForm } from '../NewOrderFormContext';
import { CITIES, SOURCES, SelectOrText } from '../formHelpers';
import styles from '../../NewOrderPage.module.css';

export function ClientBlock() {
  const { control, register, errors, deliveryOptions } = useNewOrderForm();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionNum}>01</span>
        <span className={styles.sectionTitle}>Данные клиента</span>
      </div>
      <div className={styles.sectionBody}>
        <div className={styles.row3}>
          <div className={styles.field}>
            <label className={styles.label}>ФИО клиента <span className={styles.req}>*</span></label>
            <Controller
              control={control}
              name="clientName"
              render={({ field }) => (
                <input
                  {...field}
                  value={field.value ?? ''}
                  onChange={(event) => field.onChange(formatPersonNameInput(event.target.value))}
                  aria-label="ФИО клиента"
                  className={`${styles.input} ${errors.clientName ? styles.inputError : ''}`}
                  placeholder="Аскаров Аскар Аскарович"
                  autoFocus
                />
              )}
            />
            {errors.clientName && <span className={styles.fieldError}>{errors.clientName.message}</span>}
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Телефон KZ <span className={styles.req}>*</span></label>
            <Controller
              control={control}
              name="clientPhone"
              render={({ field }) => (
                <input
                  {...field}
                  type="tel"
                  inputMode="tel"
                  value={field.value ?? ''}
                  onChange={(event) => field.onChange(formatKazakhPhoneInput(event.target.value))}
                  aria-label="Телефон KZ"
                  className={`${styles.input} ${errors.clientPhone ? styles.inputError : ''}`}
                  placeholder="+7 (701)-234-56-78"
                />
              )}
            />
            {errors.clientPhone && <span className={styles.fieldError}>{errors.clientPhone.message}</span>}
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Для иностранных номеров</label>
            <Controller
              control={control}
              name="clientPhoneForeign"
              render={({ field }) => (
                <input
                  {...field}
                  type="tel"
                  inputMode="tel"
                  value={field.value ?? ''}
                  onChange={(event) => field.onChange(event.target.value)}
                  aria-label="Иностранный телефон"
                  className={styles.input}
                  placeholder="+44 7700 900123"
                />
              )}
            />
          </div>
        </div>
        <div className={styles.row3}>
          <div className={styles.field}>
            <label className={styles.label}>Город</label>
            <Controller control={control} name="city" render={({ field }) => (
              <SelectOrText {...field} value={field.value ?? ''} options={CITIES} placeholder="Алматы" className={styles.input} aria-label="Город" />
            )} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Почтовый индекс</label>
            <input {...register('postalCode')} className={styles.input} placeholder="050000" maxLength={10} aria-label="Почтовый индекс" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Доставка</label>
            <Controller control={control} name="deliveryType" render={({ field }) => (
              <SelectOrText {...field} value={field.value ?? ''} options={deliveryOptions} placeholder="Выберите или введите" className={styles.input} aria-label="Доставка" />
            )} />
          </div>
        </div>
        <div className={styles.rowFull}>
          <div className={styles.field}>
            <label className={styles.label}>Адрес доставки</label>
            <input
              {...register('streetAddress')}
              className={styles.input}
              placeholder="ул. Абая 10, кв. 5 / ориентир"
              aria-label="Адрес доставки"
            />
          </div>
        </div>
        <div className={styles.rowHalf}>
          <div className={styles.field}>
            <label className={styles.label}>Источник</label>
            <Controller control={control} name="source" render={({ field }) => (
              <SelectOrText {...field} value={field.value ?? ''} options={SOURCES} placeholder="Instagram, звонок..." className={styles.input} aria-label="Источник" />
            )} />
          </div>
        </div>
      </div>
    </section>
  );
}
