import { useEffect } from 'react';
import { useLeadsStore } from '../../../../leads-spa/model/leads.store';
import { useDealsStore } from '../../../../deals-spa/model/deals.store';
import type { WorkspaceSnapshot } from '../../../model/types';
import s from './ReportsSPA.module.css';

type Tone = 'accent' | 'info' | 'warning' | 'success' | 'danger' | 'muted';

function fmtNum(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n));
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₸`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}к ₸`;
  return `${fmtNum(n)} ₸`;
}

function timeSince(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(delta / 3_600_000);

  if (hours < 1) return `${Math.max(1, Math.floor(delta / 60_000))} мин назад`;
  if (hours < 24) return `${hours}ч назад`;
  return `${Math.floor(hours / 24)}д назад`;
}

const LEAD_STAGES = [
  { id: 'new', label: 'Новые', tone: 'info' as Tone },
  { id: 'in_progress', label: 'В работе', tone: 'accent' as Tone },
  { id: 'no_answer', label: 'Недозвон', tone: 'warning' as Tone },
  { id: 'thinking', label: 'Думают', tone: 'accent' as Tone },
  { id: 'meeting_set', label: 'Встреча', tone: 'success' as Tone },
] as const;

const DEAL_STAGES = [
  { id: 'awaiting_meeting', label: 'Ожидает встречи', tone: 'info' as Tone },
  { id: 'meeting_done', label: 'Встреча', tone: 'accent' as Tone },
  { id: 'proposal', label: 'КП', tone: 'warning' as Tone },
  { id: 'contract', label: 'Договор', tone: 'accent' as Tone },
  { id: 'awaiting_payment', label: 'Оплата', tone: 'warning' as Tone },
] as const;

const STAGE_META: Record<string, { label: string; tone: Tone }> = {
  new: { label: 'Новые', tone: 'info' },
  in_progress: { label: 'В работе', tone: 'accent' },
  no_answer: { label: 'Недозвон', tone: 'warning' },
  thinking: { label: 'Думают', tone: 'accent' },
  meeting_set: { label: 'Встреча', tone: 'success' },
  awaiting_meeting: { label: 'Ожидает встречи', tone: 'info' },
  meeting_done: { label: 'Встреча', tone: 'success' },
  proposal: { label: 'КП', tone: 'warning' },
  contract: { label: 'Договор', tone: 'accent' },
  awaiting_payment: { label: 'Оплата', tone: 'warning' },
  won: { label: 'Успешно', tone: 'success' },
  lost: { label: 'Слив', tone: 'danger' },
  junk: { label: 'Брак', tone: 'muted' },
};

const SOURCE_SHORT: Record<string, string> = {
  instagram: 'IG',
  site: 'WEB',
  referral: 'REF',
  ad: 'ADS',
};

interface Props {
  snapshot?: WorkspaceSnapshot;
}

