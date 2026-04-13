import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { AuthModal } from './AuthModal';
import { DEV_RUNTIME_BLOCKERS_DISABLED } from '../../shared/config/devAccess';
import { useAuthStore } from '../../shared/stores/auth';
import styles from './WorkspaceLock.module.css';

interface WorkspaceLockProps {
  onUnlocked: () => void;
}

export function WorkspaceLock({ onUnlocked }: WorkspaceLockProps) {
  if (DEV_RUNTIME_BLOCKERS_DISABLED) {
    return null;
  }

  const unlock = useAuthStore((state) => state.unlock);
  const [releasing, setReleasing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  const handleAuthSuccess = useCallback(() => {
    setModalOpen(false);
    setReleasing(true);

    window.setTimeout(() => {
      unlock();
      setHidden(true);
      onUnlocked();
    }, 1120);
  }, [onUnlocked, unlock]);

  if (hidden) {
    return null;
  }

  return (
    <>
      <motion.div
        className={styles.root}
        animate={releasing ? { opacity: [1, 1, 0] } : { opacity: 1 }}
        transition={
          releasing
            ? { duration: 0.48, delay: 0.64, times: [0, 0.18, 1], ease: 'easeOut' }
            : { duration: 0.2 }
        }
      >
        <div className={styles.backdrop} aria-hidden="true" />

        <motion.div
          className={styles.panel}
          animate={
            releasing
              ? { scale: 0.95, opacity: 0, y: -8 }
              : { scale: 1, opacity: 1, y: 0 }
          }
          transition={
            releasing
              ? { duration: 0.32, ease: 'easeIn' }
              : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
          }
        >
          <div className={styles.statusRow}>
            <Lock size={15} className={styles.lockIcon} aria-hidden="true" />
            <span className={styles.statusLabel}>Рабочее пространство заблокировано</span>
          </div>

          <button
            type="button"
            className={styles.unlockBtn}
            onClick={() => {
              if (!releasing) {
                setModalOpen(true);
              }
            }}
            aria-label="Разблокировать рабочее пространство"
          >
            Разблокировать
          </button>
        </motion.div>
      </motion.div>

      <AuthModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </>
  );
}
