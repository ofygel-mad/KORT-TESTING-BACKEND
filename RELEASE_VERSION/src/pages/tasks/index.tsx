import { addDocumentListener } from '../../shared/lib/browser';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckSquare, Plus, Clock, AlertCircle, CheckCircle2, Trash2, User,
} from 'lucide-react';
import { api } from '../../shared/api/client';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Button } from '../../shared/ui/Button';
import { Badge } from '../../shared/ui/Badge';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Drawer } from '../../shared/ui/Drawer';
import { toast } from 'sonner';
import { format, isPast, isToday } from 'date-fns';
import { getDateLocale } from '../../shared/utils/locale';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import { useForm } from 'react-hook-form';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useUIStore } from '../../shared/stores/ui';
import { listContainer, listItem } from '../../shared/motion/presets';
import s from './Tasks.module.css';

interface TaskForm {
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  due_at?: string;
  customer_id?: string;
}

interface Task {
  id: string; title: string; description: string;
  priority: 'low' | 'medium' | 'high'; status: 'open' | 'done' | 'cancelled';
  due_at: string | null; completed_at: string | null;
  assigned_to: { id: string; full_name: string } | null;
  customer: { id: string; full_name: string } | null;
  deal: { id: string; title: string } | null;
  created_at: string;
}

const PRIORITY_LABEL: Record<string, string> = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };
const PRIORITY_BADGE: Record<string, { bg: string; color: string }> = {
  low:    { bg: 'var(--bg-surface-inset)',   color: 'var(--text-tertiary)' },
  medium: { bg: 'var(--fill-warning-soft)',  color: 'var(--fill-warning-text)' },
  high:   { bg: 'var(--fill-negative-soft)', color: 'var(--fill-negative-text)' },
};

type TaskFilter = 'mine' | 'due_today' | 'overdue' | '';

const FILTERS: Array<{ key: TaskFilter; label: string }> = [
  { key: 'mine', label: 'Мои' },
  { key: 'due_today', label: 'Сегодня' },
  { key: 'overdue', label: 'Просрочено' },
  { key: '', label: 'Все' },
];

