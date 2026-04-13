/**
 * DealsTilePreview — live preview surface for the deals workspace tile.
 *
 * Drawer mode: focused deal summary
 * Board mode: compact pipeline snapshot
 */
import { useEffect } from 'react';
import { useDealsStore } from '../../../deals-spa/model/deals.store';
import { useTileDealsUI } from '../../../deals-spa/model/tile-ui.store';
import {
  STAGE_LABEL,
  STAGE_TONE,
  ACTIVITY_TONE,
  ACTIVE_STAGES,
  getDealProbabilityTone,
} from '../../../deals-spa/api/types';
import s from './DealsTilePreview.module.css';

function fmtShort(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'М';
  if (n >= 1_000) return Math.round(n / 1_000) + 'к';
  return String(n);
}

const TAB_LABELS: Record<string, string> = {
  pipeline: 'Пайплайн',
  all: 'Все',
};

export function DealsTilePreview({ tileId }: { tileId: string }) {
  const { deals, loading, load } = useDealsStore();
  const { activeId, drawerOpen, currentTab } = useTileDealsUI(tileId);
  const activeDeal = deals.find(d => d.id === activeId);

  useEffect(() => {
    if (deals.length === 0 && !loading) load();
  }, []);

  const active = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost');
  const won = deals.filter(d => d.stage === 'won');
  const totalWeighted = active.reduce((a, d) => a + d.value * (d.probability / 100), 0);

  if (loading && deals.length === 0) {
    return (
      <div className={s.root}>
        <div className={s.shimmer}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={s.shimCol}>
              <div className={s.shimHdr} />
              <div className={s.shimCard} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (drawerOpen && activeDeal) {
    const stageLabel = STAGE_LABEL[activeDeal.stage] ?? activeDeal.stage;
    const stageTone = STAGE_TONE[activeDeal.stage];
    const lastActivity = activeDeal.activities?.[activeDeal.activities.length - 1];

    return (
      <div className={s.root}>
        <div className={s.screenBadge}>
          <span className={s.screenDot} />
          <span className={s.screenLabel}>Карточка сделки</span>
        </div>

        <div className={s.drawerPreview}>
          <div className={s.drawerHeader}>
            <div className={s.drawerAvatar}>{activeDeal.fullName[0]}</div>
            <div className={s.drawerMeta}>
              <div className={s.drawerName}>{activeDeal.fullName}</div>
              <span className={s.drawerStage} data-tone={stageTone}>
                {stageLabel}
              </span>
            </div>
          </div>

          <div className={s.drawerRow}>
            <span className={s.drawerRowLabel}>Сумма</span>
            <span className={`${s.drawerRowValue} ${s.drawerRowValueAccent}`}>
              {fmtShort(activeDeal.value)} ₸
            </span>
          </div>
          <div className={s.drawerRow}>
            <span className={s.drawerRowLabel}>Вероятность</span>
            <span className={s.drawerRowValue}>{activeDeal.probability}%</span>
          </div>

          <div className={s.probTrack} data-tone={getDealProbabilityTone(activeDeal.probability)}>
            <div className={s.probFill} style={{ width: `${activeDeal.probability}%` }} />
          </div>

          {lastActivity && (
            <div className={s.drawerEvent} data-tone={ACTIVITY_TONE[lastActivity.type]}>
              <span className={s.drawerEventDot} />
              <span className={s.drawerEventText}>{lastActivity.content}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.tabBar}>
        {(['pipeline', 'all'] as const).map(tab => (
          <span
            key={tab}
            className={`${s.tabPill} ${currentTab === tab ? s.tabPillActive : ''}`}
          >
            {TAB_LABELS[tab]}
          </span>
        ))}
      </div>

      <div className={s.statsBar}>
        <div className={s.chip} data-tone="accent">
          <span className={s.chipDot} />
          <span className={s.chipNum}>{active.length}</span>
          <span className={s.chipLabel}>активных</span>
        </div>
        {totalWeighted > 0 && (
          <div className={s.chip} data-tone="success">
            <span className={s.chipDot} />
            <span className={`${s.chipNum} ${s.chipNumAccent}`}>~{fmtShort(totalWeighted)} ₸</span>
            <span className={s.chipLabel}>взвеш.</span>
          </div>
        )}
        {won.length > 0 && (
          <div className={s.chip} data-tone="warning">
            <span className={s.chipDot} />
            <span className={s.chipNum}>{won.length}</span>
            <span className={s.chipLabel}>закрыто</span>
          </div>
        )}
      </div>

      <div className={s.pipeline}>
        {ACTIVE_STAGES.map(stage => {
          const col = active.filter(d => d.stage === stage);
          const colVal = col.reduce((a, d) => a + d.value * (d.probability / 100), 0);
          return (
            <div key={stage} className={s.col} data-tone={STAGE_TONE[stage]}>
              <div className={s.colTop}>
                <span className={s.dot} />
                <span className={s.colLabel}>{STAGE_LABEL[stage]}</span>
                <span className={s.colN}>{col.length}</span>
              </div>
              {colVal > 0 && (
                <div className={s.colVal}>~{fmtShort(colVal)} ₸</div>
              )}
              <div className={s.cards}>
                {col.length === 0 ? (
                  <div className={s.emptyCol} />
                ) : (
                  col.slice(0, 2).map(deal => (
                    <div
                      key={deal.id}
                      className={`${s.card} ${deal.id === activeId ? s.cardActive : ''}`}
                    >
                      <div className={s.cardAv}>{deal.fullName[0]}</div>
                      <div className={s.cardInfo}>
                        <div className={s.cardName}>{deal.fullName.split(' ')[0]}</div>
                        <div className={s.cardAmt}>{fmtShort(deal.value)} ₸</div>
                      </div>
                      <div className={s.miniBar} data-tone={getDealProbabilityTone(deal.probability)}>
                        <div className={s.miniBarFill} style={{ width: `${deal.probability}%` }} />
                      </div>
                    </div>
                  ))
                )}
                {col.length > 2 && (
                  <div className={s.more}>+{col.length - 2}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
