import { memo, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pin, X } from 'lucide-react';
import { WORKSPACE_WIDGET_MAP } from '../registry';
import { useWorkspaceStore } from '../model/store';
import type { WorkspaceTile as WorkspaceTileType } from '../model/types';
import styles from './Workspace.module.css';

interface Props {
  tile: WorkspaceTileType;
  presentation?: 'surface' | 'flight';
  flightLayout?: WorkspaceFlightTileLayout;
}

export interface WorkspaceFlightTileLayout {
  left: number;
  top: number;
  scale: number;
  opacity: number;
  blur: number;
  zIndex: number;
  visible: boolean;
}

const DRAG_THRESHOLD = 5;
const VIEWPORT_EDGE_PADDING = 12;
const DESKTOP_CANVAS_LEFT_INSET = 68;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveInteractiveInsets() {
  if (typeof window === 'undefined') {
    return {
      top: 56 + VIEWPORT_EDGE_PADDING,
      left: VIEWPORT_EDGE_PADDING,
      right: VIEWPORT_EDGE_PADDING,
      bottom: VIEWPORT_EDGE_PADDING,
    };
  }

  const rootStyles = getComputedStyle(document.documentElement);
  const topbarHeight = parseFloat(rootStyles.getPropertyValue('--topbar-height')) || 56;
  const isDesktopCanvas = window.matchMedia('(min-width: 981px)').matches;

  return {
    top: topbarHeight + VIEWPORT_EDGE_PADDING,
    left: isDesktopCanvas ? DESKTOP_CANVAS_LEFT_INSET : VIEWPORT_EDGE_PADDING,
    right: VIEWPORT_EDGE_PADDING,
    bottom: VIEWPORT_EDGE_PADDING,
  };
}

