// P5 + P7 — Templates Library.
//
// Lists every OrderTemplate available to the current org with its sections
// preview, plus clone/edit/delete actions. System templates are read-only —
// clone them to a non-system copy first.

import { useNavigate } from 'react-router-dom';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import {
  useOrderTemplates,
  useCloneOrderTemplate,
  useDeleteOrderTemplate,
} from '@/entities/order/templatesApi';
import { getClientSection, getItemsSection } from '@/entities/order/templates';
import { TemplateAttributeRenderer } from '@/shared/ui/TemplateAttributeRenderer';
import { PageLoader } from '@/shared/ui/PageLoader';
import styles from './TemplatesLibraryPage.module.css';

export default function TemplatesLibraryPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useOrderTemplates();
  const cloneTpl = useCloneOrderTemplate();
  const deleteTpl = useDeleteOrderTemplate();

  const handleClone = async (id: string) => {
    const result = await cloneTpl.mutateAsync({ id });
    navigate(`/settings/order-templates/${result.id}`);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить шаблон «${name}»?`)) return;
    await deleteTpl.mutateAsync(id);
  };

  if (isLoading) return <PageLoader />;
  if (error) {
    return (
      <div className={styles.root}>
        <h1 className={styles.title}>Шаблоны заказов</h1>
        <div className={styles.error}>Не удалось загрузить шаблоны</div>
      </div>
    );
  }

  const templates = data?.results ?? [];

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Шаблоны заказов</h1>
        <p className={styles.subtitle}>
          Шаблоны определяют поля формы создания заказа и карточки. Системные шаблоны нельзя
          удалить — можно клонировать в редактируемую копию.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className={styles.empty}>Шаблоны не найдены</div>
      ) : (
        <div className={styles.grid}>
          {templates.map((tpl) => {
            const items = getItemsSection(tpl);
            const client = getClientSection(tpl);
            return (
              <div key={tpl.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardName}>{tpl.name}</h3>
                  {tpl.isSystem && <span className={styles.badge}>Системный</span>}
                </div>
                <div className={styles.meta}>
                  Единица: {tpl.primaryUnit} · Точность: {tpl.primaryPrecision} · {tpl.sections.length} секция(ий)
                </div>
                {client && (
                  <div className={styles.sectionPreview}>
                    <div className={styles.sectionPreviewLabel}>Клиент · {client.fields.length} поля</div>
                    <div className={styles.chipRow}>
                      {client.fields.map((f) => (
                        <span key={f.id} className={styles.chip}>{f.label}</span>
                      ))}
                    </div>
                  </div>
                )}
                {items && (
                  <div className={styles.sectionPreview}>
                    <div className={styles.sectionPreviewLabel}>Позиции · {items.fields.length} поля</div>
                    <div className={styles.chipRow}>
                      {items.fields.map((f) => (
                        <span key={f.id} className={styles.chip}>
                          {f.label}{f.required ? ' *' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.btnIcon}
                    onClick={() => handleClone(tpl.id)}
                    disabled={cloneTpl.isPending}
                  >
                    <Copy size={12} /> Клонировать
                  </button>
                  {!tpl.isSystem && (
                    <>
                      <button
                        type="button"
                        className={styles.btnIcon}
                        onClick={() => navigate(`/settings/order-templates/${tpl.id}`)}
                      >
                        <Pencil size={12} /> Редактировать
                      </button>
                      <button
                        type="button"
                        className={`${styles.btnIcon} ${styles.btnDanger}`}
                        onClick={() => handleDelete(tpl.id, tpl.name)}
                        disabled={deleteTpl.isPending}
                      >
                        <Trash2 size={12} /> Удалить
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {templates[0] && (
        <div className={styles.previewBlock}>
          <h2 className={styles.previewTitle}>Превью «{templates[0].name}»</h2>
          <div className={styles.previewGrid}>
            {(getItemsSection(templates[0])?.fields ?? []).map((f) => (
              <TemplateAttributeRenderer
                key={f.id}
                field={f}
                value={null}
                onChange={() => {}}
                mode="edit"
                disabled
              />
            ))}
          </div>
        </div>
      )}

      <div className={styles.footer}>
        Превью полей рендерится через <code>&lt;TemplateAttributeRenderer /&gt;</code>.
        Конструктор полей открывается по клику «Редактировать» (только для несистемных шаблонов).
      </div>
    </div>
  );
}
