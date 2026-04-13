import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useWorkspaceStore, ZOOM_MIN, ZOOM_MAX } from '../model/store';
import styles from './Workspace.module.css';

export function WorkspaceZoomHud() {
  const zoom     = useWorkspaceStore((s) => s.zoom);
  const zoomIn   = useWorkspaceStore((s) => s.zoomIn);
  const zoomOut  = useWorkspaceStore((s) => s.zoomOut);
  const resetZoom = useWorkspaceStore((s) => s.resetZoom);
  const atMin    = zoom <= ZOOM_MIN;
  const atMax    = zoom >= ZOOM_MAX;
  const isDefault = Math.abs(zoom - 1) < 0.01;

  return (
    <div className={styles.zoomHud} data-workspace-ui="true">
      <button
        className={styles.zoomBtn}
        onClick={zoomOut}
        disabled={atMin}
        title="Уменьшить (Ctrl + −)"
      >
        <ZoomOut size={13} />
      </button>

      <button
        className={`${styles.zoomPct} ${!isDefault ? styles.zoomPctActive : ''}`}
        onClick={resetZoom}
        title="Сбросить масштаб (Ctrl + 0)"
      >
        {Math.round(zoom * 100)}%
      </button>

      <button
        className={styles.zoomBtn}
        onClick={zoomIn}
        disabled={atMax}
        title="Увеличить (Ctrl + =)"
      >
        <ZoomIn size={13} />
      </button>
    </div>
  );
}
