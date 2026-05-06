/**
 * features/workspace/widgets/chapan/spa/ChapanSPA.tsx
 *
 * Цеховой SPA — зона ответственности швей и мастеров.
 * Показывает только производственную очередь (канбан заданий).
 * Менеджерские разделы (заявки, заказы, настройки) вынесены
 * в отдельную плитку «Заявки» (RequestsSPA).
 */
import { useEffect, useMemo } from 'react';
import { AlertTriangle, ArrowLeft, Factory, RefreshCw } from 'lucide-react';
import { useChapanStore } from '../../../../chapan-spa/model/chapan.store';
import { ProductionQueue } from '../../../../chapan-spa/components/production/ProductionQueue';
import s from './ChapanSPA.module.css';

interface Props {
  tileId: string;
  title: string;
  onBack: () => void;
}

export function ChapanSPA({ tileId: _tileId, title, onBack }: Props) {
  const { loading, load, orders } = useChapanStore();

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const active = orders.filter(
      (o) => o.status !== 'cancelled' && o.status !== 'completed',
    );
    const tasks = active.flatMap((o) => o.productionTasks);
    return {
      inFlow:  tasks.filter((t) => t.status !== 'pending' && t.status !== 'done').length,
      blocked: tasks.filter((t) => t.isBlocked).length,
      done:    tasks.filter((t) => t.status === 'done').length,
    };
  }, [orders]);

  if (loading) {
    return (
      <div className={s.loading}>
        <RefreshCw size={20} className={s.spin} />
        <span>Загружаю задачи цеха...</span>
      </div>
    );
  }

  return (
    <div className={s.root}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className={s.topBar}>
        <div className={s.headMain}>
          <button className={s.backBtn} onClick={onBack}>
            <ArrowLeft size={15} />
            <span>К производствам</span>
          </button>
          <h1 className={s.title}>{title}</h1>
        </div>

        {/* Compact status pills — no dashboard tiles */}
        <div className={s.actionRow}>
          <span className={s.statPill}>
            <Factory size={13} />
            <strong>{stats.inFlow}</strong>
            <span>в работе</span>
          </span>
          {stats.blocked > 0 && (
            <span className={s.statPill} data-tone="warning">
              <AlertTriangle size={13} />
              <strong>{stats.blocked}</strong>
              <span>блокировок</span>
            </span>
          )}
          <span className={s.statPill} data-tone="success">
            <strong>{stats.done}</strong>
            <span>готово</span>
          </span>
        </div>
      </div>

      {/* ── Production kanban ────────────────────────────────── */}
      <div className={s.content}>
        <ProductionQueue mode="manager" />
      </div>
    </div>
  );
}
