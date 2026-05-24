// ЧАСТЬ X / P2a — new-order form block 04: payment. JSX lifted verbatim from
// NewOrderPage.tsx section 04; closure refs come from the form context.

import { Controller } from 'react-hook-form';
import { Paperclip, Pencil, X } from 'lucide-react';
import { useNewOrderForm } from '../NewOrderFormContext';
import { SelectOrText, parseOptionalAmount } from '../formHelpers';
import styles from '../../NewOrderPage.module.css';

export function PaymentBlock() {
  const {
    items, itemsTotal, fmt, control, errors, setValue,
    discountPercent, setDiscountPercent,
    editingRate, setEditingRate, rateInput, setRateInput, updateBankCommission,
    bankCommissionAmount, bankCommissionPct, finalTotal, prepayment, debt, prepaymentRaw,
    paymentMethod, activePaymentMethods, mixedBreakdownRows, mixedSum,
    receipts, setReceipts, receiptInputRef,
  } = useNewOrderForm();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionNum}>04</span>
        <span className={styles.sectionTitle}>Оплата</span>
      </div>
      <div className={styles.sectionBody}>

        {/* F1: Правильный порядок вычислений */}
        <div className={styles.finPipeline}>

          {/* 1. Сумма по позициям — F2 */}
          <div className={styles.finRow}>
            <div>
              <span className={styles.finLabel}>Сумма по позициям</span>
              {items.length > 0 && (
                <div className={styles.finLabelSub}>
                  {items.length} {items.length === 1 ? 'позиция' : items.length < 5 ? 'позиции' : 'позиций'}
                  {' · '}
                  {items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)} шт.
                </div>
              )}
            </div>
            <span className={styles.finValue}>{itemsTotal > 0 ? fmt(itemsTotal) : '—'}</span>
          </div>

          {/* 2. Сумма доставки — F3 */}
          <div className={styles.finRow}>
            <span className={styles.finLabel}>Доставка</span>
            <Controller control={control} name="deliveryFee" render={({ field }) => (
              <input
                type="text" inputMode="numeric"
                className={styles.finInput}
                placeholder="0 ₸"
                aria-label="Доставка"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(parseOptionalAmount(e.target.value))}
                onWheel={(e) => e.currentTarget.blur()}
                onFocus={(e) => e.target.select()}
              />
            )} />
          </div>

          {/* 3. Скидка на заказ — F5: один мастер-блок */}
          <div className={styles.finRow}>
            <span className={styles.finLabel}>Скидка</span>
            <div className={styles.discountCompound}>
              <Controller control={control} name="orderDiscount" render={({ field }) => (
                <input
                  type="text" inputMode="numeric"
                  className={`${styles.finInput} ${styles.discountAmtInput}`}
                  placeholder="0 ₸"
                  aria-label="Скидка на заказ"
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const amt = parseOptionalAmount(e.target.value);
                    field.onChange(amt);
                    if (itemsTotal > 0 && Number.isFinite(amt) && (amt ?? 0) > 0) {
                      setDiscountPercent(((amt! / itemsTotal) * 100).toFixed(1));
                    } else { setDiscountPercent(''); }
                  }}
                  onWheel={(e) => e.currentTarget.blur()}
                  onFocus={(e) => e.target.select()}
                />
              )} />
              <div className={styles.discountPctWrap}>
                <input
                  type="number" min="0" max="100" step="0.1"
                  className={styles.discountPctInput}
                  placeholder="0"
                  aria-label="Процент скидки"
                  value={discountPercent}
                  onChange={(e) => {
                    setDiscountPercent(e.target.value);
                    const pct = parseFloat(e.target.value);
                    if (Number.isFinite(pct) && itemsTotal > 0) {
                      setValue('orderDiscount', Math.round(itemsTotal * pct / 100));
                    } else if (!e.target.value) { setValue('orderDiscount', undefined); }
                  }}
                  onWheel={(e) => e.currentTarget.blur()}
                  onFocus={(e) => e.target.select()}
                />
                <span className={styles.discountPctSymbol}>%</span>
              </div>
            </div>
          </div>

          {/* 4. Банковская комиссия — F4 */}
          <div className={styles.finRow}>
            <span className={styles.finLabel}>Комиссия банка</span>
            <div className={styles.discountCompound}>
              <div className={`${styles.finValue} ${styles.bankCommissionValue}`}>
                {bankCommissionAmount > 0 ? fmt(bankCommissionAmount) : '—'}
              </div>
              {editingRate ? (
                <div className={styles.bankCommissionEditor}>
                  <div className={styles.discountPctWrap}>
                    <input
                      type="number" min="0" max="100" step="0.1"
                      className={styles.discountPctInput}
                      placeholder="0"
                      aria-label="Ставка комиссии"
                      value={rateInput}
                      autoFocus
                      onChange={(e) => setRateInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') { setEditingRate(false); }
                      }}
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                    <span className={styles.discountPctSymbol}>%</span>
                  </div>
                  <button
                    type="button"
                    className={styles.bankCommissionSaveBtn}
                    onClick={() => {
                      const v = parseFloat(rateInput);
                      const safe = isNaN(v) ? 0 : Math.min(100, Math.max(0, v));
                      setValue('bankCommissionPercent', safe || undefined);
                      updateBankCommission.mutate(safe);
                      setEditingRate(false);
                    }}
                  >Сохранить</button>
                  <button
                    type="button"
                    className={styles.bankCommissionCancelBtn}
                    onClick={() => setEditingRate(false)}
                  >Отмена</button>
                </div>
              ) : (
                <div className={styles.bankCommissionView}>
                  <span className={`${styles.bankCommissionRate} ${bankCommissionPct > 0 ? styles.bankCommissionRateActive : styles.bankCommissionRateMuted}`}>
                    {bankCommissionPct > 0 ? `${bankCommissionPct}%` : '—'}
                  </span>
                  <button
                    type="button"
                    title="Изменить ставку комиссии"
                    onClick={() => { setRateInput(bankCommissionPct > 0 ? String(bankCommissionPct) : ''); setEditingRate(true); }}
                    className={styles.iconButton}
                  >
                    <Pencil size={12} />
                    <span className={styles.srOnly}>Изменить ставку комиссии</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 5. Итог к оплате */}
          <div className={`${styles.finRow} ${styles.finRowTotal}`}>
            <span className={styles.finLabel}>Итого к оплате</span>
            <span className={styles.finValueBold}>{itemsTotal > 0 ? fmt(finalTotal) : '—'}</span>
          </div>

          {/* 6-7. Предоплата / Остаток */}
          <div className={styles.finRow}>
            <span className={styles.finLabel}>Предоплата</span>
            <Controller control={control} name="prepayment" render={({ field }) => (
              <input
                type="number" min="0" max={finalTotal || undefined} inputMode="numeric"
                className={`${styles.finInput} ${errors.prepayment ? styles.inputError : ''}`}
                placeholder="0 ₸"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(parseOptionalAmount(e.target.value))}
                onWheel={(e) => e.currentTarget.blur()}
                onFocus={(e) => e.target.select()}
              />
            )} />
            {errors.prepayment && <span className={styles.fieldError}>{errors.prepayment.message}</span>}
            {!errors.prepayment && finalTotal > 0 && (Number(prepaymentRaw) || 0) > finalTotal && (
              <span className={styles.fieldError}>
                ⚠ Предоплата ({fmt(Number(prepaymentRaw) || 0)}) больше итога ({fmt(finalTotal)}) — проверьте лишние нули
              </span>
            )}
          </div>
          <div className={`${styles.finRow} ${styles.finRowBalance}`}>
            <span className={styles.finLabel}>Остаток</span>
            <span className={finalTotal > 0 && debt > 0 ? styles.finValueDebt : styles.finValue}>
              {finalTotal > 0 ? fmt(debt) : '—'}
            </span>
          </div>

        </div>

        {/* Способ оплаты */}
        <div className={styles.field}>
          <label className={styles.label}>
            Способ оплаты
            {prepayment > 0 && <span className={styles.req}> *</span>}
          </label>
          <div className={styles.payMethodBtns}>
            {activePaymentMethods.map((m) => (
              <button
                key={m.value}
                type="button"
                className={[
                  styles.payMethodBtn,
                  paymentMethod === m.value ? styles.payMethodBtnActive : '',
                  m.value === 'mixed' ? styles.payMethodBtnMixed : '',
                ].join(' ')}
                onClick={() => setValue('paymentMethod', paymentMethod === m.value ? undefined : m.value as typeof paymentMethod)}
              >
                {m.label}
              </button>
            ))}
          </div>
          {errors.paymentMethod && <span className={styles.fieldError}>{errors.paymentMethod.message}</span>}
        </div>

        {/* Ожидаемый способ доплаты */}
        <div className={styles.field}>
          <label className={styles.label}>Ожидаемый способ доплаты</label>
          <Controller control={control} name="expectedPaymentMethod" render={({ field }) => (
            <SelectOrText
              {...field}
              value={field.value ?? ''}
              options={activePaymentMethods.map(m => m.label)}
              placeholder="Как клиент заплатит остаток..."
              className={styles.input}
            />
          )} />
        </div>

        {/* Смешанный — разбивка */}
        {paymentMethod === 'mixed' && (
          <div className={styles.mixedBreakdown}>
            <div className={styles.mixedBreakdownTitle}>Разбивка по способам оплаты</div>
            {mixedBreakdownRows.map((m) => (
              <div key={m.value} className={styles.mixedRow}>
                <span className={styles.mixedLabel}>{m.label}</span>
                <Controller control={control} name={`paymentBreakdown.${m.value}`} render={({ field }) => (
                  <input
                    type="text" inputMode="numeric"
                    className={styles.mixedInput}
                    placeholder="0 ₸"
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const parsed = parseOptionalAmount(e.target.value);
                      // Soft cap at prepayment so a stray extra zero in one row can't
                      // silently exceed the prepayment that the order is splitting.
                      if (parsed !== undefined && prepayment > 0 && parsed > prepayment) {
                        field.onChange(prepayment);
                      } else {
                        field.onChange(parsed);
                      }
                    }}
                    onWheel={(e) => e.currentTarget.blur()}
                    onFocus={(e) => e.target.select()}
                  />
                )} />
              </div>
            ))}
            {mixedSum > 0 && (
              <div className={styles.mixedTotal}>
                Итого в разбивке: <strong>{fmt(mixedSum)}</strong>
                {prepayment > 0 && Math.abs(mixedSum - prepayment) > 1 && (
                  <span className={styles.mixedMismatch}> ≠ предоплата {fmt(prepayment)}</span>
                )}
              </div>
            )}
            {(errors as any).paymentBreakdown?.message && <span className={styles.fieldError}>{(errors as any).paymentBreakdown.message}</span>}
          </div>
        )}

        {/* Чеки / квитанции */}
        <div className={styles.field}>
          <label className={styles.label}>Чеки / квитанции</label>
          {receipts.length > 0 && (
            <div className={styles.fileList}>
              {receipts.map((f, i) => (
                <div key={i} className={styles.fileItem}>
                  <Paperclip size={12} />
                  <span className={styles.fileName}>{f.name}</span>
                  <button
                    type="button"
                    className={styles.fileRemoveBtn}
                    aria-label={`Удалить чек ${f.name}`}
                    title={`Удалить чек ${f.name}`}
                    onClick={() => setReceipts((r) => r.filter((_, j) => j !== i))}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className={styles.receiptUpload}>
            <Paperclip size={14} />
            <span>Прикрепить чек...</span>
            <span className={styles.uploadBadge}>jpg / pdf</span>
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className={styles.hiddenInput}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) setReceipts((r) => [...r, ...files]);
                if (receiptInputRef.current) receiptInputRef.current.value = '';
              }}
            />
          </label>
        </div>

      </div>
    </section>
  );
}
