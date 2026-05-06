/**
 * features/workspace/widgets/chapan/spa/ProductionTemplateSPA.tsx
 *
 * 3-step wizard for creating a new production workspace.
 * Step 1 — Identity: name, descriptor, order prefix
 * Step 2 — Stages: define production pipeline stages
 * Step 3 — Mode: light or advanced
 *
 * On submit: calls workshopApi.createWorkshop (mock until backend ready),
 * saves workshopId to shell store, navigates to 'workspace'.
 */

import { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp,
  Factory, RefreshCw, Settings, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/Button';
import { Input, Textarea } from '@/shared/ui/Input';
import { workshopApi } from '@/features/production-spa/api/client';
import type { WorkshopMode } from '@/features/production-spa/api/types';
import { useTileProductionShell } from './production-shell.store';
import s from './ProductionTemplateSPA.module.css';

interface Props { tileId: string; onBack: () => void; }
type Step = 1 | 2 | 3;
interface StageItem { id: string; name: string; estimatedMinutes: number; }

const DEFAULT_STAGES_LIGHT: StageItem[] = [
  { id: 'st1', name: 'Приёмка', estimatedMinutes: 30 },
  { id: 'st2', name: 'Пошив', estimatedMinutes: 120 },
  { id: 'st3', name: 'ОТК', estimatedMinutes: 30 },
];

const DEFAULT_STAGES_ADVANCED: StageItem[] = [
  { id: 'st1', name: 'Приёмка материалов', estimatedMinutes: 30 },
  { id: 'st2', name: 'Раскрой', estimatedMinutes: 60 },
  { id: 'st3', name: 'Пошив / Сборка', estimatedMinutes: 120 },
  { id: 'st4', name: 'Отделка', estimatedMinutes: 45 },
  { id: 'st5', name: 'Контроль качества', estimatedMinutes: 30 },
];

function uid() { return Math.random().toString(36).slice(2, 8); }
function normalizePrefix(v: string) { return v.replace(/\s+/g, '').toUpperCase().slice(0, 5); }

function StepDots({ current }: { current: Step }) {
  return (
    <div className={s.stepDots}>
      {([1, 2, 3] as Step[]).map((n) => (
        <span key={n} className={s.stepDot}
          data-state={n < current ? 'done' : n === current ? 'active' : 'pending'}>
          {n < current ? <Check size={10} /> : n}
        </span>
      ))}
    </div>
  );
}

function Step1({ name, setName, descriptor, setDescriptor, prefix, setPrefix }: {
  name: string; setName: (v: string) => void;
  descriptor: string; setDescriptor: (v: string) => void;
  prefix: string; setPrefix: (v: string) => void;
}) {
  const preview = `${normalizePrefix(prefix) || 'ЦЕХ'}-0001`;
  return (
    <div className={s.stepContent}>
      <div className={s.stepHeader}>
        <span className={s.stepEyebrow}>Шаг 1 из 3</span>
        <h2 className={s.stepTitle}>Название и идентификация</h2>
        <p className={s.stepLead}>Задайте имя цеха и префикс для нумерации заказов.</p>
      </div>
      <div className={s.form}>
        <Input label="Название цеха" value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Ателье «Шейла»" autoFocus autoComplete="off" />
        <Textarea label="Описание (необязательно)" value={descriptor}
          onChange={(e) => setDescriptor(e.target.value)}
          placeholder="Кратко о специализации цеха" rows={3} />
        <Input label="Префикс заказов" value={prefix}
          onChange={(e) => setPrefix(normalizePrefix(e.target.value))}
          placeholder="ЦЕХ" autoComplete="off" />
        <div className={s.preview}>
          Первый заказ получит номер: <strong>{preview}</strong>
        </div>
      </div>
    </div>
  );
}

function Step2({ stages, setStages }: { stages: StageItem[]; setStages: (v: StageItem[]) => void }) {
  const [newName, setNewName] = useState('');
  function add() {
    if (!newName.trim()) return;
    setStages([...stages, { id: uid(), name: newName.trim(), estimatedMinutes: 60 }]);
    setNewName('');
  }
  function remove(id: string) { setStages(stages.filter((s) => s.id !== id)); }
  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...stages]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; setStages(next);
  }
  function moveDown(idx: number) {
    if (idx === stages.length - 1) return;
    const next = [...stages]; [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; setStages(next);
  }
  function updateMinutes(id: string, val: number) {
    setStages(stages.map((s) => s.id === id ? { ...s, estimatedMinutes: Math.max(5, val) } : s));
  }
  return (
    <div className={s.stepContent}>
      <div className={s.stepHeader}>
        <span className={s.stepEyebrow}>Шаг 2 из 3</span>
        <h2 className={s.stepTitle}>Этапы производства</h2>
        <p className={s.stepLead}>Задайте технологический маршрут. Можно изменить позже.</p>
      </div>
      <div className={s.stageList}>
        {stages.map((stage, idx) => (
          <div key={stage.id} className={s.stageRow}>
            <span className={s.stageIdx}>{idx + 1}</span>
            <span className={s.stageName}>{stage.name}</span>
            <div className={s.stageMinutes}>
              <input type="number" className={s.minutesInput} value={stage.estimatedMinutes}
                min={5} step={5} onChange={(e) => updateMinutes(stage.id, Number(e.target.value))} title="мин" />
              <span className={s.minutesLabel}>мин</span>
            </div>
            <div className={s.stageControls}>
              <button className={s.iconBtn} onClick={() => moveUp(idx)} disabled={idx === 0}><ChevronUp size={12} /></button>
              <button className={s.iconBtn} onClick={() => moveDown(idx)} disabled={idx === stages.length - 1}><ChevronDown size={12} /></button>
              <button className={s.iconBtn} data-danger="true" onClick={() => remove(stage.id)}><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
        {stages.length === 0 && <div className={s.stageEmpty}>Добавьте хотя бы один этап</div>}
      </div>
      <div className={s.stageAdd}>
        <input className={s.stageInput} placeholder="Новый этап..."
          value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className={s.stageAddBtn} onClick={add} disabled={!newName.trim()}>Добавить</button>
      </div>
    </div>
  );
}

function Step3({ mode, setMode }: { mode: WorkshopMode; setMode: (v: WorkshopMode) => void }) {
  return (
    <div className={s.stepContent}>
      <div className={s.stepHeader}>
        <span className={s.stepEyebrow}>Шаг 3 из 3</span>
        <h2 className={s.stepTitle}>Тип производства</h2>
        <p className={s.stepLead}>Определяет глубину функционала. Можно поменять позже.</p>
      </div>
      <div className={s.modeCards}>
        <button className={s.modeCard} data-selected={mode === 'light'} onClick={() => setMode('light')}>
          <span className={s.modeIcon}><Factory size={22} strokeWidth={1.5} /></span>
          <div className={s.modeBody}>
            <strong className={s.modeTitle}>Лёгкое производство</strong>
            <p className={s.modeDesc}>Швейные цеха, ателье, ювелиры. Простой заказ, быстрый старт.</p>
          </div>
          {mode === 'light' && <span className={s.modeCheck}><Check size={14} /></span>}
        </button>
        <button className={s.modeCard} data-selected={mode === 'advanced'} onClick={() => setMode('advanced')}>
          <span className={s.modeIcon}><Settings size={22} strokeWidth={1.5} /></span>
          <div className={s.modeBody}>
            <strong className={s.modeTitle}>Сложное производство</strong>
            <p className={s.modeDesc}>Инженерные цеха, серийная сборка, многоуровневые спецификации.</p>
          </div>
          {mode === 'advanced' && <span className={s.modeCheck}><Check size={14} /></span>}
        </button>
      </div>
    </div>
  );
}

export function ProductionTemplateSPA({ tileId, onBack }: Props) {
  const {
    templateName, templateDescriptor, templateOrderPrefix,
    setTemplateName, setTemplateDescriptor, setTemplateOrderPrefix,
    setWorkshopId, openWorkspace,
  } = useTileProductionShell(tileId);

  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<WorkshopMode>('light');
  const [stages, setStages] = useState<StageItem[]>(DEFAULT_STAGES_LIGHT);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const prefix = normalizePrefix(templateOrderPrefix);

  function handleSetMode(v: WorkshopMode) {
    setMode(v);
    setStages(v === 'advanced' ? DEFAULT_STAGES_ADVANCED : DEFAULT_STAGES_LIGHT);
  }

  const canAdvance = useMemo(() => {
    if (step === 1) return templateName.trim().length > 0 && prefix.length > 0;
    if (step === 2) return stages.length > 0;
    return true;
  }, [step, templateName, prefix, stages]);

  async function handleSubmit() {
    const name = templateName.trim();
    if (!name || !prefix) { toast.error('Заполните название и префикс.'); return; }
    setIsSubmitting(true);
    try {
      const profile = await workshopApi.createWorkshop({
        name, descriptor: templateDescriptor.trim(), prefix, mode,
        stages: stages.map((s) => ({ name: s.name, estimatedMinutes: s.estimatedMinutes })),
      });
      setWorkshopId(profile.id);
      openWorkspace('workspace');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось создать производство.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={s.root}>
      <div className={s.layout}>
        <aside className={s.aside}>
          <Button variant="ghost" size="md" icon={<ArrowLeft size={15} />}
            onClick={onBack} className={s.backBtn}>К производствам</Button>
          <div className={s.copy}>
            <span className={s.eyebrow}>Новое производство</span>
            <h1 className={s.title}>Настройка рабочего пространства</h1>
            <p className={s.lead}>Три шага — и цех готов к работе. Всё можно изменить позже.</p>
          </div>
          <StepDots current={step} />
          {templateName.trim() && (
            <div className={s.summary}>
              <div className={s.summaryLabel}>Создаётся цех</div>
              <div className={s.summaryValue}>{templateName.trim()}</div>
              {prefix && <div className={s.summaryText}>Первый заказ: <strong>{prefix}-0001</strong></div>}
            </div>
          )}
        </aside>

        <section className={s.card}>
          {step === 1 && <Step1 name={templateName} setName={setTemplateName}
            descriptor={templateDescriptor} setDescriptor={setTemplateDescriptor}
            prefix={templateOrderPrefix} setPrefix={setTemplateOrderPrefix} />}
          {step === 2 && <Step2 stages={stages} setStages={setStages} />}
          {step === 3 && <Step3 mode={mode} setMode={handleSetMode} />}

          <div className={s.wizardNav}>
            {step > 1 && (
              <Button variant="ghost" size="md" icon={<ArrowLeft size={14} />}
                onClick={() => setStep((p) => (p - 1) as Step)}>Назад</Button>
            )}
            {step < 3 ? (
              <Button variant="primary" size="md" iconRight={<ArrowRight size={14} />}
                disabled={!canAdvance}
                onClick={() => setStep((p) => (p + 1) as Step)}>Далее</Button>
            ) : (
              <Button variant="primary" size="lg" disabled={isSubmitting || !canAdvance}
                onClick={handleSubmit}
                iconRight={isSubmitting ? <RefreshCw size={14} className={s.spin} /> : <Check size={14} />}>
                Создать производство
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
