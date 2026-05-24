// ЧАСТЬ X / P2a + P5 — new-order form block 02: order line items.
//
// Pre-P5: hardcoded gender/color/length/size everywhere.
// P5: legacy fields (gender/color/length/size) are now CONDITIONAL — they
// only render when the active OrderTemplate's items section includes those
// keys. New custom fields (sku, serial, hazard, etc.) render in an extra
// row using <TemplateAttributeRenderer>. Calculations remain untouched —
// quantity/unitPrice/itemDiscount stay as dedicated columns.

import { Controller } from 'react-hook-form';
import { AlertCircle, Calculator, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { SearchableSelect } from '@/shared/ui/SearchableSelect';
import { buildVariantLookupKey } from '@/shared/utils/variantAvailability';
import { useActiveOrderTemplate } from '@/entities/order/templatesApi';
import { getItemsSection } from '@/entities/order/templates';
import { TemplateAttributeRenderer } from '@/shared/ui/TemplateAttributeRenderer';
import { useNewOrderForm } from '../NewOrderFormContext';
import { createEmptyItem } from '../formModel';
import { parseOptionalAmount, parseOptionalInteger } from '../formHelpers';
import styles from '../../NewOrderPage.module.css';

// Field keys that map to dedicated columns on OrderItem (dual-write target).
// Their rendering uses the legacy widgets (SearchableSelect for color/size,
// gender toggle, etc.) rather than the generic TemplateAttributeRenderer so
// that warehouse availability lookups continue to work as before.
const LEGACY_ITEM_KEYS = new Set(['gender', 'color', 'length', 'size', 'product', 'productName']);

export function LineItemsBlock() {
  const {
    isWholesale, fields, items, control, register, errors, append, remove,
    getAvailabilityInput, getEffectiveFields, getMissingAxes, getCatalogOptions,
    variantMap, stockMap, globalWarehouseLengths, globalWarehouseColors,
    enrichedProductOptions, sizeOptions, itemsTotal, fmt, itemPhotos, setItemPhotos,
    selectedTemplateId,
  } = useNewOrderForm();

  // P5: active OrderTemplate drives field visibility. Picker selection (if any)
  // wins over the system default. Falling back to the pre-P5 layout when no
  // template is loaded keeps clothing orgs working even if the endpoint fails.
  const { data: template } = useActiveOrderTemplate(selectedTemplateId);
  const itemsSection = getItemsSection(template);
  const templateKeys = new Set((itemsSection?.fields ?? []).map((f) => f.key));
  const showLegacy = (key: string) =>
    !template || itemsSection === null || templateKeys.has(key);
  const customItemFields = (itemsSection?.fields ?? []).filter(
    (f) => !LEGACY_ITEM_KEYS.has(f.key),
  );

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionNum}>02</span>
        <span className={styles.sectionTitle}>Позиции заказа</span>
      </div>
      <div className={styles.sectionBody}>
      {isWholesale ? (
        <>
          <div className={styles.wtable}>
            <div className={styles.wtableHead}>
              <span>Наименование</span>
              <span>Пол</span>
              <span>Длина</span>
              <span>Цвет</span>
              <span>Размер</span>
              <span>Кол-во</span>
              <span>Цена, ₸</span>
              <span>Скидка</span>
              <span>Сумма</span>
              <span>Наличие</span>
              <span></span>
            </div>
            {fields.map((field, idx) => {
              const _item = items[idx];
              const linePrice = (Number(_item?.quantity) || 0) * (Number(_item?.unitPrice) || 0);
              const lineDisc = Number(_item?.itemDiscount) || 0;
              const lineTotal = Math.max(0, linePrice - lineDisc);
              const availabilityInput = getAvailabilityInput(_item);
              const productFields = getEffectiveFields(_item?.productName?.trim() ?? '');
              const requiredAxes = (productFields ?? []).filter(f => f.affectsAvailability);
              const missingAxes = getMissingAxes(_item);
              const allAxesFilled = requiredAxes.length > 0 && missingAxes.length === 0;
              const isCommodity = requiredAxes.length === 0;
              const variantStock = availabilityInput && variantMap && allAxesFilled
                ? variantMap[buildVariantLookupKey(availabilityInput.name, availabilityInput, productFields)]
                : undefined;
              const productStock = _item?.productName && stockMap ? stockMap[_item.productName] : undefined;
              const itemStock = variantStock
                ? { available: variantStock.available > 0, qty: variantStock.available, status: variantStock.status, missing: false as const }
                : isCommodity && productStock
                  ? { available: productStock.available, qty: productStock.qty, status: undefined as undefined, missing: false as const }
                  : !isCommodity && !allAxesFilled
                    ? { available: false, qty: 0, status: undefined as undefined, missing: true as const, missingAxes }
                    : undefined;
              const catalogLengths = getCatalogOptions(_item?.productName ?? '', 'length');
              const lengthOpts = catalogLengths.length > 0 ? catalogLengths : globalWarehouseLengths;
              return (
                <div key={field.id} className={styles.wtableRow}>
                  <div className={styles.wtableCell}>
                    <Controller control={control} name={`items.${idx}.productName`} render={({ field: f }) => (
                      <SearchableSelect options={enrichedProductOptions} value={f.value} onChange={f.onChange} onBlur={f.onBlur} placeholder="Модель…" className={`${styles.wtableInput} ${errors.items?.[idx]?.productName ? styles.inputError : ''}`} />
                    )} />
                  </div>
                  <div className={styles.wtableCell}>
                    <Controller control={control} name={`items.${idx}.gender`} render={({ field: f }) => (
                      <select className={styles.wtableSel} value={f.value ?? ''} onChange={e => f.onChange(e.target.value)} aria-label={`Пол для позиции ${idx + 1}`}>
                        <option value="">—</option>
                        <option value="муж">муж</option>
                        <option value="жен">жен</option>
                      </select>
                    )} />
                  </div>
                  <div className={styles.wtableCell}>
                    <Controller control={control} name={`items.${idx}.length`} render={({ field: f }) => (
                      <select className={styles.wtableSel} value={f.value ?? ''} onChange={e => f.onChange(e.target.value)} aria-label={`Длина для позиции ${idx + 1}`}>
                        <option value="">—</option>
                        {lengthOpts.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )} />
                  </div>
                  <div className={styles.wtableCell}>
                    <Controller control={control} name={`items.${idx}.color`} render={({ field: f }) => {
                      const catalogColors = getCatalogOptions(_item?.productName ?? '', 'color');
                      const colorOpts = catalogColors.length > 0 ? catalogColors : globalWarehouseColors.length > 0 ? globalWarehouseColors : [];
                      return (
                        <SearchableSelect options={colorOpts} value={f.value ?? ''} onChange={f.onChange} onBlur={f.onBlur} placeholder="—" className={styles.wtableInput} />
                      );
                    }} />
                  </div>
                  <div className={styles.wtableCell}>
                    <Controller control={control} name={`items.${idx}.size`} render={({ field: f }) => {
                      const catalogSizes = getCatalogOptions(_item?.productName ?? '', 'size');
                      const opts = catalogSizes.length > 0 ? catalogSizes : sizeOptions;
                      return (
                        <SearchableSelect options={opts} value={f.value} onChange={f.onChange} onBlur={f.onBlur} placeholder="—" className={styles.wtableInput} />
                      );
                    }} />
                  </div>
                  <div className={styles.wtableCell}>
                    <Controller control={control} name={`items.${idx}.quantity`} render={({ field: f }) => (
                      <input
                        type="number"
                        min="1"
                        className={styles.wtableNum}
                        value={f.value ?? ''}
                        onChange={e => f.onChange(parseOptionalInteger(e.target.value))}
                        onBlur={f.onBlur}
                      />
                    )} />
                  </div>
                  <div className={styles.wtableCell}>
                    <Controller control={control} name={`items.${idx}.unitPrice`} render={({ field: f }) => (
                      <input
                        type="number"
                        min="0"
                        className={styles.wtableNum}
                        value={f.value ?? ''}
                        onChange={e => f.onChange(parseOptionalAmount(e.target.value))}
                        onBlur={f.onBlur}
                      />
                    )} />
                    {Number(_item?.unitPrice) > 1_000_000 && (
                      <span className={styles.fieldError} title="Сумма больше миллиона — проверьте, нет ли лишних нулей">
                        ⚠ Лишние нули?
                      </span>
                    )}
                  </div>
                  <div className={styles.wtableCell}>
                    <Controller control={control} name={`items.${idx}.itemDiscount`} render={({ field: f }) => (
                      <input
                        type="number"
                        min="0"
                        className={styles.wtableNum}
                        value={f.value ?? ''}
                        onChange={e => f.onChange(parseOptionalAmount(e.target.value))}
                        onBlur={f.onBlur}
                      />
                    )} />
                  </div>
                  <div className={`${styles.wtableCell} ${styles.wtableTotalCell}`}>{fmt(lineTotal)}</div>
                  <div className={styles.wtableCell}>
                    {itemStock !== undefined && (
                      itemStock.missing ? (
                        <span className={styles.stockBadgeHint} title={`Укажите: ${itemStock.missingAxes.map(f => f.label.toLowerCase()).join(', ')}`}>
                          укажите параметры
                        </span>
                      ) : (
                        <span className={itemStock.status === 'low' ? styles.stockBadgeLow : itemStock.available ? styles.stockBadgeIn : styles.stockBadgeOut}>
                          {itemStock.status === 'low' ? `мало (${itemStock.qty})` : itemStock.available ? `${itemStock.qty} шт.` : 'Нет'}
                        </span>
                      )
                    )}
                  </div>
                  <div className={styles.wtableCell}>
                    {fields.length > 1 && (
                      <button type="button" className={styles.itemRemoveBtn} aria-label={`Удалить позицию ${idx + 1}`} onClick={() => remove(idx)}><Trash2 size={12} /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {errors.items && typeof errors.items.message === 'string' && (
            <div className={styles.formError}><AlertCircle size={13} />{errors.items.message}</div>
          )}
          <div className={styles.itemsFooter}>
            <button type="button" className={styles.addItemBtn} onClick={() => append(createEmptyItem())}>
              <Plus size={13} /> Добавить строку
            </button>
            {itemsTotal > 0 && (
              <div className={styles.itemsTotal}>
                <Calculator size={13} />
                <span>Итого по позициям:</span>
                <strong>{fmt(itemsTotal)}</strong>
                <span className={styles.itemsTotalMeta}>{items.length} {items.length === 1 ? 'позиция' : items.length < 5 ? 'позиции' : 'позиций'} · {items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)} шт.</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {fields.map((field, idx) => {
            const _item = items[idx];
            const linePrice = (Number(_item?.quantity) || 0) * (Number(_item?.unitPrice) || 0);
            const lineDisc = Number(_item?.itemDiscount) || 0;
            const lineTotal = Math.max(0, linePrice - lineDisc);
            const availabilityInput = getAvailabilityInput(_item);
            const variantStock = availabilityInput && variantMap
              ? variantMap[buildVariantLookupKey(availabilityInput.name, availabilityInput, getEffectiveFields(_item?.productName?.trim() ?? ''))]
              : undefined;
            const productStock = _item?.productName && stockMap ? stockMap[_item.productName] : undefined;
            const productFields = getEffectiveFields(_item?.productName?.trim() ?? '');
            const requiredAxes = (productFields ?? []).filter(f => f.affectsAvailability);
            const missingAxes = getMissingAxes(_item);
            const allAxesFilled = requiredAxes.length > 0 && missingAxes.length === 0;
            const isCommodity = requiredAxes.length === 0;
            const catalogLengths = getCatalogOptions(_item?.productName ?? '', 'length');
            const lengthOpts = catalogLengths.length > 0 ? catalogLengths : globalWarehouseLengths;

            return (
              <div key={field.id} className={styles.itemCard}>
                <div className={styles.itemCardHeader}>
                  <span className={styles.itemCardLabel}>Позиция {idx + 1}</span>
                  {fields.length > 1 && (
                    <button type="button" className={styles.itemRemoveBtn} aria-label={`Удалить позицию ${idx + 1}`} onClick={() => remove(idx)}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                <div className={styles.itemRow2}>
                  <div className={styles.field}>
                    <label className={styles.label}>Модель <span className={styles.req}>*</span></label>
                    <Controller control={control} name={`items.${idx}.productName`} render={({ field: f }) => (
                      <SearchableSelect
                        options={enrichedProductOptions}
                        value={f.value}
                        onChange={f.onChange}
                        onBlur={f.onBlur}
                        placeholder="Название товара или услуги"
                        className={`${styles.input} ${errors.items?.[idx]?.productName ? styles.inputError : ''}`}
                        ariaLabel={`Модель позиции ${idx + 1}`}
                      />
                    )} />
                    {errors.items?.[idx]?.productName && <span className={styles.fieldError}>{errors.items[idx]?.productName?.message}</span>}
                  </div>
                  {showLegacy('size') && (
                    <div className={styles.field}>
                      <label className={styles.label}>Размер <span className={styles.req}>*</span></label>
                      <Controller control={control} name={`items.${idx}.size`} render={({ field: f }) => {
                        const catalogSizes = getCatalogOptions(_item?.productName ?? '', 'size');
                        const opts = catalogSizes.length > 0 ? catalogSizes : sizeOptions;
                        return (
                        <SearchableSelect options={opts} value={f.value} onChange={f.onChange} onBlur={f.onBlur} placeholder="48"
                            className={`${styles.input} ${errors.items?.[idx]?.size ? styles.inputError : ''}`}
                            ariaLabel={`Размер позиции ${idx + 1}`}
                          />
                        );
                      }} />
                    </div>
                  )}
                </div>

                {(showLegacy('gender') || showLegacy('length')) && (
                  <div className={styles.itemRow2}>
                    {showLegacy('gender') && (
                      <div className={styles.field}>
                        <label className={styles.label}>Пол</label>
                        <Controller control={control} name={`items.${idx}.gender`} render={({ field: f }) => (
                          <div className={styles.genderBtns}>
                            {(['муж', 'жен'] as const).map((g) => (
                              <button key={g} type="button"
                                className={`${styles.genderBtn} ${f.value === g ? styles.genderBtnActive : ''}`}
                                onClick={() => f.onChange(f.value === g ? '' : g)}
                              >
                                {g === 'муж' ? 'Мужской' : 'Женский'}
                              </button>
                            ))}
                          </div>
                        )} />
                      </div>
                    )}
                    {showLegacy('length') && (
                      <div className={styles.field}>
                        <label className={styles.label}>Длина изделия</label>
                        <Controller control={control} name={`items.${idx}.length`} render={({ field: f }) => (
                          <select value={f.value ?? ''} onChange={e => f.onChange(e.target.value)} onBlur={f.onBlur}
                            className={styles.input} disabled={lengthOpts.length === 0} aria-label={`Длина изделия для позиции ${idx + 1}`}>
                            <option value="">— выбрать —</option>
                            {lengthOpts.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        )} />
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.itemRow4}>
                  {showLegacy('color') && (
                    <div className={styles.field}>
                      <label className={styles.label}>Цвет / материал</label>
                      <Controller control={control} name={`items.${idx}.color`} render={({ field: f }) => {
                        const catalogColors = getCatalogOptions(_item?.productName ?? '', 'color');
                        const colorOpts = catalogColors.length > 0
                          ? catalogColors
                          : globalWarehouseColors.length > 0
                            ? globalWarehouseColors
                            : [];
                        return (
                          <SearchableSelect options={colorOpts} value={f.value ?? ''} onChange={f.onChange} onBlur={f.onBlur}
                            placeholder="Тёмно-синий, бордо..." className={styles.input} />
                        );
                      }} />
                    </div>
                  )}
                  <div className={styles.field}>
                    <label className={styles.label}>Кол-во</label>
                    <Controller control={control} name={`items.${idx}.quantity`} render={({ field: f }) => (
                      <input
                        type="number"
                        min="1"
                        className={styles.input}
                        value={f.value ?? ''}
                        onChange={(e) => f.onChange(parseOptionalInteger(e.target.value))}
                        onBlur={f.onBlur}
                        onWheel={e => e.currentTarget.blur()}
                        onFocus={e => e.target.select()}
                        aria-label={`Кол-во позиции ${idx + 1}`}
                      />
                    )} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Цена за ед. (₸)</label>
                    <Controller control={control} name={`items.${idx}.unitPrice`} render={({ field: f }) => (
                      <input type="text" inputMode="numeric" className={styles.input} placeholder="0"
                        aria-label={`Цена за ед. позиции ${idx + 1}`}
                        value={f.value ?? ''} onChange={e => f.onChange(parseOptionalAmount(e.target.value))}
                        onWheel={e => e.currentTarget.blur()} onFocus={e => e.target.select()} />
                    )} />
                    {Number(_item?.unitPrice) > 1_000_000 && (
                      <span className={styles.fieldError} title="Сумма больше миллиона — проверьте, нет ли лишних нулей">
                        ⚠ Проверьте сумму — возможно, лишние нули
                      </span>
                    )}
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Скидка (₸)</label>
                    <Controller control={control} name={`items.${idx}.itemDiscount`} render={({ field: f }) => (
                      <input type="text" inputMode="numeric" className={styles.input} placeholder="0"
                        aria-label={`Скидка позиции ${idx + 1}`}
                        value={f.value ?? ''} onChange={e => f.onChange(parseOptionalAmount(e.target.value))}
                        onWheel={e => e.currentTarget.blur()} onFocus={e => e.target.select()} />
                    )} />
                  </div>
                </div>

                {_item?.productName?.trim() && (
                  isCommodity ? (
                    productStock ? (
                      productStock.available ? (
                        <div className={styles.variantStockIn}>Остаток: {productStock.qty} шт.</div>
                      ) : (
                        <div className={styles.variantStockOut}>Нет на складе</div>
                      )
                    ) : stockMap !== undefined ? (
                      <div className={styles.variantStockHint}>Нет данных по складу</div>
                    ) : null
                  ) : !allAxesFilled ? (
                    <div className={styles.variantStockHint}>
                      Укажите параметры ({missingAxes.map(f => f.label.toLowerCase()).join(', ')}) для проверки остатка
                    </div>
                  ) : variantStock ? (
                    variantStock.available > 0 ? (
                      <div className={variantStock.status === 'low' ? styles.variantStockLow : styles.variantStockIn}>
                        Остаток: {variantStock.available} шт.{variantStock.status === 'low' ? ' — мало' : ''}
                      </div>
                    ) : (
                      <div className={styles.variantStockOut}>Нет на складе</div>
                    )
                  ) : variantMap !== undefined ? (
                    <div className={styles.variantStockHint}>Нет данных по складу</div>
                  ) : null
                )}

                {linePrice > 0 && (
                  <div className={styles.lineTotalRow}>
                    {lineDisc > 0 ? (
                      <><span className={styles.lineTotalOld}>{fmt(linePrice)}</span><span className={styles.lineTotalFinal}>{fmt(lineTotal)}</span></>
                    ) : (
                      <span className={styles.lineTotalFinal}>{fmt(linePrice)}</span>
                    )}
                  </div>
                )}

                {customItemFields.length > 0 && (
                  <div className={styles.itemRow4}>
                    {customItemFields.map((tplField) => (
                      <div key={tplField.id} className={styles.field}>
                        <Controller
                          control={control}
                          name={`items.${idx}.customFields.${tplField.key}` as `items.${number}.customFields.${string}`}
                          render={({ field: f }) => (
                            <TemplateAttributeRenderer
                              field={tplField}
                              value={f.value as never}
                              onChange={(next) => f.onChange(next)}
                              mode="edit"
                            />
                          )}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className={styles.itemNoteField}>
                  <input {...register(`items.${idx}.workshopNotes`)} className={styles.itemNoteInput}
                    placeholder="Комментарий для цеха (необязательно)..." />
                </div>

                <div className={styles.itemPhotoRow}>
                  {itemPhotos[idx] ? (
                    <div className={styles.itemPhotoPreview}>
                      <img src={URL.createObjectURL(itemPhotos[idx]!)} alt="" className={styles.itemPhotoThumb} />
                      <span className={styles.itemPhotoName}>{itemPhotos[idx]!.name}</span>
                      <button type="button" className={styles.fileRemoveBtn} aria-label={`Удалить фото для позиции ${idx + 1}`} onClick={() => setItemPhotos(p => ({ ...p, [idx]: null }))}>
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className={styles.itemPhotoUpload}>
                      <ImagePlus size={14} />
                      <span>Прикрепить фото / эскиз</span>
                      <input type="file" accept="image/*" className={styles.hiddenInput}
                        onChange={e => { const file = e.target.files?.[0]; if (file) setItemPhotos(prev => ({ ...prev, [idx]: file })); }} />
                    </label>
                  )}
                </div>
              </div>
            );
          })}

          {errors.items && typeof errors.items.message === 'string' && (
            <div className={styles.formError}><AlertCircle size={13} />{errors.items.message}</div>
          )}
          <div className={styles.itemsFooter}>
            <button type="button" className={styles.addItemBtn}
              onClick={() => append(createEmptyItem())}>
              <Plus size={13} /> Добавить позицию
            </button>
            {itemsTotal > 0 && (
              <div className={styles.itemsTotal}>
                <Calculator size={13} />
                <span>Итого по позициям:</span>
                <strong>{fmt(itemsTotal)}</strong>
                <span className={styles.itemsTotalMeta}>{items.length} {items.length === 1 ? 'позиция' : items.length < 5 ? 'позиции' : 'позиций'} · {items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)} шт.</span>
              </div>
            )}
          </div>
        </>
      )}
      </div>
    </section>
  );
}