export default function TasksPage() {
  useDocumentTitle('Задачи');
  const qc = useQueryClient();
  const [filter, setFilter] = useState<TaskFilter>('mine');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useIsMobile();
  const taskRequest = useUIStore(s => s.createTaskRequest);
  const openAssistantPrompt = useUIStore(s => s.openAssistantPrompt);

  const { register, handleSubmit, reset, setValue, formState: { isSubmitting } } = useForm<TaskForm>({
    defaultValues: { priority: 'medium' },
  });

  const params: Record<string, string> = {};
  if (filter === 'mine')      params.mine      = '1';
  if (filter === 'due_today') params.due_today = '1';
  if (filter === 'overdue')   params.overdue   = '1';

  const { data, isLoading } = useQuery<{ results: Task[] }>({
    queryKey: ['tasks', filter],
    queryFn: () => api.get('/tasks/', params),
  });
  const tasks = data?.results ?? [];

  const { data: allData } = useQuery<{ results: Task[] }>({
    queryKey: ['tasks', 'all'],
    queryFn: () => api.get('/tasks/', {}),
  });
  const allTasks = allData?.results ?? [];
  const overdueCount = allTasks.filter(t => t.due_at && isPast(new Date(t.due_at)) && t.status !== 'done').length;
  const todayCount   = allTasks.filter(t => t.due_at && isToday(new Date(t.due_at)) && t.status !== 'done').length;
  const doneCount    = allTasks.filter(t => t.status === 'done').length;

  const createMutation = useMutation({
    mutationFn: (data: TaskForm) => api.post('/tasks/', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Задача создана'); setDrawerOpen(false); reset(); },
    onError: () => toast.error('Не удалось создать задачу'),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/tasks/${id}/complete/`),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['tasks', filter] });
      const prev = qc.getQueryData<{ results: Task[] }>(['tasks', filter]);
      qc.setQueryData(['tasks', filter], (old: any) => ({
        ...old, results: (old?.results ?? []).map((t: Task) => t.id === id ? { ...t, status: 'done' } : t),
      }));
      return { prev };
    },
    onError: (_err, _id, ctx) => { if (ctx?.prev) qc.setQueryData(['tasks', filter], ctx.prev); toast.error('Ошибка'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Задача выполнена'); },
  });

  useEffect(() => {
    if (!taskRequest.nonce) return;
    const detail = taskRequest.payload ?? {};
    setDrawerOpen(true);
    reset({ priority: 'medium', title: detail.title ?? '' });
    if (detail.customerId) setValue('customer_id', detail.customerId);
  }, [taskRequest, reset, setValue]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && drawerOpen) {
        e.preventDefault(); handleSubmit(d => createMutation.mutate(d))();
      }
    };
    return addDocumentListener('keydown', h);
  }, [drawerOpen, handleSubmit, createMutation]);

  return (
    <div className={s.page}>
      <PageHeader
        title="Задачи"
        subtitle={isLoading ? undefined : `${tasks.length} задач`}
        actions={<Button icon={<Plus size={15} />} size="sm" onClick={() => setDrawerOpen(true)}>Новая задача</Button>}
      />

      {!isMobile && (
        <div className={s.statsStrip}>
          {overdueCount > 0 && <div className={`${s.statPill} ${s.danger}`}><AlertCircle size={12} />Просрочено: {overdueCount}</div>}
          {todayCount   > 0 && <div className={`${s.statPill} ${s.warning}`}><Clock size={12} />Сегодня: {todayCount}</div>}
          {doneCount    > 0 && <div className={`${s.statPill} ${s.success}`}><CheckCircle2 size={12} />Выполнено: {doneCount}</div>}
        </div>
      )}

      <div className={s.filterBar}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`${s.filterTab} ${filter === f.key ? s.active : ''}`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className={s.taskList}>
          {[1,2,3,4].map(i => (
            <div key={i} className={s.taskItem}>
              <div className={s.skeletonCheck} />
              <div className={s.taskBody}>
                <div className={s.skeletonTitle} />
                <div className={s.skeletonMeta} />
              </div>
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className={s.emptyStateWrap}>
          <EmptyState
            icon={<CheckSquare size={22} />}
            title="Задач нет"
            subtitle={
              filter === 'overdue' ? 'Просроченных задач нет' :
              filter === 'due_today' ? 'На сегодня задач нет' :
              'Создайте первую задачу'
            }
            action={{ label: 'Создать задачу', onClick: () => setDrawerOpen(true) }}
          />
          {(filter === 'overdue' || filter === 'due_today' || filter === 'mine') && (
            <div className={s.emptyRecoveryRail}>
              <button className={s.emptyRecoveryBtn} onClick={() => setFilter('')}>Показать все задачи</button>
              <button className={s.emptyRecoveryBtn} onClick={() => openAssistantPrompt('Какой следующий шаг по задачам сегодня?')}>Спросить Copilot</button>
            </div>
          )}
        </div>
      ) : (
        <motion.div className={s.taskList} variants={listContainer} initial="hidden" animate="visible">
          <AnimatePresence>
            {tasks.map(task => {
              const isDone  = task.status === 'done';
              const dueDate = task.due_at ? new Date(task.due_at) : null;
              const isOver  = dueDate && isPast(dueDate) && !isDone;
              const isDueT  = dueDate && isToday(dueDate) && !isDone;
              const pb      = PRIORITY_BADGE[task.priority];
              return (
                <motion.div
                  key={task.id}
                  variants={listItem}
                  exit={{ opacity: 0, height: 0 }}
                  className={[s.taskItem, isDone && s.done, isOver && s.overdue, isDueT && s.dueToday].filter(Boolean).join(' ')}
                >
                  <button
                    className={`${s.checkBtn} ${isDone ? s.checked : ''}`}
                    onClick={() => !isDone && completeMutation.mutate(task.id)}
                    disabled={isDone}
                    aria-label={isDone ? 'Выполнено' : 'Отметить выполненным'}
                  >
                    {isDone ? <CheckCircle2 size={18} /> : <CheckSquare size={18} />}
                  </button>

                  <div className={s.taskBody}>
                    <div className={`${s.taskTitle} ${isDone ? s.done : ''}`}>{task.title}</div>
                    <div className={s.taskMeta}>
                      <Badge bg={pb.bg} color={pb.color}>
                        <span className={`${s.priorityDot} ${s[task.priority]}`} />
                        {PRIORITY_LABEL[task.priority]}
                      </Badge>
                      {task.customer && (
                        <span className={s.metaChip}><User size={10} />{task.customer.full_name}</span>
                      )}
                      {dueDate && (
                        <span className={`${s.metaChip} ${isOver ? s.overdue : isDueT ? s.dueToday : ''}`}>
                          {isOver ? <AlertCircle size={10} /> : <Clock size={10} />}
                          {format(dueDate, 'd MMM', { locale: getDateLocale() })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={s.taskActions}>
                    <button className={`${s.actionBtn} ${s.danger}`} onClick={() => toast.info('Удаление задачи')} aria-label="Удалить">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); reset(); }}
        title="Новая задача"
        footer={
          <div className={s.drawerFooter}>
            <Button variant="secondary" onClick={() => { setDrawerOpen(false); reset(); }}>Отмена</Button>
            <Button loading={isSubmitting || createMutation.isPending} onClick={handleSubmit(d => createMutation.mutate(d))}>
              Создать <kbd className={s.shortcutKey}>⌘S</kbd>
            </Button>
          </div>
        }
      >
        <form className={s.form} onSubmit={e => e.preventDefault()}>
          <div className={s.field}>
            <label className={s.fieldLabel}>Заголовок *</label>
            <input {...register('title', { required: true })} placeholder="Что нужно сделать?" className="kort-input" autoFocus />
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel}>Описание</label>
            <textarea {...register('description')} placeholder="Детали задачи..." className={`kort-textarea ${s.textarea}`} />
          </div>
          <div className={s.fieldRow}>
            <div className={s.field}>
              <label className={s.fieldLabel}>Приоритет</label>
              <select {...register('priority')} className="kort-input">
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
              </select>
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Срок выполнения</label>
              <input type="datetime-local" {...register('due_at')} className="kort-input" />
            </div>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
