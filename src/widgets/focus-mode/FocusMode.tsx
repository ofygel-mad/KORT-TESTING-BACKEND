import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Play, Pause, RotateCcw, Focus, CheckSquare } from 'lucide-react';
import { useUIStore } from '../../shared/stores/ui';
import { api } from '../../shared/api/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { addDocumentListener } from '../../shared/lib/browser';
import s from './FocusMode.module.css';

/* ── Pomodoro hook ───────────────────────────────────────────── */
const WORK_SEC  = 25 * 60;
const BREAK_SEC = 5 * 60;

function usePomodoro() {
  const [phase,   setPhase]   = useState<'work' | 'break'>('work');
  const [running, setRunning] = useState(false);
  const [left,    setLeft]    = useState(WORK_SEC);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => {
        setLeft(n => {
          if (n <= 1) {
            clearInterval(ref.current!);
            setRunning(false);
            if (phase === 'work') {
              setPhase('break'); setLeft(BREAK_SEC);
              toast.success('Перерыв 5 минут');
            } else {
              setPhase('work'); setLeft(WORK_SEC);
              toast('Пора работать');
            }
            return 0;
          }
          return n - 1;
        });
      }, 1000);
    } else if (ref.current) {
      clearInterval(ref.current);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running, phase]);

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return {
    display: `${mm}:${ss}`,
    running, phase,
    toggle: () => setRunning(r => !r),
    reset:  () => { setRunning(false); setPhase('work'); setLeft(WORK_SEC); },
  };
}

/* ── Task types ──────────────────────────────────────────────── */
interface Task {
  id: string; title: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'done'; due_at: string | null;
}

const PRIORITY_DOT: Record<string, string> = {
  high: 'var(--fill-negative)', medium: 'var(--fill-warning)', low: 'var(--text-tertiary)',
};

/* ── Component ───────────────────────────────────────────────── */
export function FocusMode() {
  const { focusMode, toggleFocusMode } = useUIStore();
  const qc    = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: tasksData } = useQuery<{ results: Task[] }>({
    queryKey: ['tasks', 'focus', today],
    queryFn:  () => api.get('/tasks/', { filter: 'due_today', status: 'open' }),
    enabled:  focusMode,
  });

  const doneMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/tasks/${id}/`, { status: 'done' }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const pomodoro = usePomodoro();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape' && focusMode) toggleFocusMode();
    };
    return addDocumentListener('keydown', onKey);
  }, [focusMode, toggleFocusMode]);

  const list = tasksData?.results ?? [];
  const open = list.filter(t => t.status === 'open');
  const done = list.filter(t => t.status === 'done');

  // Timer color: runtime phase value → inline is correct
  const timerColor = pomodoro.phase === 'work' ? 'var(--fill-accent)' : 'var(--fill-positive)';

  return (
    <AnimatePresence>
      {focusMode && (
        <>
          <motion.div
            key="focus-overlay"
            className={s.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            key="focus-panel"
            className={`${s.panel} ${s.centerOrb}`}
            initial={{ opacity: 0, scale: 0.95, y: 24 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{ opacity: 0,   scale: 0.95, y: 24 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            {/* Header */}
            <div className={s.header}>
              <div className={s.headerLeft}>
                <Focus size={16} className={s.headerIcon} />
                <span className={s.headerTitle}>Режим фокуса</span>
              </div>
              <button className={s.closeBtn} onClick={toggleFocusMode} aria-label="Закрыть">
                <X size={15} />
              </button>
            </div>

            {/* Pomodoro */}
            <div className={s.timerSection}>
              <div className={s.timerDisplay} style={{ '--timer-color': timerColor } as CSSProperties}>
                {pomodoro.display}
              </div>
              <div className={s.timerPhase}>
                {pomodoro.phase === 'work' ? 'Рабочий блок' : 'Перерыв'}
              </div>
              <div className={s.timerControls}>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={pomodoro.toggle}
                  className={s.timerBtnPrimary}
                >
                  {pomodoro.running ? <Pause size={14} /> : <Play size={14} />}
                  {pomodoro.running ? 'Пауза' : 'Старт'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={pomodoro.reset}
                  className={s.timerBtnSecondary}
                  aria-label="Сбросить таймер"
                >
                  <RotateCcw size={13} />
                </motion.button>
              </div>
            </div>

            {/* Tasks */}
            <div className={s.tasksSection}>
              <div className={s.tasksSectionLabel}>
                Задачи на сегодня — {open.length} открыто
              </div>

              {open.length === 0 && (
                <div className={s.tasksEmpty}>
                  <CheckSquare size={28} className={s.tasksEmptyIcon} />
                  <div>Все задачи выполнены</div>
                </div>
              )}

              {open.map(task => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={s.taskRow}
                >
                  {/* Priority color is runtime data → inline */}
                  <span
                    className={s.taskPriorityDot}
                    style={{ '--priority-color': PRIORITY_DOT[task.priority] } as CSSProperties}
                  />
                  <span className={s.taskTitle}>{task.title}</span>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => doneMutation.mutate(task.id)}
                    className={s.taskCompleteBtn}
                    aria-label="Отметить выполненным"
                  >
                    <Check size={15} />
                  </motion.button>
                </motion.div>
              ))}

              {done.length > 0 && (
                <div className={s.doneCount}>Выполнено: {done.length}</div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