export function ReportsSPA(_: Props) {
  const { leads, loading: leadsLoading, load: loadLeads } = useLeadsStore();
  const { deals, loading: dealsLoading, load: loadDeals } = useDealsStore();

  useEffect(() => {
    if (leads.length === 0 && !leadsLoading) {
      loadLeads();
    }
  }, [leads.length, leadsLoading, loadLeads]);

  useEffect(() => {
    if (deals.length === 0 && !dealsLoading) {
      loadDeals();
    }
  }, [deals.length, dealsLoading, loadDeals]);

  const qualifierLeads = leads.filter((lead) => lead.pipeline === 'qualifier');
  const closerLeads = leads.filter((lead) => lead.pipeline === 'closer');
  const overdue = leads.filter(
    (lead) => (Date.now() - new Date(lead.updatedAt).getTime()) / 3_600_000 > 24,
  ).length;

  const activeDeals = deals.filter((deal) => deal.stage !== 'won' && deal.stage !== 'lost');
  const wonDeals = deals.filter((deal) => deal.stage === 'won');
  const weighted = activeDeals.reduce((sum, deal) => sum + deal.value * (deal.probability / 100), 0);
  const pipeline = activeDeals.reduce((sum, deal) => sum + deal.value, 0);
  const convRate = leads.length > 0 ? Math.round((closerLeads.length / leads.length) * 100) : 0;

  const leadFunnel = LEAD_STAGES.map((stage) => ({
    ...stage,
    count: qualifierLeads.filter((lead) => lead.stage === stage.id).length,
  }));
  const leadMax = Math.max(...leadFunnel.map((stage) => stage.count), 1);

  const dealFunnel = DEAL_STAGES.map((stage) => ({
    ...stage,
    count: activeDeals.filter((deal) => deal.stage === stage.id).length,
    weighted: activeDeals
      .filter((deal) => deal.stage === stage.id)
      .reduce((sum, deal) => sum + deal.value * (deal.probability / 100), 0),
  }));
  const dealMax = Math.max(...dealFunnel.map((stage) => stage.count), 1);

  const recent = [...leads]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);

  return (
    <div className={s.root}>
      <div className={s.pulse}>
        <div className={s.kpi} data-tone="accent">
          <div className={s.kpiVal}>{fmtNum(qualifierLeads.length)}</div>
          <div className={s.kpiLbl}>Лидов в работе</div>
          {overdue > 0 ? (
            <div className={s.kpiAlert}>{overdue} просрочено</div>
          ) : (
            <div className={s.kpiNote}>Ритм без критических хвостов</div>
          )}
        </div>
        <div className={s.kpiSep} />

        <div className={s.kpi} data-tone="info">
          <div className={s.kpiVal}>{fmtNum(activeDeals.length)}</div>
          <div className={s.kpiLbl}>Активных сделок</div>
          <div className={s.kpiNote}>{wonDeals.length} закрыто</div>
        </div>
        <div className={s.kpiSep} />

        <div className={s.kpi} data-tone="success">
          <div className={s.kpiVal}>{fmtMoney(weighted)}</div>
          <div className={s.kpiLbl}>Взвешено</div>
          <div className={s.kpiNote}>{fmtMoney(pipeline)} общая</div>
        </div>
        <div className={s.kpiSep} />

        <div className={s.kpi} data-tone={convRate >= 30 ? 'success' : 'warning'}>
          <div className={s.kpiVal}>{convRate}%</div>
          <div className={s.kpiLbl}>Конверсия</div>
          <div className={s.kpiNote}>{closerLeads.length} / {leads.length}</div>
        </div>
      </div>

      <div className={s.body}>
        <div className={s.panel}>
          <div className={s.panelTitle}>Воронка лидов</div>
          <div className={s.bars}>
            {leadFunnel.map((stage) => (
              <div key={stage.id} className={s.barRow} data-tone={stage.tone}>
                <div className={s.barLabel}>{stage.label}</div>
                <div className={s.barTrack}>
                  <div
                    className={s.barFill}
                    style={{ width: `${(stage.count / leadMax) * 100}%` }}
                  />
                </div>
                <div className={s.barNum}>{stage.count}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={s.panel}>
          <div className={s.panelTitle}>Пайплайн сделок</div>
          <div className={s.bars}>
            {dealFunnel.map((stage) => (
              <div key={stage.id} className={s.barRow} data-tone={stage.tone}>
                <div className={s.pipeLabel}>
                  <span className={s.pipeDot} />
                  {stage.label}
                </div>
                <div className={s.barTrack}>
                  <div
                    className={s.barFill}
                    style={{ width: `${(stage.count / dealMax) * 100}%` }}
                  />
                </div>
                <div className={s.barNum}>{stage.count}</div>
                {stage.weighted > 0 && <div className={s.barVal}>{fmtMoney(stage.weighted)}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={s.feed}>
        <div className={s.feedTitle}>Последняя активность</div>
        <div className={s.feedList}>
          {recent.length === 0 ? (
            <div className={s.feedEmpty}>Нет данных. Откройте SPA «Лиды», чтобы подтянуть ленту.</div>
          ) : (
            recent.map((lead) => {
              const stageMeta = STAGE_META[lead.stage] ?? { label: lead.stage, tone: 'muted' as Tone };
              return (
                <div key={lead.id} className={s.feedItem}>
                  <div className={s.feedAv}>{lead.fullName[0]}</div>
                  <div className={s.feedBody}>
                    <span className={s.feedName}>{lead.fullName}</span>
                    <span className={s.feedStage} data-tone={stageMeta.tone}>
                      {stageMeta.label}
                    </span>
                  </div>
                  <div className={s.feedMeta}>
                    <span className={s.feedSrc}>{SOURCE_SHORT[lead.source] ?? lead.source}</span>
                    <span className={s.feedTime}>{timeSince(lead.updatedAt)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
