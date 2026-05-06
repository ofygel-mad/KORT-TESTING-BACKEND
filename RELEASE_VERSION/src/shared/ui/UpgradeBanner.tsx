import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import s from './UpgradeBanner.module.css';

interface UpgradeBannerProps { triggerMessage?: string; }

export function UpgradeBanner({ triggerMessage }: UpgradeBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  const org = useAuthStore(st => st.org);

  if (!org || org.mode === 'industrial' || dismissed) return null;

  const nextMode  = org.mode === 'basic' ? 'advanced' : 'industrial';
  const nextLabel = nextMode === 'advanced' ? 'Продвинутый' : 'Промышленный';

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          className={s.banner}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          <Zap size={15} className={s.icon} />

          <span className={s.message}>
            {triggerMessage ?? `Ваш бизнес растёт — пора перейти на ${nextLabel} режим.`}
          </span>

          <button className={s.upgradeBtn} onClick={() => navigate('/settings')}>
            Обновить <ChevronRight size={12} />
          </button>

          <button className={s.dismissBtn} onClick={() => setDismissed(true)} aria-label="Скрыть">
            <X size={13} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
