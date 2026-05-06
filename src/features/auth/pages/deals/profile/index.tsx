import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Edit3, User, Calendar, Target, AlertCircle,
  Phone, Mail, Building2, Plus, CheckSquare, CheckCircle2, MessageSquare,
} from 'lucide-react';
import { api } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';
import { PageLoader } from '../../../shared/ui/PageLoader';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { Drawer } from '../../../shared/ui/Drawer';
import { FormErrorSummary } from '../../../shared/ui/FormErrorSummary';
import { Input } from '../../../shared/ui/Input';
import { Badge } from '../../../shared/ui/Badge';
import { currencySymbol, formatMoney } from '../../../shared/utils/format';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { getDateLocale } from '../../../shared/utils/locale';
import { useConvert } from '../../../shared/hooks/useExchangeRates';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useUIStore } from '../../../shared/stores/ui';
import { fadeUp } from '../../../shared/motion/presets';
import s from './DealProfile.module.css';
import { setProductMoment } from '../../../shared/utils/productMoment';
import { useCapabilities } from '../../../shared/hooks/useCapabilities';
import { useTabsKeyboardNav } from '../../../shared/hooks/useTabsKeyboardNav';

/* ── Types ──────────────────────────────────────────────────── */
interface Stage { id: string; name: string; position: number; type: string; color?: string; }
interface DealDetail {
  id: string; title: string; amount: number | null; currency: string;
  status: string; created_at: string; expected_close_date: string | null;
  next_step?: string;
  customer: { id: string; full_name: string; company_name: string; phone: string; email: string; } | null;
  owner: { id: string; full_name: string } | null;
  stage: Stage;
  pipeline: { id: string; name: string; stages: Stage[] };
}
interface Activity { id: string; type: string; payload: Record<string, unknown>; actor: { full_name: string } | null; created_at: string; }
interface Task { id: string; title: string; is_done: boolean; due_date: string | null; priority: string; assignee: { full_name: string } | null; }

type Tab = 'notes' | 'tasks' | 'activity';
const TABS: { key: Tab; label: string }[] = [
  { key: 'notes',    label: 'Заметки' },
  { key: 'tasks',    label: 'Задачи' },
  { key: 'activity', label: 'История' },
];

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  open: { bg: 'var(--fill-info-soft)',     color: 'var(--fill-info-text)',     label: 'Открыта' },
  won:  { bg: 'var(--fill-positive-soft)', color: 'var(--fill-positive-text)', label: 'Выиграна' },
  lost: { bg: 'var(--fill-negative-soft)', color: 'var(--fill-negative-text)', label: 'Проиграна' },
};

/* ── Helpers ────────────────────────────────────────────────── */
function activityText(a: Activity): string {
  const p = a.payload as any;
  switch (a.type) {
    case 'note.created':   return 'Добавил заметку';
    case 'stage.changed':  return `Сменил этап -> ${p?.to ?? ''}`;
    case 'task.created':   return `Создал задачу "${p?.title ?? ''}"`;
    case 'deal.updated':   return 'Обновил сделку';
    default:               return a.type;
  }
}

