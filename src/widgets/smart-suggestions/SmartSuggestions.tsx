import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useSuggestionsStore } from '../../shared/stores/suggestions';
import s from './SmartSuggestions.module.css';

export function SmartSuggestions() {
  const { items, dismiss } = useSuggestionsStore();

  return (
    <div className={s.stack}>
      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.id}
            className={s.card}
            initial={{ opacity: 0, x: 48, scale: 0.92 }}
            animate={{ opacity: 1, x: 0,  scale: 1    }}
            exit={{ opacity: 0,    x: 48,  scale: 0.9  }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          >
            {item.icon ? <span className={s.cardEmoji}>{item.icon}</span> : null}

            <div className={s.cardBody}>
              <div className={s.cardText}>{item.text}</div>
              <button
                className={s.cardAction}
                onClick={() => { item.action(); dismiss(item.id); }}
              >
                {item.dismissLabel ?? 'Сделать'}
              </button>
            </div>

            <button
              className={s.cardDismiss}
              onClick={() => dismiss(item.id)}
              aria-label="Скрыть подсказку"
            >
              <X size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
