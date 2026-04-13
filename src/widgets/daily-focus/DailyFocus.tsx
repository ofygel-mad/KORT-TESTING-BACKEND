import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import s from './DailyFocus.module.css';

export function DailyFocus() {
  const { data, isLoading } = useQuery({ queryKey: ['daily-focus'], queryFn: () => api.get<any>('/reports/daily-focus') });
  if (isLoading || !data?.start_day) return null;
  return (
    <section className={s.card}>
      <div className={s.eyebrow}>Start day</div>
      <div className={s.title}>Что требует внимания сейчас</div>
      <div className={s.grid}>
        <div className={s.metric}><div className={s.value}>{data.start_day.overdue_tasks}</div><small className={s.label}>Просрочено</small></div>
        <div className={s.metric}><div className={s.value}>{data.start_day.tasks_due_today}</div><small className={s.label}>На сегодня</small></div>
        <div className={s.metric}><div className={s.value}>{data.start_day.deals_without_touch}</div><small className={s.label}>Сделки без касания</small></div>
      </div>
    </section>
  );
}