/* ── Main ───────────────────────────────────────────────────── */
export default function DealProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('notes');
  const [editDrawer, setEditDrawer] = useState(false);
  const openAssistantPrompt = useUIStore(s => s.openAssistantPrompt);
  const { can } = useCapabilities();
  const canEditDeal = can('deals:write');
  const canWriteTasks = can('tasks:write');
  const tabKeys = TABS.filter((item) => item.key !== 'tasks' || canWriteTasks).map((item) => item.key);
  const handleTabKeyDown = useTabsKeyboardNav(tabKeys, tab, setTab);
  const [newTask, setNewTask]   = useState(false);
  const [noteText, setNoteText] = useState('');
  const convert = useConvert();

  const { data: deal, isLoading } = useQuery<DealDetail>({
    queryKey: ['deal', id],
    queryFn:  () => api.get(`/deals/${id}/`),
    enabled:  !!id,
  });

  const { data: activities } = useQuery<{ results: Activity[] }>({
    queryKey: ['deal-activities', id],
    queryFn:  () => api.get(`/deals/${id}/activities/`),
    enabled:  !!id,
  });

  const { data: tasks } = useQuery<{ results: Task[] }>({
    queryKey: ['deal-tasks', id],
    queryFn:  () => api.get(`/tasks/?deal_id=${id}`),
    enabled:  !!id,
  });

  useDocumentTitle(deal?.title ?? 'Сделка');

  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm<{
    title: string; amount: number | null; expected_close_date: string;
  }>({ values: deal ? { title: deal.title, amount: deal.amount, expected_close_date: deal.expected_close_date ?? '' } : undefined });

  const updateDeal = useMutation({
    mutationFn: (d: any) => api.patch(`/deals/${id}/`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deal', id] }); toast.success('Сделка обновлена'); setEditDrawer(false); },
    onError:   () => toast.error('Не удалось обновить'),
  });

  const stageChange = useMutation({
    mutationFn: (stageId: string) => api.patch(`/deals/${id}/`, { stage_id: stageId }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['deal', id] }); toast.success('Этап изменён'); },
    onError:    () => toast.error('Не удалось изменить этап'),
  });

  const addNote = useMutation({
    mutationFn: () => api.post(`/deals/${id}/activities/`, { type: 'note.created', payload: { body: noteText } }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['deal-activities', id] }); setNoteText(''); toast.success('Заметка добавлена'); },
    onError:    () => toast.error('Ошибка'),
  });

  const completeTask = useMutation({
    mutationFn: (tid: string) => api.post(`/tasks/${tid}/complete/`),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['deal-tasks', id] }); toast.success('Задача выполнена'); },
  });

  if (isLoading) return <PageLoader />;
  if (!deal)     return null;

  const stages      = [...(deal.pipeline.stages ?? [])].sort((a,b) => a.position - b.position);
  const curIdx      = stages.findIndex(s => s.id === deal.stage.id);
  const daysToClose = deal.expected_close_date ? differenceInDays(new Date(deal.expected_close_date), new Date()) : null;
  const statusB     = STATUS_BADGE[deal.status] ?? STATUS_BADGE.open;
  const converted   = deal.amount ? convert(deal.amount, deal.currency, 'KZT') : null;

  return (
    <motion.div className={s.page} variants={fadeUp} initial="hidden" animate="visible">
      {/* Back ─────────────────────────────────────────────────── */}
      <button className={s.back} onClick={() => navigate(-1)}>
        <ChevronLeft size={16} /> Назад к сделкам
      </button>

      {/* Header ──────────────────────────────────────────────── */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <h1 className={s.dealTitle}>{deal.title}</h1>
          <div className={s.headerBadges}>
            <Badge bg={statusB.bg} color={statusB.color}>{statusB.label}</Badge>
            {deal.amount && (
              <span className={s.amountChip}>
                {currencySymbol(deal.currency)}{deal.amount.toLocaleString()}
              </span>
            )}
            {converted && deal.currency !== 'KZT' && (
              <Badge bg="var(--bg-surface-inset)" color="var(--text-tertiary)">
                ≈ {formatMoney(converted, 'KZT')}
              </Badge>
            )}
          </div>
        </div>
        <div className={s.headerActions}>
          {canEditDeal && <Button variant="secondary" size="sm" icon={<Edit3 size={14} />} onClick={() => setEditDrawer(true)}>
            Редактировать
          </Button>}
        </div>
      </div>

      <div className={s.nextActionSurface}>
        <div className={s.nextActionCopy}>
          <span className={s.nextActionEyebrow}>Дальше по сделке</span>
          <strong className={s.nextActionTitle}>Оставьте следующий шаг, пока контекст сделки ещё живой</strong>
          <span className={s.nextActionText}>Сдвиньте этап, оставьте заметку или поставьте задачу, пока сделка ещё находится в рабочем контексте команды.</span>
        </div>
        <div className={s.nextActionButtons}>
          <button className={s.nextActionBtn} onClick={() => { setProductMoment(`Сделка «${deal.title}» в фокусе. Зафиксируйте следующий шаг, пока контекст не остыл.`); setTab('notes'); }}>Открыть заметки</button>
          {canWriteTasks && <button className={s.nextActionBtn} onClick={() => setTab('tasks')}>Открыть задачи</button>}
          <button className={s.nextActionBtn} onClick={() => openAssistantPrompt(`Что сейчас лучший следующий шаг по сделке ${deal.title}?`)}>Подсказать следующий шаг</button>
        </div>
      </div>

      {/* Pipeline progress ───────────────────────────────────── */}
      <div className={s.pipelineSection}>
        <div className={s.pipelineLabel}>{deal.pipeline.name}</div>
        <div className={s.stageTrack}>
          {stages.map((stage, idx) => (
            <div
              key={stage.id}
              className={`${s.stageStep} ${idx === curIdx ? s.active : idx < curIdx ? s.past : ''}`}
              onClick={() => canEditDeal && idx !== curIdx && stageChange.mutate(stage.id)}
              title={canEditDeal ? `${stage.name} - сменить этап` : stage.name}
            >
              <div className={`${s.stageBar} ${idx < curIdx ? s.past : idx === curIdx ? s.active : ''}`} />
              <span className={s.stageStepLabel}>{stage.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Body grid ───────────────────────────────────────────── */}
      <div className={s.bodyGrid}>
        {/* Main column ──────────────────────────────────────── */}
        <div className={s.card}>
          {/* Tab bar */}
          <div className={s.tabBar} role="tablist" aria-label="Разделы карточки сделки" aria-orientation="horizontal" onKeyDown={handleTabKeyDown}>
            {TABS.filter((item) => item.key !== 'tasks' || canWriteTasks).map(t => (
              <button
                key={t.key}
                role="tab"
                id={`deal-tab-${t.key}`}
                aria-selected={tab === t.key}
                aria-controls={`deal-panel-${t.key}`}
                tabIndex={tab === t.key ? 0 : -1}
                className={`${s.tab} ${tab === t.key ? s.active : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className={s.tabContent}>
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                id={`deal-panel-${tab}`}
                role="tabpanel"
                aria-labelledby={`deal-tab-${tab}`}
                tabIndex={0}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
              >
                {/* Notes tab */}
                {tab === 'notes' && (
                  <>
                    <div className={s.noteForm}>
                      <textarea
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        placeholder="Добавьте заметку по сделке..."
                        className={`kort-textarea ${s.noteTextarea}`}
                      />
                      <div className={s.noteActions}>
                        <Button
                          size="sm"
                          disabled={!noteText.trim()}
                          loading={addNote.isPending}
                          onClick={() => addNote.mutate()}
                        >
                          Сохранить
                        </Button>
                      </div>
                    </div>
                    {(activities?.results ?? [])
                      .filter(a => a.type === 'note.created')
                      .map(a => (
                        <div key={a.id} className={s.noteItem}>
                          <div className={s.noteBody}>{(a.payload as any)?.body}</div>
                          <div className={s.noteMeta}>
                            {a.actor?.full_name} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: getDateLocale() })}
                          </div>
                        </div>
                      ))
                    }
                    {(activities?.results ?? []).filter(a => a.type === 'note.created').length === 0 && (
                      <EmptyState icon={<MessageSquare size={18} />} title="Заметок нет" subtitle="Добавьте первую заметку к сделке" />
                    )}
                  </>
                )}

                {/* Tasks tab */}
                {tab === 'tasks' && (
                  <>
                    <div className={s.taskHeader}>
                      <span className={s.taskHeaderTitle}>Задачи</span>
                      {can('tasks:write') && <Button size="sm" variant="secondary" icon={<Plus size={13} />} onClick={() => setNewTask(true)}>
                        Добавить
                      </Button>}
                    </div>
                    {(tasks?.results ?? []).length === 0 ? (
                      <EmptyState icon={<CheckSquare size={18} />} title="Задач нет" subtitle="Добавьте задачу к этой сделке" />
                    ) : (
                      (tasks?.results ?? []).map(task => (
                        <div key={task.id} className={`${s.taskRow} ${task.is_done ? s.done : ''}`}>
                          <input
                            type="checkbox"
                            checked={task.is_done}
                            onChange={() => !task.is_done && completeTask.mutate(task.id)}
                            className={s.taskCheck}
                          />
                          <div className={s.taskRowBody}>
                            <div className={s.taskRowTitle}>{task.title}</div>
                            {task.due_date && (
                              <div className={s.taskRowDue}>
                                До {format(new Date(task.due_date), 'd MMM', { locale: getDateLocale() })}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* Activity tab */}
                {tab === 'activity' && (
                  <div className={s.timeline}>
                    {(activities?.results ?? []).length === 0 ? (
                      <EmptyState icon={<AlertCircle size={18} />} title="История пуста" subtitle="Здесь будут отображаться все действия по сделке" />
                    ) : (
                      (activities?.results ?? []).map(a => (
                        <div key={a.id} className={s.timelineItem}>
                          <div className={s.timelineDot}>
                            <AlertCircle size={10} />
                          </div>
                          <div className={s.timelineBody}>
                            <div className={s.timelineText}>
                              <strong>{a.actor?.full_name ?? 'Система'}</strong> — {activityText(a)}
                            </div>
                            <div className={s.timelineTime}>
                              {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: getDateLocale() })}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Sidebar ─────────────────────────────────────────── */}
        <div className={s.sidebarStack}>
          {/* Customer card */}
          {deal.customer && (
            <div className={`${s.sideCard} ${s.customerCard}`} onClick={() => navigate(`/customers/${deal.customer!.id}`)}>
              <div className={s.sideCardLabel}>Клиент</div>
              <div>
                <div className={s.customerName}>{deal.customer.full_name}</div>
                {deal.customer.company_name && (
                  <div className={s.customerCompany}><Building2 size={11} className={s.inlineCompanyIcon} />{deal.customer.company_name}</div>
                )}
              </div>
              <div className={s.customerLinks}>
                {deal.customer.phone && (
                  <a href={`tel:${deal.customer.phone}`} className={s.customerLink} onClick={e => e.stopPropagation()}>
                    <Phone size={12} />{deal.customer.phone}
                  </a>
                )}
                {deal.customer.email && (
                  <a href={`mailto:${deal.customer.email}`} className={s.customerLink} onClick={e => e.stopPropagation()}>
                    <Mail size={12} />{deal.customer.email}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Details card */}
          <div className={s.sideCard}>
            <div className={s.sideCardLabel}>Детали</div>
            <div className={s.metaList}>
              {deal.owner && (
                <div className={s.metaRow}>
                  <span className={s.metaIcon}><User size={13} /></span>
                  <div className={s.metaValue}>
                    <div className={s.metaValueLabel}>Ответственный</div>
                    <div className={s.metaValueText}>{deal.owner.full_name}</div>
                  </div>
                </div>
              )}
              <div className={s.metaRow}>
                <span className={s.metaIcon}><Calendar size={13} /></span>
                <div className={s.metaValue}>
                  <div className={s.metaValueLabel}>Создана</div>
                  <div className={s.metaValueText}>{format(new Date(deal.created_at), 'd MMM yyyy', { locale: getDateLocale() })}</div>
                </div>
              </div>
              {deal.expected_close_date && (
                <div className={s.metaRow}>
                  <span className={s.metaIcon}><Target size={13} /></span>
                  <div className={s.metaValue}>
                    <div className={s.metaValueLabel}>Дата закрытия</div>
                    <div className={s.metaValueText}>{format(new Date(deal.expected_close_date), 'd MMM yyyy', { locale: getDateLocale() })}</div>
                    {daysToClose !== null && (
                      <div className={`${s.metaValueExtra} ${daysToClose < 0 ? s.overdue : daysToClose < 7 ? s.warning : s.ok}`}>
                        {daysToClose < 0 ? `просрочено ${Math.abs(daysToClose)} дн` : `через ${daysToClose} дн`}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className={s.metaRow}>
                <span className={s.metaIcon}><AlertCircle size={13} /></span>
                <div className={s.metaValue}>
                  <div className={s.metaValueLabel}>Воронка</div>
                  <div className={s.metaValueText}>{deal.pipeline.name}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit drawer */}
      <Drawer
        open={editDrawer}
        onClose={() => setEditDrawer(false)}
        title="Редактировать сделку"
        subtitle="Исправьте базовые данные сделки, чтобы команда видела корректную сумму и ожидаемую дату."
        footer={
          <div className={s.drawerFooter}>
            <Button type="button" variant="secondary" onClick={() => setEditDrawer(false)}>Отмена</Button>
            <Button type="submit" form="deal-edit-form" loading={isSubmitting || updateDeal.isPending}>Сохранить</Button>
          </div>
        }
      >
        <form id="deal-edit-form" className={s.formFields} onSubmit={handleSubmit(d => updateDeal.mutate(d))} noValidate>
          <FormErrorSummary errors={errors} title="Проверьте данные сделки" />
          <Input label="Название" required error={errors.title?.message} {...register('title', { required: 'Укажите название', validate: (v) => String(v ?? '').trim().length >= 3 || 'Название слишком короткое' })} />
          <Input label="Сумма" type="number" error={errors.amount?.message as string | undefined} {...register('amount', { validate: (v) => !v || Number(v) >= 0 || 'Сумма не может быть отрицательной' })} />
          <Input label="Дата закрытия" type="date" {...register('expected_close_date')} />
        </form>
      </Drawer>
    </motion.div>
  );
}
