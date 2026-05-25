// ЧАСТЬ X / P2a — new-order form block 01: client data. JSX lifted verbatim
// from NewOrderPage.tsx section 01; closure refs now come from the form context.
//
// P7: schema-driven rendering. If the active OrderTemplate has a `client`
// section with fields, we render them generically via TemplateAttributeRenderer
// — so e.g. Chemicals shows БИН/ИИН and Furniture shows этаж/лифт without
// hardcoding. Falls back to the legacy clothing-oriented form when no
// template/client section is available (preserves behavior on bare forms).

import { Controller, useFormContext } from 'react-hook-form';
import { formatPersonNameInput } from '@/shared/utils/person';
import { formatKazakhPhoneInput } from '@/shared/utils/kz';
import { useNewOrderForm } from '../NewOrderFormContext';
import { CITIES, SOURCES, SelectOrText } from '../formHelpers';
import { getClientSection } from '@/entities/order/templates';
import { TemplateAttributeRenderer } from '@/shared/ui/TemplateAttributeRenderer';
import styles from '../../NewOrderPage.module.css';

export function ClientBlock() {
  const { control, register, errors, deliveryOptions, activeTemplate } = useNewOrderForm();
  const clientSection = getClientSection(activeTemplate);
  // P7: schema-driven mode kicks in when the active template defines a
  // `client` section with fields. Otherwise fall back to the legacy form
  // (covers BLANK_TEMPLATE-style templates and the no-template case).
  const hasSchema = (clientSection?.fields?.length ?? 0) > 0;

  if (hasSchema) {
    return <SchemaClientBlock />;
  }

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

/**
 * P7: schema-driven variant. Walks `template.sections.client.fields` and
 * renders each via TemplateAttributeRenderer (edit mode). Custom values are
 * persisted to the form's `extraAttributes[key]` bucket (top-level on the
 * order, per formModel.ts:80) so the payload-builder picks them up alongside
 * other template-driven fields.
 *
 * Keys come straight from the template field definitions — no hardcoded
 * mapping to clothing-era columns.
 */
function SchemaClientBlock() {
  const { activeTemplate } = useNewOrderForm();
  const { watch, setValue } = useFormContext();
  const clientSection = getClientSection(activeTemplate);
  if (!clientSection) return null;

  const extraAttributes = watch('extraAttributes') as Record<string, unknown> | undefined;

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionNum}>01</span>
        <span className={styles.sectionTitle}>{clientSection.title || 'Данные клиента'}</span>
      </div>
      <div className={styles.sectionBody}>
        <div className={styles.row3}>
          {clientSection.fields.map((field) => (
            <div key={field.id ?? field.key} className={styles.field}>
              <TemplateAttributeRenderer
                field={field}
                value={(extraAttributes?.[field.key] ?? '') as never}
                mode="edit"
                onChange={(next) => {
                  setValue(`extraAttributes.${field.key}`, next as never, { shouldDirty: true });
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
