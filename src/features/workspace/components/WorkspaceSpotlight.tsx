import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Search, LayoutGrid, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useWorkspaceStore, TILE_NAV } from '../model/store';
import { WORKSPACE_WIDGETS } from '../registry';
import styles from './Workspace.module.css';

interface SpotlightAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  tags?: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function WorkspaceSpotlight({ open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const store = useWorkspaceStore();

  const allActions: SpotlightAction[] = [
    ...WORKSPACE_WIDGETS.map((widget) => ({
      id: `create-${widget.kind}`,
      label: `Создать плитку: ${widget.title}`,
      description: widget.description,
      icon: widget.icon,
      action: () => {
        store.addTile(widget.kind);
        onClose();
      },
      tags: ['создать', 'плитка', widget.title.toLowerCase(), widget.kind],
    })),
    {
      id: 'align',
      label: 'Выровнять плитки по сетке',
      icon: LayoutGrid,
      action: () => {
        store.alignTilesToGrid();
        onClose();
      },
      tags: ['выровнять', 'grid', 'сетка'],
    },
    {
      id: 'zoom-reset',
      label: 'Сбросить масштаб (100%)',
      icon: RotateCcw,
      action: () => {
        store.resetZoom();
        onClose();
      },
      tags: ['масштаб', 'сброс', 'zoom'],
    },
    {
      id: 'zoom-in',
      label: 'Приблизить',
      icon: ZoomIn,
      action: () => {
        store.zoomIn();
        onClose();
      },
      tags: ['увеличить', 'zoom in'],
    },
    {
      id: 'zoom-out',
      label: 'Отдалить',
      icon: ZoomOut,
      action: () => {
        store.zoomOut();
        onClose();
      },
      tags: ['уменьшить', 'zoom out'],
    },
    ...store.tiles.map((tile) => ({
      id: `open-${tile.id}`,
      label: `Перейти: ${tile.title}`,
      description: 'Плитка на рабочем поле',
      icon: WORKSPACE_WIDGETS.find((widget) => widget.kind === tile.kind)?.icon ?? Search,
      action: () => {
        const navTo = TILE_NAV[tile.kind];
        if (navTo) navigate(navTo);
        onClose();
      },
      tags: ['открыть', tile.title.toLowerCase(), tile.kind],
    })),
  ];

  const filtered = query.trim()
    ? allActions.filter((action) => {
        const q = query.toLowerCase();
        return action.label.toLowerCase().includes(q)
          || action.description?.toLowerCase().includes(q)
          || action.tags?.some((tag) => tag.includes(q));
      })
    : allActions.slice(0, 10);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedIdx(0);
    const timeoutId = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const handleKey = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIdx((index) => Math.min(index + 1, filtered.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIdx((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      filtered[selectedIdx]?.action();
      return;
    }

    if (event.key === 'Escape') {
      onClose();
    }
  }, [filtered, onClose, selectedIdx]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={styles.spotlightOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            className={styles.spotlightPanel}
            initial={{ opacity: 0, scale: 0.95, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: 'spring', stiffness: 460, damping: 34, mass: 0.7 }}
          >
            <div className={styles.spotlightInputWrap}>
              <Search size={16} className={styles.spotlightSearchIcon} />
              <input
                ref={inputRef}
                className={styles.spotlightInput}
                placeholder="Поиск действий, плиток, команд..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleKey}
              />
              <kbd className={styles.spotlightEsc}>ESC</kbd>
            </div>

            {filtered.length > 0 ? (
              <div className={styles.spotlightList}>
                {filtered.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      className={`${styles.spotlightItem} ${index === selectedIdx ? styles.spotlightItemActive : ''}`}
                      onClick={action.action}
                      onMouseEnter={() => setSelectedIdx(index)}
                    >
                      <span className={styles.spotlightItemIcon}><Icon size={15} /></span>
                      <span className={styles.spotlightItemBody}>
                        <span className={styles.spotlightItemLabel}>{action.label}</span>
                        {action.description && (
                          <span className={styles.spotlightItemDesc}>{action.description}</span>
                        )}
                      </span>
                      {index === selectedIdx && <kbd className={styles.spotlightEnterHint}>↵</kbd>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className={styles.spotlightEmpty}>
                Ничего не найдено по запросу «{query}»
              </div>
            )}

            <div className={styles.spotlightFooter}>
              <span><kbd>↑↓</kbd> навигация</span>
              <span><kbd>↵</kbd> выбрать</span>
              <span><kbd>Esc</kbd> закрыть</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
