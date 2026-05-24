// P5/Stage 1 — Template picker shown at the top of NewOrderPage.
//
// Mirrors the handoff prototype's TemplatePicker (top-right of the sticky
// header): displays the active template name, opens a dropdown listing all
// available templates with descriptions, and a footer link into the
// designer / library.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Pencil, Sliders, Check } from 'lucide-react';
import { useOrderTemplates, useActiveOrderTemplate } from '@/entities/order/templatesApi';
import type { OrderTemplate } from '@/entities/order/templates';
import styles from './TemplatePicker.module.css';

export interface TemplatePickerProps {
  selectedTemplateId: string | null;
  onSelect: (id: string | null) => void;
}

export function TemplatePicker({ selectedTemplateId, onSelect }: TemplatePickerProps) {
  const navigate = useNavigate();
  const { data, isLoading } = useOrderTemplates();
  const active = useActiveOrderTemplate(selectedTemplateId).data;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [open]);

  if (isLoading || !data) {
    return (
      <div className={styles.root}>
        <div className={styles.trigger}>
          <span className={styles.tag}>Шаблон</span>
          <span className={styles.value}>Загрузка…</span>
        </div>
      </div>
    );
  }

  const templates = data.results ?? [];

  return (
    <div className={styles.root} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.tag}>Шаблон</span>
        <span className={styles.value}>{active?.name ?? 'Без шаблона'}</span>
        <ChevronDown size={12} className={styles.chev} />
      </button>

      {open && (
        <div className={styles.popover} role="listbox">
          <div className={styles.popoverHead}>
            <span>Активный шаблон</span>
            <button
              type="button"
              className={styles.popoverLink}
              onClick={() => {
                setOpen(false);
                navigate('/settings/order-templates');
              }}
            >
              Все шаблоны →
            </button>
          </div>
          <div className={styles.options}>
            {templates.map((t: OrderTemplate) => {
              const isActive = active?.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.option} ${isActive ? styles.optionActive : ''}`}
                  onClick={() => {
                    onSelect(t.id);
                    setOpen(false);
                  }}
                  role="option"
                  aria-selected={isActive}
                >
                  <div className={styles.optionMain}>
                    <div className={styles.optionName}>{t.name}</div>
                    <div className={styles.optionMeta}>
                      {t.primaryUnit} · {(t.sections.find((s) => s.kind === 'items')?.fields.length ?? 0)} полей
                    </div>
                  </div>
                  {isActive && <Check size={14} className={styles.optionCheck} />}
                </button>
              );
            })}
          </div>
          <div className={styles.popoverFoot}>
            <button
              type="button"
              className={styles.footBtn}
              onClick={() => {
                setOpen(false);
                if (active) navigate(`/settings/order-templates/${active.id}`);
                else navigate('/settings/order-templates');
              }}
            >
              <Pencil size={12} />
              Редактировать поля
            </button>
            <button
              type="button"
              className={styles.footBtn}
              onClick={() => {
                setOpen(false);
                navigate('/settings/order-templates');
              }}
            >
              <Sliders size={12} />
              Библиотека
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
