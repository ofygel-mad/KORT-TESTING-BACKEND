import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Settings2, Check } from 'lucide-react';
import { api } from '../api/client';
import { Skeleton } from './Skeleton';
import { Button } from './Button';
import { toast } from 'sonner';
import s from './CustomFieldsTab.module.css';

interface CustomField {
  id: string; name: string; field_key: string; field_type: string;
  options: string[]; is_required: boolean; position: number;
}

interface CustomFieldsTabProps {
  entityType: 'customer' | 'deal';
  entityId: string;
}

export function CustomFieldsTab({ entityType, entityId }: CustomFieldsTabProps) {
  const qc = useQueryClient();
  const [editMode, setEditMode]     = useState(false);
  const [localValues, setLocalValues] = useState<Record<string, any>>({});
  const [initialized, setInitialized] = useState(false);

  const { data, isLoading } = useQuery<{ schema: CustomField[]; values: Record<string, any> }>({
    queryKey: ['custom-fields-values', entityType, entityId],
    queryFn: () => api.get(`/custom-fields/values/${entityType}/${entityId}/`),
    onSuccess: (d: { schema: CustomField[]; values: Record<string, any> }) => {
      if (!initialized) { setLocalValues(d.values || {}); setInitialized(true); }
    },
  } as any);

  const saveMutation = useMutation({
    mutationFn: () => api.post(`/custom-fields/values/${entityType}/${entityId}/`, localValues),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields-values', entityType, entityId] });
      setEditMode(false);
      toast.success('Сохранено');
    },
  });

  if (isLoading) {
    return (
      <div className={s.loading}>
        {[1, 2, 3].map(i => <Skeleton key={i} height={40} className={s.skeletonItem} />)}
      </div>
    );
  }

  const schema = data?.schema ?? [];

  if (schema.length === 0) {
    return (
      <div className={s.emptyState}>
        <Settings2 size={28} className={s.emptyIcon} />
        <div className={s.emptyTitle}>Нет дополнительных полей</div>
        <div className={s.emptyDesc}>Добавьте поля в Настройках → Организация → Поля</div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.toolbar}>
        {editMode ? (
          <div className={s.btnGroup}>
            <Button variant="ghost" size="sm" onClick={() => setEditMode(false)}>Отмена</Button>
            <Button size="sm" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              <Check size={13} style={{ marginRight: 4 }} /> Сохранить
            </Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setEditMode(true)}>Редактировать</Button>
        )}
      </div>

      <div className={s.fieldList}>
        {schema.map((field, i) => (
          <motion.div
            key={field.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <label className={s.fieldLabel}>
              {field.name}
              {field.is_required && <span className={s.required}>*</span>}
            </label>

            {editMode ? (
              <FieldInput
                field={field}
                value={localValues[field.field_key]}
                onChange={v => setLocalValues(prev => ({ ...prev, [field.field_key]: v }))}
              />
            ) : (
              <div className={`${s.readValue} ${localValues[field.field_key] ? s.filled : s.empty}`}>
                {formatFieldValue(field, localValues[field.field_key])}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── Field input by type ─────────────────────────────────────── */
function FieldInput({ field, value, onChange }: { field: CustomField; value: any; onChange: (v: any) => void }) {
  if (field.field_type === 'select') {
    return (
      <select value={value ?? ''} onChange={e => onChange(e.target.value)} className="kort-input">
        <option value="">— не выбрано —</option>
        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (field.field_type === 'boolean') {
    return (
      <label className={s.checkboxLabel}>
        <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} style={{ width: 16, height: 16 }} />
        <span>Да</span>
      </label>
    );
  }
  if (field.field_type === 'date')   return <input type="date"   value={value ?? ''} onChange={e => onChange(e.target.value)}          className="kort-input" />;
  if (field.field_type === 'number') return <input type="number" value={value ?? ''} onChange={e => onChange(Number(e.target.value))}   className="kort-input" />;
  return                                    <input type="text"   value={value ?? ''} onChange={e => onChange(e.target.value)}          className="kort-input" />;
}

function formatFieldValue(field: CustomField, value: any): string {
  if (value === null || value === undefined || value === '') return 'Не заполнено';
  if (field.field_type === 'boolean') return value ? 'Да' : 'Нет';
  return String(value);
}
