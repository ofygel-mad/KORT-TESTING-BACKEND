// P7 — Field Designer (v1, no drag-drop).
//
// A pragmatic editor: pick a section, add/remove/reorder fields by up/down
// buttons, edit field properties in an inspector panel, save via the
// existing PUT endpoint. Full 3-pane dnd-kit experience is a v2 polish —
// the JSON is identical, so v2 is a UI swap, not a model change.
//
// New templates start as a clone of "Чистый шаблон" so users get items+client
// scaffolding for free.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, Plus, Save, Trash2 } from 'lucide-react';
import {
  useOrderTemplate,
  useUpdateOrderTemplate,
  type OrderTemplateInput,
} from '@/entities/order/templatesApi';
import type {
  FieldType,
  OrderTemplateField,
  OrderTemplateSection,
} from '@/entities/order/templates';
import { TemplateAttributeRenderer } from '@/shared/ui/TemplateAttributeRenderer';
import { PageLoader } from '@/shared/ui/PageLoader';
import styles from './FieldDesignerPage.module.css';

const FIELD_TYPES: FieldType[] = [
  'text', 'longtext', 'number', 'money',
  'select', 'multiselect', 'toggle', 'date', 'file',
];

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function FieldDesignerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: template, isLoading } = useOrderTemplate(id);
  const update = useUpdateOrderTemplate();

  const [draft, setDraft] = useState<OrderTemplateInput | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (template) {
      setDraft({
        name: template.name,
        itemNoun: template.itemNoun,
        primaryUnit: template.primaryUnit,
        primaryPrecision: template.primaryPrecision,
        sections: template.sections,
      });
      setActiveSectionId(template.sections[0]?.id ?? null);
      setActiveFieldId(template.sections[0]?.fields[0]?.id ?? null);
    }
  }, [template]);

  const activeSection = useMemo(
    () => draft?.sections.find((s) => s.id === activeSectionId) ?? null,
    [draft, activeSectionId],
  );

  const activeField = useMemo(
    () => activeSection?.fields.find((f) => f.id === activeFieldId) ?? null,
    [activeSection, activeFieldId],
  );

  if (isLoading || !draft || !template) return <PageLoader />;

  if (template.isSystem) {
    return (
      <div className={styles.root}>
        <h1 className={styles.title}>Конструктор полей</h1>
        <div className={styles.notice}>
          Это системный шаблон — его нельзя редактировать. Сначала клонируйте его в библиотеке шаблонов.
        </div>
        <button className={styles.btnSecondary} onClick={() => navigate('/settings/order-templates')}>
          Назад к библиотеке
        </button>
      </div>
    );
  }

  const updateSection = (sectionId: string, patch: Partial<OrderTemplateSection>) => {
    setDraft((d) => d && ({
      ...d,
      sections: d.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
    }));
  };

  const updateField = (sectionId: string, fieldId: string, patch: Partial<OrderTemplateField>) => {
    setDraft((d) => d && ({
      ...d,
      sections: d.sections.map((s) =>
        s.id !== sectionId
          ? s
          : { ...s, fields: s.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)) },
      ),
    }));
  };

  const addField = (sectionId: string) => {
    const newField: OrderTemplateField = {
      id: makeId('f'),
      key: `field_${Date.now().toString(36).slice(-4)}`,
      label: 'Новое поле',
      type: 'text',
    };
    setDraft((d) => d && ({
      ...d,
      sections: d.sections.map((s) =>
        s.id !== sectionId ? s : { ...s, fields: [...s.fields, newField] },
      ),
    }));
    setActiveFieldId(newField.id);
  };

  const deleteField = (sectionId: string, fieldId: string) => {
    setDraft((d) => d && ({
      ...d,
      sections: d.sections.map((s) =>
        s.id !== sectionId ? s : { ...s, fields: s.fields.filter((f) => f.id !== fieldId) },
      ),
    }));
    if (activeFieldId === fieldId) setActiveFieldId(null);
  };

  const moveField = (sectionId: string, fieldId: string, direction: -1 | 1) => {
    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        sections: d.sections.map((s) => {
          if (s.id !== sectionId) return s;
          const idx = s.fields.findIndex((f) => f.id === fieldId);
          if (idx < 0) return s;
          const target = idx + direction;
          if (target < 0 || target >= s.fields.length) return s;
          const next = [...s.fields];
          [next[idx], next[target]] = [next[target], next[idx]];
          return { ...s, fields: next };
        }),
      };
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    setError(null);
    try {
      await update.mutateAsync({ id: template.id, input: draft });
      navigate('/settings/order-templates');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Не удалось сохранить шаблон';
      setError(msg);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Конструктор: {template.name}</h1>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={() => navigate('/settings/order-templates')}>
            Отмена
          </button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={update.isPending}>
            <Save size={14} />
            {update.isPending ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.metaRow}>
        <label className={styles.metaField}>
          <span>Название</span>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => d && ({ ...d, name: e.target.value }))}
          />
        </label>
        <label className={styles.metaField}>
          <span>Единица</span>
          <input
            type="text"
            value={draft.primaryUnit}
            onChange={(e) => setDraft((d) => d && ({ ...d, primaryUnit: e.target.value }))}
          />
        </label>
        <label className={styles.metaField}>
          <span>Точность</span>
          <input
            type="number"
            min={0}
            max={6}
            value={draft.primaryPrecision}
            onChange={(e) => setDraft((d) => d && ({ ...d, primaryPrecision: Number(e.target.value) }))}
          />
        </label>
        <label className={styles.metaField}>
          <span>Назв. позиции</span>
          <input
            type="text"
            value={draft.itemNoun}
            onChange={(e) => setDraft((d) => d && ({ ...d, itemNoun: e.target.value }))}
          />
        </label>
      </div>

      <div className={styles.threePane}>
        {/* LEFT: section / field tree */}
        <aside className={styles.leftPane}>
          {draft.sections.map((sec) => (
            <div key={sec.id} className={styles.sectionGroup}>
              <button
                className={`${styles.sectionHeader} ${activeSectionId === sec.id ? styles.sectionHeaderActive : ''}`}
                onClick={() => setActiveSectionId(sec.id)}
              >
                {sec.title} · {sec.fields.length}
              </button>
              {activeSectionId === sec.id && (
                <div className={styles.fieldList}>
                  {sec.fields.map((f) => (
                    <div key={f.id} className={`${styles.fieldRow} ${activeFieldId === f.id ? styles.fieldRowActive : ''}`}>
                      <button className={styles.fieldName} onClick={() => setActiveFieldId(f.id)}>
                        {f.label}
                      </button>
                      <button className={styles.iconBtn} onClick={() => moveField(sec.id, f.id, -1)} title="Вверх"><ChevronUp size={12} /></button>
                      <button className={styles.iconBtn} onClick={() => moveField(sec.id, f.id, 1)} title="Вниз"><ChevronDown size={12} /></button>
                      <button className={styles.iconBtn} onClick={() => deleteField(sec.id, f.id)} title="Удалить"><Trash2 size={12} /></button>
                    </div>
                  ))}
                  <button className={styles.addFieldBtn} onClick={() => addField(sec.id)}>
                    <Plus size={12} /> Добавить поле
                  </button>
                </div>
              )}
            </div>
          ))}
        </aside>

        {/* CENTER: live preview */}
        <main className={styles.previewPane}>
          <div className={styles.previewLabel}>Предпросмотр</div>
          {draft.sections.map((sec) => (
            <div key={sec.id} className={styles.previewSection}>
              <div className={styles.previewSectionTitle}>{sec.title}</div>
              <div className={styles.previewGrid}>
                {sec.fields.map((f) => (
                  <TemplateAttributeRenderer key={f.id} field={f} value={null} onChange={() => {}} mode="edit" disabled />
                ))}
              </div>
            </div>
          ))}
        </main>

        {/* RIGHT: inspector */}
        <aside className={styles.rightPane}>
          {activeField && activeSection ? (
            <FieldInspector
              field={activeField}
              onChange={(patch) => updateField(activeSection.id, activeField.id, patch)}
            />
          ) : (
            <div className={styles.inspectorEmpty}>Выберите поле слева, чтобы редактировать</div>
          )}
        </aside>
      </div>
    </div>
  );
}

