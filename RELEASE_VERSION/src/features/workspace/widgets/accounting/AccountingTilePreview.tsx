/**
 * widgets/accounting/AccountingTilePreview.tsx
 * Compact preview shown on the dashboard tile (not SPA mode).
 */

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { accountingApi } from '../../../accounting-spa/api/client';
import s from './AccountingTilePreview.module.css';

function fmt(n: number) {
  if (n >= 1_000_000) return `₸${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `₸${Math.round(n / 1_000)}K`;
  return `₸${Math.round(n)}`;
}

function PctChip({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined) return null;
  const isUp = v >= 0;
  return (
    <span className={isUp ? s.chipUp : s.chipDown}>
      {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {Math.abs(v)}%
    </span>
  );
}

interface Props { tileId?: string }

export function AccountingTilePreview({ tileId: _ }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['accounting-summary-tile'],
    queryFn: () => accountingApi.getSummary(),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <span className={s.title}>Учёт и Аудит</span>
        </div>
        <div className={s.skeletonBlock}>
          {[1, 2, 3].map((i) => <div key={i} className={s.skel} />)}
        </div>
      </div>
    );
  }

  const d = data;

  return (
    <div className={s.root}>
      <div className={s.header}>
        <span className={s.title}>Учёт и Аудит</span>
        {d && <span className={s.period}>{d.period}</span>}
      </div>

      {d && (
        <>
          <div className={s.kpiGrid}>
            <div className={s.kpiRow}>
              <span className={s.kpiLabel}>Выручка</span>
              <span className={`${s.kpiVal} ${s.income}`}>{fmt(d.income)}</span>
              <PctChip v={d.incomePct} />
            </div>
            <div className={s.kpiRow}>
              <span className={s.kpiLabel}>Расходы</span>
              <span className={`${s.kpiVal} ${s.expense}`}>{fmt(d.expense)}</span>
              <PctChip v={d.expensePct} />
            </div>
            <div className={s.kpiRow}>
              <span className={s.kpiLabel}>Прибыль</span>
              <span className={`${s.kpiVal} ${d.profit >= 0 ? s.income : s.expense}`}>
                {d.profit >= 0 ? '+' : ''}{fmt(d.profit)}
              </span>
              <PctChip v={d.profitPct} />
            </div>
          </div>

          <div className={s.footer}>
            {d.totalDebt > 0 && (
              <span className={s.debt}>Долги: {fmt(d.totalDebt)}</span>
            )}
            {d.openGaps > 0 && (
              <span className={s.gaps}>
                <AlertTriangle size={11} />
                {d.openGaps} разрыв{d.openGaps > 1 ? 'а' : ''}
              </span>
            )}
            {d.lastEntry && (
              <span className={s.lastEntry}>
                {new Date(d.lastEntry.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
