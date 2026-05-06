import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { Lock, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { WORKSPACE_WIDGETS } from '../registry';
import { usePlan, planIncludes, PLAN_LABELS } from '../../../shared/hooks/usePlan';
import { useRole } from '../../../shared/hooks/useRole';
import { useEmployeePermissions } from '../../../shared/hooks/useEmployeePermissions';
import { useChapanPermissions } from '../../../shared/hooks/useChapanPermissions';
import type { WorkspaceWidgetKind } from '../model/types';
import type { ShortcutNavItemId } from '../../../shared/navigation/appNavigation';
import styles from './Workspace.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (kind: WorkspaceWidgetKind) => void;
}

function useCanAddWidget(id: ShortcutNavItemId): boolean {
  const { isOwner, isAdmin } = useRole();
  const perms = useEmployeePermissions();
  const chapan = useChapanPermissions();

  if (isOwner || isAdmin) return true;
  if (perms.permissions.length === 0) return true;

  switch (id) {
    case 'leads': case 'deals': case 'customers': case 'tasks':
      return perms.canAccessSales;
    case 'warehouse': return perms.canAccessWarehouse;
    case 'production': return perms.canAccessProduction;
    case 'finance': case 'reports': case 'documents':
      return perms.canAccessFinancial;
    case 'employees': return perms.canManageTeam;
    case 'chapan': return chapan.hasAnyAccess;
    default: return true;
  }
}

export function WorkspaceAddMenu({ open, onClose, onSelect }: Props) {
  const plan = usePlan();
  const { isOwner, isAdmin } = useRole();
  const perms = useEmployeePermissions();
  const chapan = useChapanPermissions();
  const hasEmployeePerms = perms.permissions.length > 0 && !isOwner && !isAdmin;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const content = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="menu-overlay"
            className={styles.menuOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            key="menu-panel"
            className={styles.menuPanel}
            role="dialog"
            aria-modal="true"
            aria-label="Добавить ярлык"
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.93 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.75 }}
          >
            <div className={styles.menuHeader}>
              <div className={styles.menuHeaderLeft}>
                <span className={styles.menuEyebrow}>Навигация</span>
                <h2 className={styles.menuTitle}>Добавить ярлык</h2>
              </div>
              <button className={styles.menuClose} onClick={onClose} aria-label="Закрыть">
                <X size={15} />
              </button>
            </div>

            <div className={styles.menuDivider} />

            <div className={styles.menuGrid}>
              {WORKSPACE_WIDGETS.filter((widget) => {
                // Если у сотрудника есть employee_permissions — скрываем недоступные разделы
                if (!hasEmployeePerms) return true;
                switch (widget.kind) {
                  case 'leads': case 'deals': case 'customers': case 'tasks':
                    return perms.canAccessSales;
                  case 'warehouse': return perms.canAccessWarehouse;
                  case 'production': return perms.canAccessProduction;
                  case 'finance': case 'reports': case 'documents':
                    return perms.canAccessFinancial;
                  case 'employees': return perms.canManageTeam;
                  case 'chapan': return chapan.hasAnyAccess;
                  default: return true;
                }
              }).map((widget) => {
                const Icon = widget.icon;
                const isLocked = !planIncludes(plan, widget.planTier);
                return (
                  <motion.button
                    key={widget.kind}
                    className={`${styles.menuCard} ${isLocked ? styles.menuCardLocked : ''}`}
                    onClick={() => {
                      if (isLocked) {
                        toast.info(`Требуется план «${PLAN_LABELS[widget.planTier]}»`);
                        return;
                      }
                      onSelect(widget.kind);
                      onClose();
                    }}
                    whileTap={isLocked ? undefined : { scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 440, damping: 26 }}
                  >
                    <div className={styles.menuCardIconWrap} style={{ color: isLocked ? 'var(--text-quaternary, var(--text-tertiary))' : widget.color }}>
                      <Icon size={18} />
                    </div>
                    <div className={styles.menuCardBody}>
                      <strong className={styles.menuCardTitle}>{widget.title}</strong>
                      <span className={styles.menuCardDesc}>{widget.description}</span>
                    </div>
                    {isLocked ? (
                      <span className={styles.menuCardLockBadge}>
                        <Lock size={10} />
                        {PLAN_LABELS[widget.planTier]}
                      </span>
                    ) : (
                      <span className={styles.menuCardArrow}>›</span>
                    )}
                  </motion.button>
                );
              })}
            </div>

            <p className={styles.menuFooterHint}>
              Выберите раздел, чтобы добавить его ярлык на канвас.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
