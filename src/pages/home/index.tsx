import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Users, Target, CheckSquare } from 'lucide-react';
import { api } from '../../shared/api/client';
import s from './Home.module.css';

const MOCK_KPIS = [
  {
    label: 'Выручка',
    value: '₸ 14.8М',
    delta: '+18%',
    direction: 'up' as const,
    color: '#2E6AB5',
    icon: TrendingUp,
  },
  {
    label: 'Сделки',
    value: '47',
    delta: '+6',
    direction: 'up' as const,
    color: '#4A8BD4',
    icon: Target,
  },
  {
    label: 'Клиенты',
    value: '284',
    delta: '+12',
    direction: 'up' as const,
    color: '#5C8DFF',
    icon: Users,
  },
  {
    label: 'Задачи',
    value: '23',
    delta: '-4',
    direction: 'down' as const,
    color: '#EF4444',
    icon: CheckSquare,
  },
];

const MOCK_DEALS = [
  {
    id: 1,
    name: 'ТОО «Алатау Групп»',
    stage: 'Переговоры',
    amount: '₸ 1.4М',
    status: 'prog',
  },
  {
    id: 2,
    name: 'ИП Серикбаев М.',
    stage: 'Новый лид',
    amount: '₸ 280К',
    status: 'new',
  },
  {
    id: 3,
    name: 'АО «Казцемент»',
    stage: 'Сделка закрыта',
    amount: '₸ 8.2М',
    status: 'won',
  },
  {
    id: 4,
    name: 'ТОО «СтройМаш»',
    stage: 'Коммерческое предложение',
    amount: '₸ 560К',
    status: 'prog',
  },
  {
    id: 5,
    name: 'ИП Джаксыбеков',
    stage: 'Отказ',
    amount: '₸ 120К',
    status: 'lost',
  },
];

const MOCK_ACTIVITY = [
  {
    color: '#5C8DFF',
    text: 'Новый лид добавлен — ТОО «Строй Плюс»',
    time: '3 мин назад',
  },
  {
    color: '#10B981',
    text: 'Сделка закрыта — АО «Казцемент» на ₸8.2М',
    time: '42 мин назад',
  },
  {
    color: '#F59E0B',
    text: 'Задача просрочена — Коммерческое предложение СтройМаш',
    time: '1 ч назад',
  },
  {
    color: '#4A8BD4',
    text: 'Поступление на склад — 240 позиций из Алматы',
    time: '2 ч назад',
  },
  {
    color: '#8A9AB8',
    text: 'Новый сотрудник добавлен — Нурлан Оспанов',
    time: '3 ч назад',
  },
];

const STATUS_CLASS: Record<string, string> = {
  new: s.badgeNew,
  prog: s.badgeProg,
  won: s.badgeWon,
  lost: s.badgeLost,
};

const STATUS_LABEL: Record<string, string> = {
  new: 'Новый',
  prog: 'В работе',
  won: 'Закрыт',
  lost: 'Отказ',
};

export default function HomePage() {
  return (
    <div className={s.page}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className={s.header}>
        <div>
          <h1 className={s.title}>Добро пожаловать</h1>
          <p className={s.subtitle}>
            {new Date().toLocaleDateString('ru-RU', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })} · KORT готов к работе
          </p>
        </div>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────── */}
      <div className={s.kpiRow}>
        {MOCK_KPIS.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className={s.kpiCard} style={{ '--kc': kpi.color } as React.CSSProperties}>
              <div className={s.kpiLabel}>
                {kpi.label}
                <Icon size={15} className={s.kpiIcon} />
              </div>
              <div className={s.kpiValue}>{kpi.value}</div>
              <div className={`${s.kpiDelta} ${s[kpi.direction]}`}>
                {kpi.direction === 'up' ? (
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                ) : (
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                )}
                {kpi.delta} за месяц
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Content Grid ────────────────────────────────────────────── */}
      <div className={s.grid}>
        {/* ── Deals Table ──────────────────────────────────────────── */}
        <div className={s.card}>
          <div className={s.cardHeader}>
            <span className={s.cardTitle}>Активные сделки</span>
            <button className={s.cardAction}>Все сделки →</button>
          </div>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Этап</th>
                <th>Сумма</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_DEALS.map((deal) => (
                <tr key={deal.id}>
                  <td>
                    <span className={s.dealName}>{deal.name}</span>
                  </td>
                  <td>{deal.stage}</td>
                  <td className={s.amount}>{deal.amount}</td>
                  <td>
                    <span className={`${s.badge} ${STATUS_CLASS[deal.status]}`}>
                      {STATUS_LABEL[deal.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Activity Feed ────────────────────────────────────────── */}
        <div className={s.card}>
          <div className={s.cardHeader}>
            <span className={s.cardTitle}>Лента событий</span>
            <button className={s.cardAction}>Все →</button>
          </div>
          <div className={s.activityList}>
            {MOCK_ACTIVITY.map((item, i) => (
              <div key={i} className={s.activityItem}>
                <div className={s.activityDot} style={{ background: item.color }} />
                <div className={s.activityBody}>
                  <div className={s.activityText}>{item.text}</div>
                  <div className={s.activityTime}>{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
