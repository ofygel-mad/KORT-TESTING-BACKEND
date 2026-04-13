/**
 * ChapanEntry — entry point for the «Производство» tile.
 *
 * Routes:
 *   hub       → ProductionHub  (list of workspaces)
 *   chapan    → WorkshopSPA via ChapanAdapter
 *   template  → ProductionTemplateSPA (3-step wizard)
 *   workspace → WorkshopSPA via WorkshopAdapter (newly created workshops)
 */
import { Lock } from 'lucide-react';
import { WorkshopSPA } from '@/features/production-spa/WorkshopSPA';
import { useChapanAdapter } from '@/features/production-spa/adapter/chapan.adapter';
import { useWorkshopAdapter } from '@/features/production-spa/adapter/workshop.adapter';
import { ProductionHub } from './ProductionHub';
import { ProductionTemplateSPA } from './ProductionTemplateSPA';
import { ProductionWorkspaceShell } from './ProductionWorkspaceShell';
import { useTileProductionShell } from './production-shell.store';
import { canSeeWorkshopConsole, useResolvedChapanRole } from '../../../../chapan-spa/model/rbac.store';
import { WorkshopConsole } from '../../../../chapan-spa/components/workshop/WorkshopConsole';
import s from './ChapanEntry.module.css';

export function ChapanEntry({ tileId }: { tileId: string }) {
  const role = useResolvedChapanRole();
  const { activeWorkspace, goHome, workshopId } = useTileProductionShell(tileId);

  const chapanAdapter = useChapanAdapter();
  const workshopAdapter = useWorkshopAdapter(workshopId ?? '');

  /* ── Hub ───────────────────────────────────────────────── */
  if (activeWorkspace === 'hub') {
    return <ProductionHub tileId={tileId} />;
  }

  /* ── Template wizard ───────────────────────────────────── */
  if (activeWorkspace === 'template') {
    return (
      <ProductionWorkspaceShell title="Новое производство" onBack={goHome} tone="template">
        <ProductionTemplateSPA tileId={tileId} onBack={goHome} />
      </ProductionWorkspaceShell>
    );
  }

  /* ── Newly created workshop ────────────────────────────── */
  if (activeWorkspace === 'workspace' && workshopId) {
    return (
      <WorkshopSPA adapter={workshopAdapter} onBack={goHome} />
    );
  }

  /* ── Chapan production workspace ──────────────────────── */
  if (activeWorkspace === 'chapan') {
    // workshop_lead / worker → personalised WorkshopConsole (Chapan-specific view)
    if (canSeeWorkshopConsole(role)) {
      return (
        <ProductionWorkspaceShell title={chapanAdapter.profile.name} onBack={goHome} tone="live">
          <WorkshopConsole title={chapanAdapter.profile.name} onBack={goHome} />
        </ProductionWorkspaceShell>
      );
    }

    if (role !== 'viewer') {
      // manager → universal WorkshopSPA with ChapanAdapter
      return <WorkshopSPA adapter={chapanAdapter} onBack={goHome} />;
    }
  }

  /* ── Access denied ─────────────────────────────────────── */
  return (
    <ProductionWorkspaceShell title="Производство" onBack={goHome} tone="locked">
      <div className={s.denied}>
        <div className={s.iconWrap}><Lock size={20} /></div>
        <div className={s.title}>Доступ ограничен</div>
        <div className={s.text}>
          Обратитесь к администратору и назначьте роль внутри производственного пространства.
        </div>
      </div>
    </ProductionWorkspaceShell>
  );
}
