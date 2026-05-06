import type { PointerEvent as ReactPointerEvent, WheelEvent } from 'react';
import { memo, startTransition, useEffect, useRef, useCallback, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useDevicePerformance } from '../../../shared/hooks/useDevicePerformance';
import { useIsMobile } from '../../../shared/hooks/useIsMobile';
import { useWorkspaceStore, ZOOM_MIN, ZOOM_MAX } from '../model/store';
import type { WorkspaceTile as WorkspaceTileType } from '../model/types';
import type { WorkspaceSceneFlightTileProjection } from '../scene/sceneRuntime';
import { WorkspaceTile, type WorkspaceFlightTileLayout } from './WorkspaceTile';
import { WorkspaceBgEffect } from './WorkspaceBgEffect';
import { WorkspaceTileContextMenu } from './WorkspaceTileContextMenu';
import styles from './Workspace.module.css';

function clamp(v: number, lo: number, hi: number) { return Math.min(Math.max(v, lo), hi); }
function resolveInteractiveInsets() {
  if (typeof window === 'undefined') {
    return { top: 68, left: 12, right: 12, bottom: 12 };
  }

  const rootStyles = getComputedStyle(document.documentElement);
  const topbarHeight = parseFloat(rootStyles.getPropertyValue('--topbar-height')) || 56;
  return {
    top: topbarHeight + 12,
    left: window.matchMedia('(min-width: 981px)').matches ? 68 : 12,
    right: 12,
    bottom: 12,
  };
}

function isTextInputTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (
    target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
    target.isContentEditable || Boolean(target.closest('[contenteditable="true"]'))
  );
}

/**
 * ISOLATION BOUNDARY — fully independent from auth, UI, or any store outside
 * useWorkspaceStore. Parent re-renders are blocked by React.memo.
 * Tiles are now navigation shortcuts — clicking navigates to the module page.
 */
