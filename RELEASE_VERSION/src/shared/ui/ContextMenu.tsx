import { useEffect, useRef, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ContextMenu.module.css';
import { addDocumentListener, getWindow } from '../lib/browser';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  color?: string;
  danger?: boolean;
  divider?: boolean;
  onClick: () => void;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const removeMouse = addDocumentListener('mousedown', h);
    const removeKey = addDocumentListener('keydown', k);
    return () => { removeMouse(); removeKey(); };
  }, [onClose]);

  const win = getWindow();
  const vw = win?.innerWidth ?? 1280;
  const vh = win?.innerHeight ?? 800;
  const menuW = 196;
  const menuH = items.length * 36 + 16;
  const cx = x + menuW > vw ? x - menuW : x;
  const cy = y + menuH > vh ? y - menuH : y;

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.1 }}
        className={styles.menu}
        style={{ top: cy, left: cx }}
      >
        {items.map((item, i) => item.divider
          ? <div key={i} className={styles.divider} />
          : (
            <button
              key={i}
              onClick={() => { item.onClick(); onClose(); }}
              className={[styles.item, item.danger ? styles.itemDanger : ''].join(' ')}
              style={item.color && !item.danger ? ({ ['--menu-item-color' as '--menu-item-color']: item.color } as CSSProperties) : undefined}
            >
              {item.icon && <span className={styles.icon}>{item.icon}</span>}
              {item.label}
            </button>
          ))}
      </motion.div>
    </AnimatePresence>
  );
}
