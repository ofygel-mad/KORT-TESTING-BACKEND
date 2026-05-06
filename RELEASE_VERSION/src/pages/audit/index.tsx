import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Shield, Search } from 'lucide-react';
import { api } from '../../shared/api/client';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Skeleton } from '../../shared/ui/Skeleton';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Badge } from '../../shared/ui/Badge';
import { useCapabilities } from '../../shared/hooks/useCapabilities';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { listItem } from '../../shared/motion/presets';
import s from './Audit.module.css';

/* ── Types ──────────────────────────────────────────────────── */
interface AuditEntry {
  id: string; action: string; entity_type: string; entity_id: string;
  entity_label: string; actor_name: string;
  diff: Record<string, [any, any]> | null;
  ip_address: string | null; created_at: string;
}

/* ── Token-aligned badge maps ────────────────────────────────── */
const ACTION_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  create: { bg: 'var(--fill-positive-soft)', color: 'var(--fill-positive-text)', label: 'Создание' },
  update: { bg: 'var(--fill-warning-soft)',  color: 'var(--fill-warning-text)',  label: 'Изменение' },
  delete: { bg: 'var(--fill-negative-soft)', color: 'var(--fill-negative-text)', label: 'Удаление' },
  login:  { bg: 'var(--fill-info-soft)',     color: 'var(--fill-info-text)',     label: 'Вход' },
  export: { bg: 'var(--bg-surface-inset)',   color: 'var(--text-secondary)',     label: 'Экспорт' },
  import: { bg: 'var(--fill-positive-soft)', color: 'var(--fill-positive-text)', label: 'Импорт' },
};

const ENTITY_LABELS: Record<string, string> = {
  customer: 'Клиент', deal: 'Сделка', task: 'Задача',
  user: 'Пользователь', pipeline: 'Воронка', organization: 'Организация',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const TABLE_HEADERS = ['Действие', 'Объект', 'Пользователь', 'IP', 'Время'];

/* ── Page ────────────────────────────────────────────────────── */
export default function AuditPage() {
  useDocumentTitle('Аудит');
  const { can } = useCapabilities();
  const [search, setSearch]           = useState('');
  const [filterAction, setFilterAction] = useState('');

  const { data, isLoading } = useQuery<{ results: AuditEntry[]; count: number }>({
    queryKey: ['audit', search, filterAction],
    queryFn: () => api.get('/audit/', { search, action: filterAction || undefined }),
    enabled: can('audit.read'),
  });

  if (!can('audit.read')) {
    return (
      <div className={s.denied}>
        <EmptyState
          icon={<Shield size={40} />}
          title="Журнал аудита"
          subtitle="Доступно только в промышленном режиме (Industrial). Обновите план для просмотра всех действий."
        />
      </div>
    );
  }

  const entries = data?.results ?? [];

  return (
    <div className={s.page}>
      <PageHeader
        title="Журнал аудита"
        subtitle="История всех действий пользователей системы"
      />

      {/* Filters */}
      <div className={s.filters}>
        <div className={s.searchWrap}>
          <span className={s.searchIcon}><Search size={13} /></span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по объекту, пользователю..."
            className={`kort-input ${s.searchInput}`}
          />
        </div>
        <select
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          className={`kort-input ${s.filterSelect}`}
        >
          <option value="">Все действия</option>
          {Object.entries(ACTION_BADGE).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className={s.tableCard}>
        <div className={s.thead}>
          {TABLE_HEADERS.map(h => <div key={h} className={s.th}>{h}</div>)}
        </div>

        {isLoading
          ? [1,2,3,4,5].map(i => (
              <div key={i} className={s.skeletonRow}>
                <Skeleton height={14} width="80%" />
              </div>
            ))
          : entries.length === 0
            ? <div className={s.emptyStateWrap}><EmptyState title="Записей нет" subtitle="Аудит-лог пуст или не соответствует фильтрам." /></div>
            : entries.map((entry, i) => {
                const ac = ACTION_BADGE[entry.action] ?? { bg: 'var(--bg-surface-inset)', color: 'var(--text-secondary)', label: entry.action };
                return (
                  <motion.div
                    key={entry.id}
                    className={s.row}
                    variants={listItem}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: i * 0.02 }}
                  >
                    <Badge bg={ac.bg} color={ac.color}>{ac.label}</Badge>

                    <div>
                      <div className={s.cellMain}>{entry.entity_label || entry.entity_id}</div>
                      <div className={s.cellSub}>{ENTITY_LABELS[entry.entity_type] ?? entry.entity_type}</div>
                    </div>

                    <div className={s.cellSecondary}>{entry.actor_name}</div>

                    <div className={s.cellMono}>{entry.ip_address ?? '—'}</div>

                    <div className={s.cellTime}>{fmt(entry.created_at)}</div>
                  </motion.div>
                );
              })
        }
      </div>

      {data && (
        <div className={s.tableFooter}>
          Показано {entries.length} из {data.count} записей
        </div>
      )}
    </div>
  );
}