export const WorkspaceCanvas = memo(function WorkspaceCanvas() {
  const viewportRef        = useRef<HTMLDivElement>(null);
  const viewport           = useWorkspaceStore((s) => s.viewport);
  const viewportSize       = useWorkspaceStore((s) => s.viewportSize);
  const tiles              = useWorkspaceStore((s) => s.tiles);
  const sceneMode          = useWorkspaceStore((s) => s.sceneMode);
  const zoom               = useWorkspaceStore((s) => s.zoom);
  const contextMenu        = useWorkspaceStore((s) => s.contextMenu);
  const setViewport        = useWorkspaceStore((s) => s.setViewport);
  const initializeViewport = useWorkspaceStore((s) => s.initializeViewport);
  const setZoom            = useWorkspaceStore((s) => s.setZoom);
  const closeContextMenu   = useWorkspaceStore((s) => s.closeContextMenu);
  const setHoveredTile     = useWorkspaceStore((s) => s.setHoveredTile);

  const [flightTileLayouts, setFlightTileLayouts] = useState<Record<string, WorkspaceFlightTileLayout>>({});
  const lastFlightProjectionAtRef = useRef(0);
  const performanceProfile = useDevicePerformance();
  const isMobile = useIsMobile(981);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    let frameHandle = 0;
    const update = () => { frameHandle = 0; initializeViewport(node.clientWidth, node.clientHeight); };
    const scheduleUpdate = () => { if (frameHandle) cancelAnimationFrame(frameHandle); frameHandle = requestAnimationFrame(update); };
    scheduleUpdate();
    const ro = new ResizeObserver(scheduleUpdate);
    ro.observe(node);
    return () => { ro.disconnect(); if (frameHandle) cancelAnimationFrame(frameHandle); };
  }, [initializeViewport]);

  const handleWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    if (sceneMode === 'flight') return;
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(clamp(+(zoom + (e.deltaY > 0 ? -0.06 : 0.06)).toFixed(2), ZOOM_MIN, ZOOM_MAX));
  }, [sceneMode, zoom, setZoom]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTextInputTarget(e.target)) return;
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const store = useWorkspaceStore.getState();
        if (e.key === 't' || e.key === 'T') { e.preventDefault(); store.setSceneThemeAuto(!store.sceneThemeAuto); return; }
        const themeByKey: Record<string, 'default' | 'morning' | 'overcast' | 'dusk' | 'night'> = { '1': 'default', '2': 'morning', '3': 'overcast', '4': 'dusk', '5': 'night' };
        const nextTheme = themeByKey[e.key];
        if (nextTheme) { e.preventDefault(); store.setSceneTheme(nextTheme); return; }
      }
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const store = useWorkspaceStore.getState();
        store.setSceneMode(store.sceneMode === 'flight' ? 'surface' : 'flight');
        return;
      }
      if (sceneMode === 'flight') return;
      if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); useWorkspaceStore.getState().resetZoom(); }
      if ((e.ctrlKey || e.metaKey) && e.key === '=') { e.preventDefault(); useWorkspaceStore.getState().zoomIn(); }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); useWorkspaceStore.getState().zoomOut(); }
      if (e.key === 'Escape') closeContextMenu();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeContextMenu, sceneMode]);

  useEffect(() => {
    closeContextMenu();
    setHoveredTile(null);
    if (sceneMode !== 'flight') setFlightTileLayouts({});
  }, [sceneMode, closeContextMenu, setHoveredTile]);

  useEffect(() => {
    if (sceneMode === 'flight' || viewportRef.current === null || tiles.length === 0) {
      return;
    }

    useWorkspaceStore.setState((state) => {
      if (state.viewportSize.width <= 0 || state.viewportSize.height <= 0) {
        return state;
      }

      const insets = resolveInteractiveInsets();
      let changed = false;
      const nextTiles = state.tiles.map((tile) => {
        const minX = Math.max(0, (insets.left - state.viewport.x) / state.zoom);
        const minY = Math.max(0, (insets.top - state.viewport.y) / state.zoom);
        const maxX = Math.max(minX, (state.viewportSize.width - insets.right - state.viewport.x) / state.zoom - tile.width);
        const maxY = Math.max(minY, (state.viewportSize.height - insets.bottom - state.viewport.y) / state.zoom - tile.height);
        const nextX = clamp(tile.x, minX, maxX);
        const nextY = clamp(tile.y, minY, maxY);

        if (nextX === tile.x && nextY === tile.y) {
          return tile;
        }

        changed = true;
        return { ...tile, x: nextX, y: nextY };
      });

      return changed ? { tiles: nextTiles } : state;
    });
  }, [sceneMode, tiles.length, viewportSize.height, viewportSize.width, zoom]);

  const flightFrameCounter = useRef(0);
  const handleFlightTileProjection = useCallback((projectedTiles: WorkspaceSceneFlightTileProjection[]) => {
    if (useWorkspaceStore.getState().sceneMode !== 'flight') return;
    flightFrameCounter.current += 1;
    if (flightFrameCounter.current % 3 !== 0) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastFlightProjectionAtRef.current < performanceProfile.flightProjectionIntervalMs) return;
    lastFlightProjectionAtRef.current = now;
    startTransition(() => {
      setFlightTileLayouts(() => Object.fromEntries(
        projectedTiles.map((t) => [t.id, { left: t.left, top: t.top, scale: t.scale, opacity: t.opacity, blur: t.blur, zIndex: t.zIndex, visible: t.visible }]),
      ));
    });
  }, [performanceProfile.flightProjectionIntervalMs]);

  const startPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-scene-control="true"]')) return;
    if (target.closest('[data-workspace-ui="true"]')) return;
    if (target.closest('[data-workspace-tile="true"]')) return;
    if (sceneMode === 'flight') return;
    closeContextMenu();
    const node = viewportRef.current!;
    const startX = e.clientX, startY = e.clientY, originX = viewport.x, originY = viewport.y;
    node.setPointerCapture(e.pointerId);
    node.style.cursor = 'grabbing';
    const onMove = (me: PointerEvent) => setViewport(originX + (me.clientX - startX), originY + (me.clientY - startY));
    const onUp = () => { node.style.cursor = ''; node.releasePointerCapture(e.pointerId); node.removeEventListener('pointermove', onMove); node.removeEventListener('pointerup', onUp); node.removeEventListener('pointercancel', onUp); };
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerup', onUp);
    node.addEventListener('pointercancel', onUp);
  };

  return (
    <div ref={viewportRef} data-workspace-viewport="true"
      className={`${styles.workspaceViewport} ${styles.workspaceViewportEffect} ${sceneMode === 'flight' ? styles.workspaceViewportFlight : ''}`}
      onPointerDown={startPan} onWheel={handleWheel}
    >
      {!isMobile && <WorkspaceBgEffect onFlightTileProjection={handleFlightTileProjection} />}

      {sceneMode !== 'flight' && (
        <div className={styles.workspaceWorld} style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
          {tiles.map((tile: WorkspaceTileType) => <WorkspaceTile key={tile.id} tile={tile} />)}
        </div>
      )}

      {sceneMode === 'flight' && (
        <div className={styles.flightTileField}>
          {tiles.map((tile: WorkspaceTileType) => (
            <WorkspaceTile key={tile.id} tile={tile} presentation="flight" flightLayout={flightTileLayouts[tile.id]} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {contextMenu && <WorkspaceTileContextMenu tileId={contextMenu.tileId} x={contextMenu.x} y={contextMenu.y} />}
      </AnimatePresence>
    </div>
  );
});
