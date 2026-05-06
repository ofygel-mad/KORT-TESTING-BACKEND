import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import { sheetVariants, overlayVariants, modalVariants } from '../motion/presets';
import s from './Drawer.module.css';

type DrawerSize = 'sm' | 'md' | 'lg';
/** modal = centered dialog (default); panel = right-side drawer */
type DrawerVariant = 'modal' | 'panel';

interface DrawerProps {
  open:      boolean;
  onClose:   () => void;
  title:     string;
  subtitle?: string;
  children:  ReactNode;
  size?:     DrawerSize;
  footer?:   ReactNode;
  variant?:  DrawerVariant;
  /** @deprecated use size instead */
  width?:    number;
}

const SIZE_WIDTH: Record<DrawerSize, number> = { sm: 480, md: 560, lg: 680 };

export function Drawer({ open, onClose, title, subtitle, children, size = 'md', footer, variant = 'modal', width }: DrawerProps) {
  const isMobile   = useIsMobile();
  const panelWidth = width ?? SIZE_WIDTH[size];

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;

    const body = document.body;
    const currentCount = Number(body.dataset.kortDrawerCount ?? '0');
    const nextCount = currentCount + 1;

    body.dataset.kortDrawerCount = String(nextCount);
    body.dataset.kortDrawerOpen = 'true';

    return () => {
      const remainingCount = Number(body.dataset.kortDrawerCount ?? '1') - 1;

      if (remainingCount > 0) {
        body.dataset.kortDrawerCount = String(remainingCount);
        return;
      }

      delete body.dataset.kortDrawerCount;
      delete body.dataset.kortDrawerOpen;
    };
  }, [open]);

  const titleBlock = (
    <div className={s.titleBlock}>
      <div className={s.title}>{title}</div>
      {subtitle && <div className={s.subtitle}>{subtitle}</div>}
    </div>
  );

  const closeBtn = (
    <button className={s.closeBtn} onClick={onClose} aria-label="Закрыть">
      <X size={16} />
    </button>
  );

  // Mobile: always bottom sheet
  if (isMobile) {
    return (
      <AnimatePresence>
        {open && (
          <>
            <motion.div className={s.overlay} variants={overlayVariants}
              initial="hidden" animate="visible" exit="hidden" onClick={onClose} />
            <motion.div className={s.panelMobile}
              variants={sheetVariants}
              initial="hidden" animate="visible" exit="hidden">
              <div className={s.header}>{titleBlock}{closeBtn}</div>
              <div className={s.body}>{children}</div>
              {footer && <div className={s.footer}>{footer}</div>}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Desktop: centered modal (default)
  if (variant === 'modal') {
    return (
      <AnimatePresence>
        {open && (
          <motion.div
            className={s.overlayModal}
            variants={overlayVariants}
            initial="hidden" animate="visible" exit="hidden"
            onClick={onClose}
          >
            <motion.div
              className={s.panelModal}
              style={{ width: panelWidth }}
              variants={modalVariants}
              initial="hidden" animate="visible" exit="hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className={s.header}>{titleBlock}{closeBtn}</div>
              <div className={s.body}>{children}</div>
              {footer && <div className={s.footer}>{footer}</div>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Desktop: right-side panel (variant="panel")
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className={s.overlay} variants={overlayVariants}
            initial="hidden" animate="visible" exit="hidden" onClick={onClose} />
          <motion.div
            className={s.panel}
            style={{ width: panelWidth }}
            variants={sheetVariants}
            initial="hidden" animate="visible" exit="hidden">
            <div className={s.header}>{titleBlock}{closeBtn}</div>
            <div className={s.body}>{children}</div>
            {footer && <div className={s.footer}>{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
