import { motion, AnimatePresence, useReducedMotion, type PanInfo } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useViewportProfile } from '../hooks/useViewportProfile';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { bottomSheetVariants, overlayVariants } from '../motion/presets';
import { Drawer } from './Drawer';
import s from './BottomSheet.module.css';

export type SheetSnap = 'auto' | 'half' | 'full';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Default ['auto']. 'half' ≈ 56dvh, 'full' ≈ vvh - 24px. */
  snapPoints?: SheetSnap[];
  /** Index into snapPoints. Default 0. */
  initialSnap?: number;
  /** Allow drag-to-dismiss + overlay-tap to close. Default true. */
  dismissible?: boolean;
  /** Show drag handle / grabber. Default true. */
  showGrabber?: boolean;
  /** On desktop (≥768), render as centered Drawer modal. Default true. */
  fallbackToModal?: boolean;
  /** Drop default body padding (lists, full-bleed content). Default false. */
  flushBody?: boolean;
  ariaLabel?: string;
}

const SNAP_CLASS: Record<SheetSnap, string> = {
  auto: s.snapAuto,
  half: s.snapHalf,
  full: s.snapFull,
};

/**
 * iOS-style bottom sheet with drag-to-dismiss, snap points, keyboard awareness.
 * On viewports ≥768px (and when fallbackToModal is true) it delegates to the
 * existing Drawer in modal variant so the desktop UX is unchanged.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  snapPoints = ['auto'],
  initialSnap = 0,
  dismissible = true,
  showGrabber = true,
  fallbackToModal = true,
  flushBody = false,
  ariaLabel,
}: BottomSheetProps) {
  const { isPhone } = useViewportProfile();
  const reduceMotion = useReducedMotion();
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Lock body scroll only when actually rendering as a mobile sheet.
  const lockActive = open && (isPhone || !fallbackToModal);
  useBodyScrollLock(lockActive);

  // Esc-to-close for keyboard users.
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);

  // Desktop fallback — reuse Drawer modal.
  if (!isPhone && fallbackToModal) {
    return (
      <Drawer open={open} onClose={onClose} title={title ?? ''} subtitle={subtitle} footer={footer} variant="modal">
        {children}
      </Drawer>
    );
  }

  const snap = snapPoints[Math.min(initialSnap, snapPoints.length - 1)] ?? 'auto';

  const handleDragEnd = (_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    if (!dismissible) return;
    const height = sheetRef.current?.offsetHeight ?? window.innerHeight;
    const distance = info.offset.y;
    const velocity = info.velocity.y;
    if (velocity > 500 || distance > height * 0.25) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={s.overlay}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={dismissible ? onClose : undefined}
            aria-hidden="true"
          />
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel ?? title}
            className={`${s.sheet} ${SNAP_CLASS[snap]}`}
            variants={bottomSheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            drag={dismissible && !reduceMotion ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
          >
            {showGrabber && (
              <div className={s.grabberWrap} aria-hidden="true">
                <div className={s.grabber} />
              </div>
            )}
            {(title || dismissible) && (
              <div className={s.header}>
                <div className={s.titleBlock}>
                  {title && <div className={s.title}>{title}</div>}
                  {subtitle && <div className={s.subtitle}>{subtitle}</div>}
                </div>
                {dismissible && (
                  <button type="button" className={s.closeBtn} onClick={onClose} aria-label="Закрыть">
                    <X size={16} />
                  </button>
                )}
              </div>
            )}
            <div className={`${s.body} ${flushBody ? s.bodyFlush : ''}`}>{children}</div>
            {footer && <div className={s.footer}>{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
