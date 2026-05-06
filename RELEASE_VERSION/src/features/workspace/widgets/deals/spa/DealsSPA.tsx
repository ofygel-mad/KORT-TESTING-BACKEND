/**
 * Deals SPA — compact workspace view for stalled deal monitoring.
 */
import { useState } from 'react';
import {
  CircleDollarSign,
  Clock3,
  LayoutGrid,
  LayoutList,
  Plus,
  Search,
  TrendingUp,
} from 'lucide-react';
import type { WorkspaceSnapshot } from '../../../model/types';
import s from './DealsSPA.module.css';

type Tone = 'accent' | 'info' | 'warning' | 'success' | 'danger' | 'muted';

const STAGES = [
  { label: 'Первый контакт', tone: 'info' as Tone, hint: 'Нужен быстрый первый ответ' },
  { label: 'Переговоры', tone: 'accent' as Tone, hint: 'Важно удержать темп общения' },
  { label: 'Предложение', tone: 'warning' as Tone, hint: 'Нужен следующий шаг по КП' },
  { label: 'Закрытие', tone: 'success' as Tone, hint: 'Финальный дожим и оплата' },
] as const;

const STAGE_META = Object.fromEntries(STAGES.map((stage) => [stage.label, stage])) as Record<string, typeof STAGES[number]>;

interface Props {
  snapshot?: WorkspaceSnapshot;
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'KZT',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtCompactMoney(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₸`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}к ₸`;
  return fmtMoney(n);
}

function getSilenceLabel(daysSilent: number | null) {
  if (!daysSilent || daysSilent <= 0) return 'Свежий контакт';
  if (daysSilent === 1) return '1 день тишины';
  if (daysSilent < 5) return `${daysSilent} дня тишины`;
  return `${daysSilent} дней тишины`;
}

export function DealsSPA({ snapshot }: Props) {
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [query, setQuery] = useState('');
  const deals = snapshot?.stalledDeals ?? [];
  const filtered = deals.filter((deal) =>
    deal.title.toLowerCase().includes(query.toLowerCase()) ||
    deal.customerName?.toLowerCase().includes(query.toLowerCase()),
  );
  const totalAmount = filtered.reduce((sum, deal) => sum + (deal.amount || 0), 0);
  const stalledHard = filtered.filter((deal) => (deal.daysSilent ?? 0) >= 7).length;

  return (
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.intro}>
          <span className={s.eyebrow}>
            <TrendingUp size={12} />
            Контроль сделок
          </span>
          <div className={s.titleRow}>
            <div className={s.title}>Застрявшие сделки под рукой</div>
            <div className={s.subtitle}>
              Виджет собирает проблемные касания и помогает быстро понять, где нужен следующий шаг.
            </div>
          </div>
        </div>

        <div className={s.metrics}>
          <div className={s.metric} data-tone="accent">
            <span className={s.metricLabel}>В работе</span>
            <span className={s.metricValue}>{filtered.length}</span>
          </div>
          <div className={s.metric} data-tone="success">
            <span className={s.metricLabel}>Сумма</span>
            <span className={s.metricValue}>{fmtCompactMoney(totalAmount)}</span>
          </div>
          <div className={s.metric} data-tone={stalledHard > 0 ? 'danger' : 'info'}>
            <span className={s.metricLabel}>Риск</span>
            <span className={s.metricValue}>{stalledHard > 0 ? `${stalledHard} замерли` : 'Темп в норме'}</span>
          </div>
        </div>
      </div>

      <div className={s.toolbar}>
        <label className={s.searchField}>
          <Search size={14} className={s.searchIcon} />
          <input
            className={s.search}
            placeholder="Поиск по сделке или клиенту"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <div className={s.viewToggle}>
          {(['list', 'kanban'] as const).map((mode) => (
            <button
              key={mode}
              className={`${s.viewBtn} ${view === mode ? s.viewBtnActive : ''}`}
              onClick={() => setView(mode)}
            >
              {mode === 'list' ? <LayoutList size={13} /> : <LayoutGrid size={13} />}
              {mode === 'list' ? 'Список' : 'Канбан'}
            </button>
          ))}
        </div>

        <button className={s.addBtn}>
          <Plus size={14} />
          Новая сделка
        </button>
      </div>

      {view === 'list' ? (
        <div className={s.listWrap}>
          <div className={s.listHead}>
            <span>Сделка</span>
            <span>Этап</span>
            <span>Тишина</span>
            <span>Сумма</span>
          </div>

          {filtered.length === 0 ? (
            <div className={s.emptyState}>
              <div className={s.emptyIcon}>
                <CircleDollarSign size={22} />
              </div>
              <div className={s.emptyTitle}>{query ? 'По запросу ничего нет' : 'Пока нет сделок в виджете'}</div>
              <div className={s.emptyText}>
                {query
                  ? 'Сбросьте фильтр или попробуйте другой запрос, чтобы вернуть сделки в поле зрения.'
                  : 'Откройте CRM-модуль и обновите данные, чтобы сюда подтянулись stalled deals.'}
              </div>
            </div>
          ) : filtered.map((deal) => {
            const stageMeta = STAGE_META[deal.stage] ?? {
              label: deal.stage,
              tone: 'muted' as Tone,
              hint: 'Проверьте стадию в CRM',
            };

            return (
              <div key={deal.id} className={s.listRow}>
                <div className={s.listMain}>
                  <div className={s.dealTitle}>{deal.title}</div>
                  <div className={s.dealCustomer}>{deal.customerName || 'Клиент не указан'}</div>
                </div>

                <span className={s.stageBadge} data-tone={stageMeta.tone}>
                  <span className={s.stageDot} />
                  {stageMeta.label}
                </span>

                <span className={s.silenceBadge} data-tone={(deal.daysSilent ?? 0) >= 7 ? 'danger' : 'warning'}>
                  <Clock3 size={12} />
                  {getSilenceLabel(deal.daysSilent)}
                </span>

                <span className={s.dealAmount}>{fmtMoney(deal.amount)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={s.kanban}>
          {STAGES.map((stage) => {
            const stageDeals = filtered.filter((deal) => deal.stage === stage.label);

            return (
              <div key={stage.label} className={s.kanbanCol} data-tone={stage.tone}>
                <div className={s.kanbanColHeader}>
                  <span className={s.kanbanColDot} />
                  <span className={s.kanbanColTitle}>{stage.label}</span>
                  <span className={s.kanbanColCount}>{stageDeals.length}</span>
                </div>

                <div className={s.kanbanCards}>
                  {stageDeals.length === 0 ? (
                    <div className={s.kanbanEmpty}>
                      <div className={s.kanbanEmptyTitle}>Пусто</div>
                      <div className={s.kanbanEmptyText}>{stage.hint}</div>
                    </div>
                  ) : stageDeals.map((deal) => (
                    <div key={deal.id} className={s.kanbanCard}>
                      <div className={s.kanbanCardTitle}>{deal.title}</div>
                      <div className={s.kanbanCardMeta}>{deal.customerName || 'Без клиента'}</div>
                      <div className={s.kanbanCardFooter}>
                        <span className={s.kanbanCardAmount}>{fmtCompactMoney(deal.amount)}</span>
                        {deal.daysSilent !== null && (
                          <span className={s.kanbanHint}>{deal.daysSilent}д тишины</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
