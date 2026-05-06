import { motion } from 'framer-motion';
import s from './HealthScoreBadge.module.css';

interface HealthScoreProps {
  score: number;
  band: 'green' | 'yellow' | 'red';
}

export function HealthScoreBadge({ score, band }: HealthScoreProps) {
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      title={`Health Score: ${score}/100`}
      className={`${s.badge} ${s[band]}`}
    >
      <span className={s.dot} />
      {score}
    </motion.div>
  );
}
