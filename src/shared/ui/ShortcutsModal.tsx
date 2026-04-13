import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';
import { overlayVariants } from '../motion/presets';
import s from './ShortcutsModal.module.css';

const SHORTCUTS = [
  { key: 'N',   description: 'Новый клиент' },
  { key: 'D',   description: 'Новая сделка' },
  { key: 'T',   description: 'Новая задача' },
  { key: 'F',   description: 'Режим фокуса (Focus Mode)' },
  { key: '/',   description: 'Поиск (Command Palette)' },
  { key: '?',   description: 'Показать шорткаты' },
  { key: 'Esc', description: 'Закрыть диалог' },
];

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={s.overlay}
            variants={overlayVariants}
            initial="hidden" animate="visible" exit="hidden"
            onClick={onClose}
          />
          <motion.div
            className={s.panel}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{ opacity: 0,   scale: 0.94, y: 16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <div className={s.header}>
              <div className={s.headerLeft}>
                <Keyboard size={16} className={s.headerIcon} />
                <span className={s.headerTitle}>Горячие клавиши</span>
              </div>
              <button className={s.closeBtn} onClick={onClose} aria-label="Закрыть">
                <X size={15} />
              </button>
            </div>

            <div className={s.list}>
              {SHORTCUTS.map((sc, i) => (
                <motion.div
                  key={sc.key}
                  className={s.row}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <span className={s.rowLabel}>{sc.description}</span>
                  <kbd className={s.kbd}>{sc.key}</kbd>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
