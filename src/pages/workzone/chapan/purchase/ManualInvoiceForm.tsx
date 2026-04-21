import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useCreateManualInvoice } from '../../../../entities/purchase/queries';
import type { PurchaseType } from '../../../../entities/purchase/types';
import styles from './ManualInvoiceForm.module.css';

interface ItemRow {
  productName: string;
  color: string;
  size: string;
  quantity: string;
  unitPrice: string;
}

function emptyRow(): ItemRow {
  return { productName: '', color: '', size: '', quantity: '1', unitPrice: '' };
}

function fmt(n: number) {
  return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n) + ' ₸';
}

interface Props {
  type: PurchaseType;
  onClose: () => void;
}

const TYPE_LABELS: Record<PurchaseType, string> = {
  workshop: 'Цех',
  market: 'Базар',
};

export default function ManualInvoiceForm({ type, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const createInvoice = useCreateManualInvoice();

  const total = rows.reduce((s, r) => {
    const q = parseFloat(r.quantity) || 0;
    const p = parseFloat(r.unitPrice) || 0;
    return s + q * p;
  }, 0);

  function updateRow(i: number, field: keyof ItemRow, value: string) {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function removeRow(i: number) {
    setRows((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  }

  async function handleSave() {
    const validRows = rows.filter((r) => r.productName.trim());
    if (!title.trim() || validRows.length === 0) return;

    await createInvoice.mutateAsync({
      type,
      title: title.trim(),
      notes: notes.trim() || undefined,
      items: validRows.map((r) => ({
        productName: r.productName.trim(),
        color: r.color.trim() || undefined,
        size: r.size.trim() || undefined,
        quantity: parseFloat(r.quantity) || 1,
        unitPrice: parseFloat(r.unitPrice) || 0,
      })),
    });
    onClose();
  }

  const canSave = title.trim().length > 0 && rows.some((r) => r.productName.trim());

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.dialog}>
        <div className={styles.dialogHeader}>
          <span className={styles.dialogTitle}>
            Новая накладная — {TYPE_LABELS[type]}
          </span>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className={styles.dialogBody}>
          <div className={styles.field}>
            <label className={styles.label}>Название</label>
            <input
              className={styles.input}
              placeholder="Например: Закуп ткани, апрель"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Примечание (необязательно)</label>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              placeholder="Дополнительная информация..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className={styles.itemsSection}>
            <div className={styles.itemsHeader}>
              <span className={styles.itemsLabel}>Позиции</span>
              <button type="button" className={styles.addRowBtn} onClick={() => setRows((p) => [...p, emptyRow()])}>
                <Plus size={12} />
                Добавить строку
              </button>
            </div>

            <table className={styles.itemsTable}>
              <thead>
                <tr>
                  <th style={{ width: '32%' }}>Наименование</th>
                  <th style={{ width: '14%' }}>Цвет</th>
                  <th style={{ width: '12%' }}>Размер</th>
                  <th style={{ width: '10%' }}>Кол-во</th>
                  <th style={{ width: '18%' }}>Цена, ₸</th>
                  <th style={{ width: '10%' }}>Сумма</th>
                  <th style={{ width: '4%' }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const rowTotal = (parseFloat(row.quantity) || 0) * (parseFloat(row.unitPrice) || 0);
                  return (
                    <tr key={i}>
                      <td>
                        <input
                          className={styles.cellInput}
                          placeholder="Название товара"
                          value={row.productName}
                          onChange={(e) => updateRow(i, 'productName', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.cellInput}
                          placeholder="—"
                          value={row.color}
                          onChange={(e) => updateRow(i, 'color', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.cellInput}
                          placeholder="—"
                          value={row.size}
                          onChange={(e) => updateRow(i, 'size', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.cellInput}
                          type="number"
                          min="1"
                          placeholder="1"
                          value={row.quantity}
                          onChange={(e) => updateRow(i, 'quantity', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.cellInput}
                          type="number"
                          min="0"
                          placeholder="0"
                          value={row.unitPrice}
                          onChange={(e) => updateRow(i, 'unitPrice', e.target.value)}
                        />
                      </td>
                      <td style={{ paddingLeft: 8, color: 'var(--ch-text-muted)', whiteSpace: 'nowrap', fontSize: 11 }}>
                        {rowTotal > 0 ? fmt(rowTotal) : '—'}
                      </td>
                      <td>
                        <button type="button" className={styles.removeRow} onClick={() => removeRow(i)}>
                          <X size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Итого:</span>
              <span>{fmt(total)}</span>
            </div>
          </div>
        </div>

        <div className={styles.dialogFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className={styles.saveBtn}
            disabled={!canSave || createInvoice.isPending}
            onClick={handleSave}
          >
            {createInvoice.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
