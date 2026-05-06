import { useEffect } from 'react';
import { useLeadsStore } from '../../../leads-spa/model/leads.store';
import { useTileLeadsUI } from '../../../leads-spa/model/tile-ui.store';
import s from './LeadsTilePreview.module.css';

type Tone = 'accent' | 'info' | 'warning' | 'success' | 'muted' | 'danger';

const QUALIFIER_COLS = [
  { stage: 'new', label: 'Новые', tone: 'info' as Tone },
  { stage: 'in_progress', label: 'В работе', tone: 'accent' as Tone },
  { stage: 'no_answer', label: 'Недозвон', tone: 'warning' as Tone },
  { stage: 'thinking', label: 'Думают', tone: 'accent' as Tone },
  { stage: 'meeting_set', label: 'Встреча', tone: 'success' as Tone },
];

const STAGE_META: Record<string, { label: string; tone: Tone }> = {
  new: { label: 'Новый', tone: 'info' },
  in_progress: { label: 'В работе', tone: 'accent' },
  no_answer: { label: 'Недозвон', tone: 'warning' },
  thinking: { label: 'Думают', tone: 'accent' },
  meeting_set: { label: 'Встреча', tone: 'success' },
  junk: { label: 'Мусор', tone: 'muted' },
  awaiting_meeting: { label: 'Встреча ждёт', tone: 'success' },
  meeting_done: { label: 'Встреча', tone: 'success' },
  proposal: { label: 'КП', tone: 'warning' },
  contract: { label: 'Договор', tone: 'accent' },
  awaiting_payment: { label: 'Оплата', tone: 'warning' },
  won: { label: 'Закрыт', tone: 'success' },
  lost: { label: 'Отказ', tone: 'danger' },
};

const TAB_LABELS: Record<string, string> = {
  qualifier: 'Квалиф.',
  closer: 'Клоузер',
  all: 'Все',
};

const SOURCE_LABEL: Record<string, string> = {
  instagram: 'IG',
  site: 'WEB',
  referral: 'REF',
  ad: 'ADS',
};

export function LeadsTilePreview({ tileId }: { tileId: string }) {
  const { leads, loading, load } = useLeadsStore();
  const { activeLeadId, drawerOpen, currentTab } = useTileLeadsUI(tileId);
  const activeLead = leads.find((lead) => lead.id === activeLeadId);

  useEffect(() => {
    if (leads.length === 0 && !loading) {
      load();
    }
  }, [leads.length, load, loading]);

  const qualifierLeads = leads.filter((lead) => lead.pipeline === 'qualifier');
  const closerLeads = leads.filter((lead) => lead.pipeline === 'closer');
  const overdueCount = leads.filter(
    (lead) => (Date.now() - new Date(lead.updatedAt).getTime()) / 3_600_000 > 24,
  ).length;

  if (loading && leads.length === 0) {
    return (
      <div className={s.root}>
        <div className={s.shimmer}>
          {QUALIFIER_COLS.slice(0, 3).map((column) => (
            <div key={column.stage} className={s.shimmerCol} data-tone={column.tone}>
              <div className={s.shimmerHdr} />
              <div className={s.shimmerCard} />
              <div className={s.shimmerCard} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (drawerOpen && activeLead) {
    const lastEvent = activeLead.history[activeLead.history.length - 1];
    const stageMeta = STAGE_META[activeLead.stage] ?? { label: activeLead.stage, tone: 'muted' as Tone };

    return (
      <div className={s.root}>
        <div className={s.screenBadge}>
          <span className={s.screenDot} />
          <span className={s.screenLabel}>Карточка лида</span>
        </div>

        <div className={s.drawerPreview}>
          <div className={s.drawerHeader}>
            <div className={s.drawerAvatar}>{activeLead.fullName[0]}</div>
            <div className={s.drawerMeta}>
              <div className={s.drawerName}>{activeLead.fullName}</div>
              <span className={s.drawerStage} data-tone={stageMeta.tone}>
                {stageMeta.label}
              </span>
            </div>
          </div>

          <div className={s.drawerRow}>
            <span className={s.drawerRowLabel}>Тел.</span>
            <span className={s.drawerRowValue}>{activeLead.phone}</span>
          </div>

          <div className={s.drawerRow}>
            <span className={s.drawerRowLabel}>Источник</span>
            <span className={s.drawerRowValue}>{SOURCE_LABEL[activeLead.source] ?? activeLead.source}</span>
          </div>

          {activeLead.budget && (
            <div className={s.drawerRow}>
              <span className={s.drawerRowLabel}>Бюджет</span>
              <span className={`${s.drawerRowValue} ${s.drawerBudget}`}>
                {(activeLead.budget / 1_000).toFixed(0)} 000 ₸
              </span>
            </div>
          )}

          {lastEvent && (
            <div className={s.drawerEvent}>
              <span className={s.drawerEventDot} />
              <span className={s.drawerEventText}>{lastEvent.action}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.tabBar}>
        {(['qualifier', 'closer', 'all'] as const).map((tab) => (
          <span
            key={tab}
            className={`${s.tabPill} ${currentTab === tab ? s.tabPillActive : ''}`}
          >
            {TAB_LABELS[tab]}
          </span>
        ))}
      </div>

      <div className={s.statsBar}>
        <div className={s.statChip} data-tone="accent">
          <span className={s.statDot} />
          <span className={s.statNum}>{qualifierLeads.length}</span>
          <span className={s.statLabel}>лидов</span>
        </div>
        <div className={s.statChip} data-tone="success">
          <span className={s.statDot} />
          <span className={s.statNum}>{closerLeads.length}</span>
          <span className={s.statLabel}>сделок</span>
        </div>
        {overdueCount > 0 && (
          <div className={s.statChip} data-tone="danger">
            <span className={s.statDot} />
            <span className={s.statNum}>{overdueCount}</span>
            <span className={s.statLabel}>просроч.</span>
          </div>
        )}
      </div>

      <div className={s.board}>
        {QUALIFIER_COLS.map((column) => {
          const columnLeads = qualifierLeads.filter((lead) => lead.stage === column.stage);
          return (
            <div key={column.stage} className={s.col} data-tone={column.tone}>
              <div className={s.colHead}>
                <span className={s.colDot} />
                <span className={s.colLabel}>{column.label}</span>
                <span className={s.colCount}>{columnLeads.length}</span>
              </div>

              <div className={s.colCards}>
                {columnLeads.length === 0 ? (
                  <div className={s.colEmpty} />
                ) : (
                  columnLeads.slice(0, 2).map((lead) => (
                    <div
                      key={lead.id}
                      className={`${s.card} ${lead.id === activeLeadId ? s.cardActive : ''}`}
                    >
                      <div className={s.cardAvatar}>{lead.fullName[0]}</div>
                      <div className={s.cardInfo}>
                        <div className={s.cardName}>{lead.fullName.split(' ')[0]}</div>
                        <span className={s.cardSrc}>{SOURCE_LABEL[lead.source] ?? lead.source}</span>
                      </div>
                      {lead.budget && (
                        <span className={s.cardBudget}>
                          {(lead.budget / 1_000).toFixed(0)}к
                        </span>
                      )}
                    </div>
                  ))
                )}

                {columnLeads.length > 2 && (
                  <div className={s.moreChip}>+{columnLeads.length - 2} ещё</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
