import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useCreateItem, useWarehouseCategories } from '../../../../entities/warehouse/queries';
import type { CreateItemDto } from '../../../../entities/warehouse/types';
import styles from '../../../warehouse/Warehouse.module.css';

interface Props {
  onClose: () => void;
}

const INITIAL_FORM: CreateItemDto = {
  name: '',
  unit: 'шт',
  qty: 0,
  qtyMin: 0,
};

export function AddItemDrawer({ onClose }: Props) {
  const createItem = useCreateItem();
  const { data: catData } = useWarehouseCategories();
  const categories = catData?.results ?? [];
  const [form, setForm] = useState<CreateItemDto>(INITIAL_FORM);

  const setField = (field: keyof CreateItemDto, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    const rawCostPrice = String(form.costPrice ?? '').trim();

    await createItem.mutateAsync({
      ...form,
      name: form.name.trim(),
      sku: form.sku?.trim() || undefined,
      unit: form.unit?.trim() || 'шт',
      categoryId: form.categoryId || undefined,
      color: form.color?.trim() || undefined,
      gender: form.gender?.trim() || undefined,
      size: form.size?.trim() || undefined,
      qty: Number(form.qty ?? 0),
      qtyMin: Number(form.qtyMin ?? 0),
      costPrice: rawCostPrice === '' ? undefined : Number(form.costPrice),
    });

    onClose();
  };

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(event) => event.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Добавить позицию</span>
          <button type="button" className={styles.drawerClose} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <form className={styles.drawerBody} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>
              Название <span className={styles.req}>*</span>
            </label>
            <input
              className={styles.input}
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              placeholder="Чапан классик"
              required
              autoFocus
            />
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>Уникальный номер</label>
              <input
                className={styles.input}
                value={form.sku ?? ''}
                onChange={(event) => setField('sku', event.target.value)}
                placeholder="CHAP-01"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Ед. изм.</label>
              <input
                className={styles.input}
                value={form.unit ?? 'шт'}
                onChange={(event) => setField('unit', event.target.value)}
                placeholder="шт / кг / м"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Размер</label>
            <input
              className={styles.input}
              value={form.size ?? ''}
              onChange={(event) => setField('size', event.target.value)}
              placeholder="48, XL, 42-60..."
            />
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>Цвет</label>
              <input
                className={styles.input}
                value={form.color ?? ''}
                onChange={(event) => setField('color', event.target.value)}
                placeholder="Синий"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Пол</label>
              <input
                className={styles.input}
                value={form.gender ?? ''}
                onChange={(event) => setField('gender', event.target.value)}
                placeholder="Мужской"
              />
            </div>
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>Остаток</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                value={form.qty ?? 0}
                onChange={(event) => setField('qty', event.target.value)}
                onFocus={(event) => event.target.select()}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Минимум (алерт)</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                value={form.qtyMin ?? 0}
                onChange={(event) => setField('qtyMin', event.target.value)}
                onFocus={(event) => event.target.select()}
              />
            </div>
          </div>

          {categories.length > 0 && (
            <div className={styles.field}>
              <label className={styles.label}>Категория</label>
              <select
                className={styles.select}
                value={form.categoryId ?? ''}
                onChange={(event) => setField('categoryId', event.target.value)}
              >
                <option value="">Без категории</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Цена (₸)</label>
            <input
              className={styles.input}
              type="number"
              min="0"
              value={form.costPrice ?? ''}
              onChange={(event) => setField('costPrice', event.target.value)}
              placeholder="0"
            />
          </div>

          <div className={styles.drawerActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className={styles.submitBtn} disabled={createItem.isPending}>
              {createItem.isPending ? 'Создание...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
