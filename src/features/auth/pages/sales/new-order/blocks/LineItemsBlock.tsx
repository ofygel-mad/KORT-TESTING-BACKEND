// ЧАСТЬ X / P2a + P5 — new-order form block 02: order line items.
//
// Pre-P5: hardcoded gender/color/length/size everywhere.
// P5: legacy fields (gender/color/length/size) are now CONDITIONAL — they
// only render when the active OrderTemplate's items section includes those
// keys. New custom fields (sku, serial, hazard, etc.) render in an extra
// row using <TemplateAttributeRenderer>. Calculations remain untouched —
// quantity/unitPrice/itemDiscount stay as dedicated columns.
//
// P5 final pass:
//   - «Название товара» — Autocomplete по каталогу, отфильтрованному по
//     активному виду деятельности; пустой каталог даёт inline-warning со
//     ссылкой на /products.
//   - При выборе товара из каталога цена автоматически подставляется из
//     defaultRetailPrice / defaultWholesalePrice (поле остаётся редактируемым,
//     не перебивает уже введённое число).
//   - Заголовки оптовой таблицы и placeholder'ы дефолтных полей теперь
//     берутся из шаблона; хардкод «Пол / Длина / Цвет / Размер» убран.
//   - Blob URL для фото освобождается через useEffect cleanup (без revoke
//     была утечка на каждый рендер строки).