function FieldInspector({
  field,
  onChange,
}: {
  field: OrderTemplateField;
  onChange: (patch: Partial<OrderTemplateField>) => void;
}) {
  return (
    <div className={styles.inspector}>
      <div className={styles.inspectorTitle}>Свойства поля</div>
      <label className={styles.inspectorRow}>
        <span>Подпись</span>
        <input type="text" value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
      </label>
      <label className={styles.inspectorRow}>
        <span>Ключ (key)</span>
        <input
          type="text"
          value={field.key}
          onChange={(e) => onChange({ key: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
        />
      </label>
      <label className={styles.inspectorRow}>
        <span>Тип</span>
        <select value={field.type} onChange={(e) => onChange({ type: e.target.value as FieldType })}>
          {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label className={styles.inspectorRow}>
        <span>Подсказка</span>
        <input type="text" value={field.placeholder ?? ''} onChange={(e) => onChange({ placeholder: e.target.value || undefined })} />
      </label>
      <label className={styles.inspectorRow}>
        <span>Ширина (1..4)</span>
        <input
          type="number"
          min={1}
          max={4}
          value={field.grow ?? 1}
          onChange={(e) => onChange({ grow: Math.min(4, Math.max(1, Number(e.target.value))) as 1 | 2 | 3 | 4 })}
        />
      </label>
      <label className={styles.inspectorRow}>
        <span>Обязательное</span>
        <input type="checkbox" checked={field.required ?? false} onChange={(e) => onChange({ required: e.target.checked })} />
      </label>
      <label className={styles.inspectorRow}>
        <span>Моно-шрифт</span>
        <input type="checkbox" checked={field.mono ?? false} onChange={(e) => onChange({ mono: e.target.checked })} />
      </label>
      <label className={styles.inspectorRow}>
        <span>Влияет на склад (variant axis)</span>
        <input
          type="checkbox"
          checked={field.affectsAvailability ?? false}
          onChange={(e) => onChange({ affectsAvailability: e.target.checked })}
        />
      </label>
      {(field.type === 'select' || field.type === 'multiselect') && (
        <label className={styles.inspectorRow}>
          <span>Варианты (по одной в строке)</span>
          <textarea
            rows={4}
            value={(field.options ?? []).join('\n')}
            onChange={(e) => onChange({ options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
          />
        </label>
      )}
    </div>
  );
}