export const WorkspaceTile = memo(function WorkspaceTile({ tile, presentation = 'surface', flightLayout }: Props) {
  const navigate = useNavigate();
  const [dragging, setDragging] = useState(false);
  const tileRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<{ mx: number; my: number; tx: number; ty: number; draggable: boolean; pointerId: number } | null>(null);
  const hasDragged = useRef(false);
  const detachDragListenersRef = useRef<(() => void) | null>(null);

  const setTilePosition = useWorkspaceStore((s) => s.setTilePosition);
  const bringToFront = useWorkspaceStore((s) => s.bringToFront);
  const markTileActive = useWorkspaceStore((s) => s.markTileActive);
  const removeTile = useWorkspaceStore((s) => s.removeTile);
  const openContextMenu = useWorkspaceStore((s) => s.openContextMenu);
  const setHoveredTile = useWorkspaceStore((s) => s.setHoveredTile);
  const isHovered = useWorkspaceStore((s) => s.hoveredTileId === tile.id);

  const definition = WORKSPACE_WIDGET_MAP[tile.kind];
  if (!definition) return null;

  const Icon = definition.icon;
  const isFlightPresentation = presentation === 'flight';
  const isDraggable = !isFlightPresentation && !tile.pinned;

  const style = (isFlightPresentation
    ? {
        position: 'absolute',
        left: flightLayout?.left ?? 0,
        top: flightLayout?.top ?? 0,
        filter: (flightLayout?.blur ?? 0) > 0 ? `blur(${flightLayout?.blur ?? 0}px)` : undefined,
        zIndex: flightLayout?.zIndex ?? (tile.zIndex ?? 10),
        transformOrigin: 'center center',
        pointerEvents: flightLayout?.visible ? 'auto' : 'none',
        width: tile.width,
        height: tile.height,
        '--tile-flight-scale': `${flightLayout?.scale ?? 0.84}`,
        '--tile-flight-opacity': `${flightLayout?.opacity ?? 0}`,
      }
    : {
        position: 'absolute',
        left: tile.x,
        top: tile.y,
        width: tile.width,
        height: tile.height,
        zIndex: tile.zIndex ?? 10,
        cursor: dragging ? 'grabbing' : 'grab',
      }) as CSSProperties;

  useEffect(() => () => {
    detachDragListenersRef.current?.();
    detachDragListenersRef.current = null;
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    detachDragListenersRef.current?.();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore pointer-capture failures and fall back to window listeners.
    }
    hasDragged.current = false;
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      tx: tile.x,
      ty: tile.y,
      draggable: isDraggable,
      pointerId: e.pointerId,
    };
    bringToFront(tile.id);
    markTileActive(tile.id, { status: tile.pinned ? 'idle' : 'floating' });
    setDragging(false);

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragStart.current || event.pointerId !== dragStart.current.pointerId) return;
      const dx = event.clientX - dragStart.current.mx;
      const dy = event.clientY - dragStart.current.my;
      if (!hasDragged.current && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        hasDragged.current = true;
        if (dragStart.current.draggable) {
          setDragging(true);
        }
      }
      if (hasDragged.current && dragStart.current.draggable) {
        const { zoom, viewport, viewportSize } = useWorkspaceStore.getState();
        const proposedX = dragStart.current.tx + dx / zoom;
        const proposedY = dragStart.current.ty + dy / zoom;
        const insets = resolveInteractiveInsets();
        const minX = Math.max(0, (insets.left - viewport.x) / zoom);
        const minY = Math.max(0, (insets.top - viewport.y) / zoom);
        const maxX = Math.max(minX, (viewportSize.width - insets.right - viewport.x) / zoom - tile.width);
        const maxY = Math.max(minY, (viewportSize.height - insets.bottom - viewport.y) / zoom - tile.height);

        setTilePosition(
          tile.id,
          clamp(proposedX, minX, maxX),
          clamp(proposedY, minY, maxY),
        );
      }
    };

    const finishDrag = (pointerId: number, shouldNavigate: boolean) => {
      detachDragListenersRef.current?.();
      detachDragListenersRef.current = null;
      if (tileRef.current?.hasPointerCapture(pointerId)) {
        tileRef.current.releasePointerCapture(pointerId);
      }
      const wasDragging = hasDragged.current;
      dragStart.current = null;
      hasDragged.current = false;
      setDragging(false);
      if (shouldNavigate && !wasDragging) {
        navigate(definition.navTo);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!dragStart.current || event.pointerId !== dragStart.current.pointerId) return;
      finishDrag(event.pointerId, true);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (!dragStart.current || event.pointerId !== dragStart.current.pointerId) return;
      finishDrag(event.pointerId, false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    detachDragListenersRef.current = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }

  function onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(tile.id, e.clientX, e.clientY);
  }

  function onRemoveClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    removeTile(tile.id);
  }

  function onRemovePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div
      ref={tileRef}
      data-tile-id={tile.id}
      data-workspace-tile="true"
      className={[
        styles.tile,
        isFlightPresentation ? styles.tileFlight : styles.tileSurface,
        tile.pinned ? styles.tilePinned : '',
        dragging ? styles.tileDragging : '',
        tile.status === 'drifting' ? styles.tileDrifting : '',
        tile.distance3D === 'near' ? styles.tileDistanceNear : tile.distance3D === 'far' ? styles.tileDistanceFar : styles.tileDistanceMid,
        isFlightPresentation ? (isHovered ? styles.tileHovered3d : '') : (isHovered ? styles.tileHovered : ''),
        isFlightPresentation && !flightLayout?.visible ? styles.tileFlightHidden : '',
      ].filter(Boolean).join(' ')}
      style={style}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHoveredTile(tile.id)}
      onMouseLeave={() => setHoveredTile(null)}
    >
      {!isFlightPresentation && (
        <button
          type="button"
          className={styles.tileQuickDelete}
          aria-label={`Удалить плитку ${tile.title}`}
          title="Удалить плитку"
          onPointerDown={onRemovePointerDown}
          onClick={onRemoveClick}
        >
          <X size={12} />
        </button>
      )}
      <div className={styles.tileInner} style={{ '--tile-color': definition.color } as CSSProperties}>
        <div className={styles.tileHeader}>
          <div className={styles.tileIconWrap}>
            <Icon size={16} />
          </div>
          <span className={styles.tileTitle}>{tile.title}</span>
          {definition.section && (
            <span className={styles.tileSectionBadge}>{definition.section}</span>
          )}
          {tile.pinned && <Pin size={10} className={styles.tilePinIcon} />}
        </div>
        {definition.Preview ? (
          <div className={styles.tilePreviewWrap}>
            <definition.Preview tileId={tile.id} />
          </div>
        ) : (
          <p className={styles.tileDesc}>{definition.description}</p>
        )}
        <div className={styles.tileArrow}>
          <span>Открыть →</span>
        </div>
      </div>
    </div>
  );
});
