import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { fadeUp, listContainer } from '../motion/presets';
import { Button } from './Button';
import s from './EmptyState.module.css';

interface EmptyStateAction { label: string; onClick: () => void; }

interface EmptyStateProps {
  icon?:        ReactNode;
  title:        string;
  description?: string;
  /** @deprecated use description */
  subtitle?:    string;
  action?:      ReactNode | EmptyStateAction;
  steps?:       string[];
  compact?:     boolean;
}

function isAction(a: unknown): a is EmptyStateAction {
  return typeof a === 'object' && a !== null && 'label' in a && 'onClick' in a;
}

/**
 * EmptyState — пустое состояние по стандарту Главы 27.
 * Каждый экран обязан иметь состояние empty.
 */
export function EmptyState({
  icon, title, description, subtitle,
  action, steps, compact = false,
}: EmptyStateProps) {
  const desc       = description ?? subtitle;
  const sizeKey    = compact ? s.compact : s.default;
  const actionNode = isAction(action)
    ? <Button size="sm" onClick={action.onClick}>{action.label}</Button>
    : action;

  return (
    <motion.div
      variants={listContainer}
      initial="hidden"
      animate="show"
      className={`${s.root} ${sizeKey}`}
    >
      {icon && (
        <motion.div variants={fadeUp} className={`${s.iconWrap} ${sizeKey}`}>
          {icon}
        </motion.div>
      )}

      <motion.div variants={fadeUp} className={s.textBlock}>
        <h3 className={`${s.title} ${sizeKey}`}>{title}</h3>
        {desc && <p className={s.desc}>{desc}</p>}
      </motion.div>

      {steps && steps.length > 0 && (
        <motion.div variants={fadeUp} className={s.steps}>
          {steps.map((step, i) => (
            <div key={i} className={s.stepRow}>
              <span className={s.stepNum}>{i + 1}</span>
              {step}
            </div>
          ))}
        </motion.div>
      )}

      {actionNode && <motion.div variants={fadeUp}>{actionNode}</motion.div>}
    </motion.div>
  );
}
