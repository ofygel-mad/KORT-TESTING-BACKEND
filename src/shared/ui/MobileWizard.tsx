import { motion, AnimatePresence, useReducedMotion, type PanInfo } from 'framer-motion';
import { useCallback, useEffect, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { hapticTap } from '../lib/haptics';
import s from './MobileWizard.module.css';

export interface WizardStep {
  id: string;
  title: string;
  /** Compact label for the progress chip (defaults to first 12 chars of title). */
  shortTitle?: string;
  /** Returns true to allow advancing. May be async (RHF trigger() compatible). */
  validate?: () => boolean | Promise<boolean>;
  optional?: boolean;
  render: () => ReactNode;
}

export interface MobileWizardProps {
  steps: WizardStep[];
  current: number;
  onChange: (idx: number) => void;
  onSubmit: () => void | Promise<void>;
  submitting?: boolean;
  primaryLabel?: string;
  nextLabel?: string;
  backLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  /** Enable horizontal swipe to navigate. Default true (disabled when reducedMotion). */
  enableSwipe?: boolean;
}

const stepVariants = {
  initial: (dir: number) => ({ opacity: 0, x: dir > 0 ? 24 : -24 }),
  animate: { opacity: 1, x: 0 },
  exit:    (dir: number) => ({ opacity: 0, x: dir > 0 ? -24 : 24 }),
};

export function MobileWizard({
  steps,
  current,
  onChange,
  onSubmit,
  submitting = false,
  primaryLabel = 'Готово',
  nextLabel = 'Далее',
  backLabel = 'Назад',
  cancelLabel = 'Отменить',
  onCancel,
  enableSwipe = true,
}: MobileWizardProps) {
  const reduceMotion = useReducedMotion();
  useBodyScrollLock(true);

  const total = steps.length;
  const safeIndex = Math.min(Math.max(current, 0), total - 1);
  const step = steps[safeIndex];
  const isLast = safeIndex === total - 1;

  const goNext = useCallback(async () => {
    if (submitting) return;
    if (step?.validate) {
      const ok = await step.validate();
      if (!ok) return;
    }
    hapticTap();
    if (isLast) {
      await onSubmit();
    } else {
      onChange(safeIndex + 1);
    }
  }, [step, submitting, isLast, onChange, onSubmit, safeIndex]);

  const goBack = useCallback(() => {
    if (submitting || safeIndex === 0) return;
    hapticTap();
    onChange(safeIndex - 1);
  }, [submitting, safeIndex, onChange]);

  // hardware back button on Android — pop a step instead of leaving the page
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      if (safeIndex > 0) {
        e.preventDefault?.();
        onChange(safeIndex - 1);
        window.history.pushState(null, '', window.location.href);
      }
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [safeIndex, onChange]);

  const handleSwipeEnd = (_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    if (!enableSwipe || reduceMotion) return;
    const distance = info.offset.x;
    const velocity = info.velocity.x;
    if (distance < -80 || velocity < -500) goNext();
    else if (distance > 80 || velocity > 500) goBack();
  };

  if (!step) return null;
  const direction = 1; // simple forward direction for animation key

  return (
    <div className={s.root} role="region" aria-label="Многошаговая форма">
      <div className={s.progressBar}>
        <div className={s.progressTopRow}>
          {onCancel ? (
            <button type="button" className={s.cancelBtn} onClick={onCancel} aria-label={cancelLabel}>
              {cancelLabel}
            </button>
          ) : <span />}
          <span className={s.stepCounter} aria-live="polite">{safeIndex + 1} / {total}</span>
        </div>
        <div className={s.dots} aria-hidden="true">
          {steps.map((stp, i) => (
            <span
              key={stp.id}
              className={`${s.dot} ${i < safeIndex ? s.dotDone : ''} ${i === safeIndex ? s.dotActive : ''}`}
            />
          ))}
        </div>
        <div className={s.stepTitle}>{step.title}</div>
      </div>

      <motion.div
        className={s.body}
        drag={enableSwipe && !reduceMotion ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        onDragEnd={handleSwipeEnd}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step.id}
            className={s.stepWrap}
            custom={direction}
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {step.render()}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <div className={s.actionBar}>
        <button
          type="button"
          className={`${s.btn} ${s.btnGhost}`}
          onClick={goBack}
          disabled={submitting || safeIndex === 0}
          aria-label={backLabel}
        >
          <ChevronLeft size={16} /> {backLabel}
        </button>
        <button
          type="button"
          className={`${s.btn} ${s.btnPrimary}`}
          onClick={goNext}
          disabled={submitting}
          aria-label={isLast ? primaryLabel : nextLabel}
        >
          {isLast ? primaryLabel : (<>{nextLabel} <ChevronRight size={16} /></>)}
        </button>
      </div>
    </div>
  );
}
