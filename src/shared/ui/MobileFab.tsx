import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Users, Briefcase, CheckSquare, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../hooks/useIsMobile';
import styles from './MobileFab.module.css';

export function MobileFab() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  if (!isMobile) return null;

  const actions = [
    { icon: Users, label: 'Лид', to: '/crm/leads' },
    { icon: Briefcase, label: 'Сделка', to: '/crm/deals' },
    { icon: CheckSquare, label: 'Задача', to: '/crm/tasks' },
  ];

  return (
    <div className={styles.wrap}>
      <AnimatePresence>
        {open && actions.map((action, i) => (
          <motion.button key={action.to} className={styles.subBtn}
            style={{ bottom: `${72 + i * 56}px` } as React.CSSProperties}
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => { navigate(action.to); setOpen(false); }}
          >
            <action.icon size={18} />
            <span className={styles.subLabel}>{action.label}</span>
          </motion.button>
        ))}
      </AnimatePresence>
      <button className={`${styles.fab} ${open ? styles.fabOpen : ''}`} onClick={() => setOpen(o => !o)}>
        <AnimatePresence mode="wait">
          {open ? <motion.span key="x" initial={{ rotate: -90 }} animate={{ rotate: 0 }}><X size={22} /></motion.span>
                : <motion.span key="p" initial={{ rotate: 90 }} animate={{ rotate: 0 }}><Plus size={22} /></motion.span>}
        </AnimatePresence>
      </button>
    </div>
  );
}