import { useEffect, useMemo, useRef } from 'react';
import { Controller } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { AlertCircle, Calculator, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { SearchableSelect } from '@/shared/ui/SearchableSelect';
import { buildVariantLookupKey } from '@/shared/utils/variantAvailability';
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
    isWholesale, fields, items, control, register, errors, append, remove, setValue,
    getAvailabilityInput, getEffectiveFields, getMissingAxes, getCatalogOptions,
    variantMap, stockMap, globalWarehouseLengths, globalWarehouseColors,
    enrichedProductOptions, sizeOptions, itemsTotal, fmt, itemPhotos, setItemPhotos,
    activeTemplate, itemsTemplateFields, customItemFields, catalogProductByName,
  } = useNewOrderForm();

  // P5: which legacy widgets to render depends on the active template's items
  // section. When a template doesn't declare the key, hide the legacy widget.
  const templateKeys = useMemo(
    () => new Set(itemsTemplateFields.map((f) => f.key)),
    [itemsTemplateFields],
  );
  const showLegacy = (key: string) =>
    !activeTemplate || itemsTemplateFields.length === 0 || templateKeys.has(key);

  // P5: lookup of template field by key — used to derive placeholder/label
  // for fields that share a key with a legacy column (e.g. «Размер» can
  // become «Концентрация» if the active template overrides label).
  const templateFieldByKey = useMemo(() => {
    const map = new Map<string, (typeof itemsTemplateFields)[number]>();
    for (const f of itemsTemplateFields) map.set(f.key, f);
    return map;
  }, [itemsTemplateFields]);
  const labelFor = (key: string, fallback: string) =>
    templateFieldByKey.get(key)?.label ?? fallback;
  const placeholderFor = (key: string, fallback: string) =>
    templateFieldByKey.get(key)?.placeholder ?? templateFieldByKey.get(key)?.label ?? fallback;

  // P5: dedicated dynamic-columns list for the wholesale table. When the
  // active template declares its own items fields, those drive the column
  // headers (label-driven). Falls back to the legacy clothing column set for
  // back-compat when no template is loaded.
  const wholesaleColumns = useMemo(() => {
    if (itemsTemplateFields.length > 0) {
      return itemsTemplateFields.filter((f) => f.key !== 'product' && f.key !== 'productName');
    }
    return null;
  }, [itemsTemplateFields]);

  // P5: catalog-empty detection. Drives the inline warning that nudges the
  // manager to /products before they try to enter items by hand.
  const catalogIsEmpty =
    !!activeTemplate?.id && Object.keys(catalogProductByName).length === 0;

  // P5: auto-fill unitPrice on productName commit. Tracks the last name we
  // populated price for per row, so re-renders don't keep overwriting the
  // user's manual edits. Stored in a ref to avoid an extra render.
  const lastFilledNameRef = useRef<Record<number, string>>({});
  // P5: ensure no carried-over names trigger re-fills after row removal.
  useEffect(() => {
    const liveIds = new Set(fields.map((_, idx) => idx));
    for (const k of Object.keys(lastFilledNameRef.current)) {
      if (!liveIds.has(Number(k))) delete lastFilledNameRef.current[Number(k)];
    }
  }, [fields]);

  /**
   * Auto-fill unitPrice when a catalog product is picked. Skips re-fill on
   * subsequent renders for the same (idx, name) pair so manual edits are
   * preserved. Wholesale orders prefer defaultWholesalePrice; otherwise
   * defaultRetailPrice. The field stays editable in all cases.
   */
  const maybeAutoFillPrice = (idx: number, productName: string) => {
    const trimmed = productName.trim();
    if (!trimmed) return;
    if (lastFilledNameRef.current[idx] === trimmed) return;
    const product = catalogProductByName[trimmed];
    if (!product) return;
    const current = items[idx]?.unitPrice;
    // Treat 0/undefined as "empty" — match the AddItemDrawer convention.
    const isEmpty = current === undefined || current === null || Number(current) === 0;
    if (!isEmpty) {
      lastFilledNameRef.current[idx] = trimmed;
      return;
    }
    const autoPrice = isWholesale
      ? product.defaultWholesalePrice ?? product.defaultRetailPrice
      : product.defaultRetailPrice ?? product.defaultWholesalePrice;
    if (autoPrice != null) {
      setValue(`items.${idx}.unitPrice`, autoPrice, { shouldDirty: true });
    }
    lastFilledNameRef.current[idx] = trimmed;
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionNum}>02</span>
        <span className={styles.sectionTitle}>Позиции заказа</span>
      </div>
      <div className={styles.sectionBody}>
      {catalogIsEmpty && (
        <div className={`${styles.variantStockHint} ${styles.catalogEmptyNotice}`} role="status">
          <AlertCircle size={13} className={styles.catalogEmptyNoticeIcon} />
          <span>
            Каталог по виду деятельности «{activeTemplate?.name ?? ''}» пуст.
            Добавьте позиции в раздел Каталог.&nbsp;
            <Link
              to={`/products${activeTemplate?.id ? `?templateId=${encodeURIComponent(activeTemplate.id)}` : ''}`}
            >
              Перейти в Каталог
            </Link>
          </span>
        </div>
      )}
      {isWholesale ? (
        <>
          <div className={styles.wtable}>
            <div className={styles.wtableHead}>
              <span>Наименование</span>
              {wholesaleColumns ? (
                wholesaleColumns.map((col) => <span key={col.id}>{col.label}</span>)
              ) : (
                <>
                  <span>Пол</span>
                  <span>Длина</span>
                  <span>Цвет</span>
                  <span>Размер</span>
                </>
              )}
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
                ? variantMap[buildVariantLookupKey(availabilityInput.name, availabilityInput.attributes, productFields)]
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
                      <SearchableSelect
                        options={enrichedProductOptions}
                        value={f.value}
                        onChange={(v) => { f.onChange(v); maybeAutoFillPrice(idx, v); }}
                        onBlur={f.onBlur}
                        placeholder={placeholderFor('productName', 'Модель…')}
                        className={`${styles.wtableInput} ${errors.items?.[idx]?.productName ? styles.inputError : ''}`}
                      />
                    )} />
                  </div>
                  {wholesaleColumns ? (
                    wholesaleColumns.map((col) => {
                      const isLegacy = LEGACY_ITEM_KEYS.has(col.key);
                      return (
                        <div key={col.id} className={styles.wtableCell}>
                          {isLegacy ? (
                            <Controller
                              control={control}
                              name={`items.${idx}.${col.key}` as `items.${number}.color`}
                              render={({ field: f }) => {
                                const catalogValues = getCatalogOptions(_item?.productName ?? '', col.key);
                                const optsFallback = col.key === 'length'
                                  ? lengthOpts
                                  : col.key === 'color'
                                    ? globalWarehouseColors
                                    : col.key === 'size'
                                      ? sizeOptions
                                      : (col.options ?? []);
                                const opts = catalogValues.length > 0 ? catalogValues : optsFallback;
                                if (col.type === 'select' || catalogValues.length > 0 || opts.length > 0) {
                                  return (
                                    <SearchableSelect
                                      options={opts}
                                      value={(f.value as string) ?? ''}
                                      onChange={f.onChange}
                                      onBlur={f.onBlur}
                                      placeholder={placeholderFor(col.key, '—')}
                                      className={styles.wtableInput}
                                    />
                                  );
                                }
                                return (
                                  <input
                                    className={styles.wtableInput}
                                    value={(f.value as string) ?? ''}
                                    onChange={(e) => f.onChange(e.target.value)}
                                    onBlur={f.onBlur}
                                    placeholder={placeholderFor(col.key, col.label)}
                                  />
                                );
                              }}
                            />
                          ) : (
                            <Controller
                              control={control}
                              name={`items.${idx}.customFields.${col.key}` as `items.${number}.customFields.${string}`}
                              render={({ field: f }) => (
                                <TemplateAttributeRenderer
                                  field={col}
                                  value={f.value as never}
                                  onChange={(next) => f.onChange(next)}
                                  mode="edit"
                                />
                              )}
                            />
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <>
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
                    </>
                  )}
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
                        <span className={styles.stockBadgeHint} title={`Заполните параметры: ${itemStock.missingAxes.map(f => f.label.toLowerCase()).join(', ')}`}>
                          заполните параметры
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
              ? variantMap[buildVariantLookupKey(availabilityInput.name, availabilityInput.attributes, getEffectiveFields(_item?.productName?.trim() ?? ''))]
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
                    <label className={styles.label}>{labelFor('productName', 'Модель')} <span className={styles.req}>*</span></label>
                    <Controller control={control} name={`items.${idx}.productName`} render={({ field: f }) => (
                      <SearchableSelect
                        options={enrichedProductOptions}
                        value={f.value}
                        onChange={(v) => { f.onChange(v); maybeAutoFillPrice(idx, v); }}
                        onBlur={f.onBlur}
                        placeholder={placeholderFor('productName', 'Название товара или услуги')}
                        className={`${styles.input} ${errors.items?.[idx]?.productName ? styles.inputError : ''}`}
                        ariaLabel={`Модель позиции ${idx + 1}`}
                      />
                    )} />
                    {errors.items?.[idx]?.productName && <span className={styles.fieldError}>{errors.items[idx]?.productName?.message}</span>}
                  </div>
                  {showLegacy('size') && (
                    <div className={styles.field}>
                      <label className={styles.label}>{labelFor('size', 'Размер')} <span className={styles.req}>*</span></label>
                      <Controller control={control} name={`items.${idx}.size`} render={({ field: f }) => {
                        const catalogSizes = getCatalogOptions(_item?.productName ?? '', 'size');
                        const opts = catalogSizes.length > 0 ? catalogSizes : sizeOptions;
                        return (
                        <SearchableSelect options={opts} value={f.value} onChange={f.onChange} onBlur={f.onBlur}
                            placeholder={placeholderFor('size', '—')}
                            className={`${styles.input} ${errors.items?.[idx]?.size ? styles.inputError : ''}`}
                            ariaLabel={`${labelFor('size', 'Размер')} позиции ${idx + 1}`}
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
                        <label className={styles.label}>{labelFor('gender', 'Пол')}</label>
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
                        <label className={styles.label}>{labelFor('length', 'Длина изделия')}</label>
                        <Controller control={control} name={`items.${idx}.length`} render={({ field: f }) => (
                          <select value={f.value ?? ''} onChange={e => f.onChange(e.target.value)} onBlur={f.onBlur}
                            className={styles.input} disabled={lengthOpts.length === 0} aria-label={`${labelFor('length', 'Длина изделия')} для позиции ${idx + 1}`}>
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
                      <label className={styles.label}>{labelFor('color', 'Цвет / материал')}</label>
                      <Controller control={control} name={`items.${idx}.color`} render={({ field: f }) => {
                        const catalogColors = getCatalogOptions(_item?.productName ?? '', 'color');
                        const colorOpts = catalogColors.length > 0
                          ? catalogColors
                          : globalWarehouseColors.length > 0
                            ? globalWarehouseColors
                            : [];
                        return (
                          <SearchableSelect options={colorOpts} value={f.value ?? ''} onChange={f.onChange} onBlur={f.onBlur}
                            placeholder={placeholderFor('color', '—')} className={styles.input} />
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
                      Заполните параметры ({missingAxes.map(f => f.label.toLowerCase()).join(', ')}) для проверки остатка
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

                <ItemPhotoRow
                  idx={idx}
                  file={itemPhotos[idx] ?? null}
                  onPick={(file) => setItemPhotos((prev) => ({ ...prev, [idx]: file }))}
                  onClear={() => setItemPhotos((p) => ({ ...p, [idx]: null }))}
                />
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

/**
 * P5: photo row split out so the blob URL lifecycle is owned by useEffect.
 * The previous inline `URL.createObjectURL(...)` in JSX created a fresh URL
 * on every render and never revoked it — guaranteed leak.
 */
interface ItemPhotoRowProps {
  idx: number;
  file: File | null;
  onPick: (file: File) => void;
  onClear: () => void;
}

function ItemPhotoRow({ idx, file, onPick, onClear }: ItemPhotoRowProps) {
  // Generate the object URL exactly once per `file` mount + revoke on unmount /
  // file change. Keeping the URL in a ref keeps the JSX referentially stable.
  const objectUrlRef = useRef<string | null>(null);
  const url = useMemo(() => {
    // Revoke previous URL before creating a new one for the next file.
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (!file) return null;
    const next = URL.createObjectURL(file);
    objectUrlRef.current = next;
    return next;
  }, [file]);

  // Cleanup on unmount (component removed via remove() in useFieldArray).
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  return (
    <div className={styles.itemPhotoRow}>
      {file && url ? (
        <div className={styles.itemPhotoPreview}>
          <img src={url} alt="" className={styles.itemPhotoThumb} />
          <span className={styles.itemPhotoName}>{file.name}</span>
          <button
            type="button"
            className={styles.fileRemoveBtn}
            aria-label={`Удалить фото для позиции ${idx + 1}`}
            onClick={onClear}
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <label className={styles.itemPhotoUpload}>
          <ImagePlus size={14} />
          <span>Прикрепить фото / эскиз</span>
          <input
            type="file"
            accept="image/*"
            className={styles.hiddenInput}
            onChange={(e) => {
              const next = e.target.files?.[0];
              if (next) onPick(next);
            }}
          />
        </label>
      )}
    </div>
  );
}
