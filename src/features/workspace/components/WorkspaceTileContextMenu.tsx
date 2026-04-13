import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { ExternalLink, Pin, PinOff, Trash2 } from 'lucide-react';
import { WORKSPACE_WIDGET_MAP } from '../registry';
import { useWorkspaceStore } from '../model/store';
import styles from './Workspace.module.css';

interface Props { tileId: string; x: number; y: number; }

export function WorkspaceTileContextMenu({ tileId, x, y }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const tile = useWorkspaceStore((s) => s.tiles.find((t) => t.id === tileId));
  const removeTile = useWorkspaceStore((s) => s.removeTile);
  const closeContextMenu = useWorkspaceStore((s) => s.closeContextMenu);
  const toggleTilePinned = useWorkspaceStore((s) => s.toggleTilePinned);

  const tiles = useWorkspaceStore((s) => s.tiles);
  const isPinned = tiles.find((t) => t.id === tileId)?.pinned ?? false;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) closeContextMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
    };
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onKey);
    }, 30);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [closeContextMenu]);

  if (!tile) return null;
  const definition = WORKSPACE_WIDGET_MAP[tile.kind];

  const clampedX = Math.min(x, window.innerWidth - 220 - 12);
  const clampedY = Math.min(y, window.innerHeight - 180 - 12);

  const item = (Icon: React.ElementType, label: string, onClick: () => void, danger = false) => (
    <button
      className={`${styles.ctxItem} ${danger ? styles.ctxItemDanger : ''}`}
      onClick={() => {
        onClick();
        closeContextMenu();
      }}
    >
      <Icon size={13} />
      <span>{label}</span>
    </button>
  );

  return createPortal(
    <motion.div
      ref={menuRef}
      className={styles.ctxMenu}
      style={{ position: 'fixed', left: clampedX, top: clampedY, zIndex: 600 }}
      initial={{ opacity: 0, scale: 0.92, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -4 }}
      transition={{ type: 'spring', stiffness: 480, damping: 32, mass: 0.6 }}
    >
      <div className={styles.ctxLabel}>{tile.title}</div>
      <div className={styles.ctxDivider} />
      {definition && item(ExternalLink, 'Перейти', () => navigate(definition.navTo))}
      {item(isPinned ? PinOff : Pin, isPinned ? 'Открепить' : 'Закрепить', () => toggleTilePinned(tileId))}
      <div className={styles.ctxDivider} />
      {item(Trash2, 'Убрать с канваса', () => removeTile(tileId), true)}
    </motion.div>,
    document.body,
  );
}
