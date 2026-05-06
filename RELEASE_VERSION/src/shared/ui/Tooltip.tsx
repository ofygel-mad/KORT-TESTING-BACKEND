import { type ReactNode, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import s from './Tooltip.module.css';

interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: 'right' | 'top' | 'bottom' | 'left';
  disabled?: boolean;
  stretch?: boolean;
}

export function Tooltip({ content, children, side = 'right', disabled = false, stretch = false }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);
  const tooltipId = useId();

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const show = () => {
    if (disabled || typeof window === 'undefined') return;
    clearTimer();
    timerRef.current = window.setTimeout(() => setVisible(true), 350);
  };

  const hide = () => {
    clearTimer();
    setVisible(false);
  };

  return (
    <span
      className={[s.root, stretch ? s.stretch : ''].join(' ')}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={visible && !disabled ? tooltipId : undefined}
    >
      {children}
      <AnimatePresence>
        {visible && !disabled && (
          <motion.span
            id={tooltipId}
            className={`${s.tip} ${s[side]}`}
            role="tooltip"
            initial={{ opacity: 0, x: side === 'right' ? -6 : side === 'left' ? 6 : 0, y: side === 'top' ? 4 : side === 'bottom' ? -4 : 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
