import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ChevronLeft, Clock, CloudMoon, Image, Plane, Sparkles } from 'lucide-react';
import { readStorage } from '../../../shared/lib/browser';
import { useDevicePerformance } from '../../../shared/hooks/useDevicePerformance';
import { useWorkspaceStore, WORLD_FACTOR } from '../model/store';
import { WorkspaceSceneRuntime, type WorkspaceSceneFlightTileProjection, type WorkspaceSceneTileDescriptor } from '../scene/sceneRuntime';
import { WORKSPACE_SCENE_THEMES, WORKSPACE_SCENE_THEME_OPTIONS } from '../scene/sceneConfig';
import styles from './Workspace.module.css';

interface WorkspaceBgEffectProps {
  onFlightTileProjection?: (tiles: WorkspaceSceneFlightTileProjection[]) => void;
}

function getSceneTiles(
  tiles: ReturnType<typeof useWorkspaceStore.getState>['tiles'],
  viewportSize: { width: number; height: number },
  focusTileId: string | null,
): WorkspaceSceneTileDescriptor[] {
  const worldWidth = Math.max(1, viewportSize.width * WORLD_FACTOR);
  const worldHeight = Math.max(1, viewportSize.height * WORLD_FACTOR);

  return tiles.map((tile) => {
    const centerX = tile.x + tile.width * 0.5;
    const centerY = tile.y + tile.height * 0.5;

    return {
      id: tile.id,
      kind: tile.kind,
      title: tile.title,
      version: tile.version,
      status: tile.status,
      distance3D: tile.distance3D,
      width: tile.width,
      height: tile.height,
      normalizedX: (centerX / worldWidth - 0.5) * 2,
      normalizedY: (centerY / worldHeight - 0.5) * 2,
      isFocused: focusTileId === tile.id,
      isPinned: tile.pinned ?? false,
      createdAt: tile.createdAt,
    };
  });
}

function hasPersistedTerrainMode() {
  const raw = readStorage('kort-workspace');
  if (!raw) {
    return false;
  }

  try {
    const parsed = JSON.parse(raw) as { state?: { sceneTerrainMode?: unknown } };
    return typeof parsed.state?.sceneTerrainMode === 'string';
  } catch {
    return false;
  }
}

/**
 * ⚠️  ISOLATION BOUNDARY — the 3D scene (Three.js / WebGL) lives here.
 * This component must NEVER import auth, UI, or any store besides `useWorkspaceStore`.
 * It is wrapped in React.memo — the parent must pass a stable `onFlightTileProjection`
 * callback (via useCallback) to avoid unnecessary scene re-initialization.
 */
export const WorkspaceBgEffect = memo(function WorkspaceBgEffect({ onFlightTileProjection }: WorkspaceBgEffectProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<WorkspaceSceneRuntime | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const offscreenRef = useRef(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const performance = useDevicePerformance();

  const tiles = useWorkspaceStore((state) => state.tiles);
  const viewportSize = useWorkspaceStore((state) => state.viewportSize);
  
  const sceneTheme = useWorkspaceStore((state) => state.sceneTheme);
  const sceneThemeAuto = useWorkspaceStore((state) => state.sceneThemeAuto);
  const sceneMode = useWorkspaceStore((state) => state.sceneMode);
  const sceneTerrainMode = useWorkspaceStore((state) => state.sceneTerrainMode);
  const sceneBgMode = useWorkspaceStore((state) => state.sceneBgMode);
  const setSceneTheme = useWorkspaceStore((state) => state.setSceneTheme);
  const setSceneThemeAuto = useWorkspaceStore((state) => state.setSceneThemeAuto);
  const setSceneMode = useWorkspaceStore((state) => state.setSceneMode);
  const setSceneTerrainMode = useWorkspaceStore((state) => state.setSceneTerrainMode);
  const setSceneBgMode = useWorkspaceStore((state) => state.setSceneBgMode);

  useEffect(() => {
    const syncLifecycle = () => useWorkspaceStore.getState().updateIdleTiles();
    syncLifecycle();
    const timerId = window.setInterval(syncLifecycle, 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || hasPersistedTerrainMode()) {
      return;
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applySystemPreference = (matches: boolean) => {
      useWorkspaceStore.getState().setSceneTerrainMode(matches ? 'calm' : 'full');
    };

    applySystemPreference(media.matches);
    const handleChange = (event: MediaQueryListEvent) => applySystemPreference(event.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !layerRef.current) {
      return;
    }

    const runtime = new WorkspaceSceneRuntime({
      canvas: canvasRef.current,
      host: layerRef.current,
      qualityProfile: performance,
      onFlightTileProjection,
    });
    runtimeRef.current = runtime;

    return () => {
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, [onFlightTileProjection, performance]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || controlsRef.current?.contains(target)) {
        return;
      }
      setControlsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setControlsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const node = layerRef.current;
    const runtime = runtimeRef.current;
    if (!node || !runtime) {
      return;
    }

    let frameHandle = 0;
    const resize = () => {
      frameHandle = 0;
      const w = node.clientWidth;
      const h = node.clientHeight;
      if (w > 0 && h > 0) {
        runtime.resize(w, h);
      }
    };
    const scheduleResize = () => {
      if (frameHandle) {
        cancelAnimationFrame(frameHandle);
      }
      frameHandle = requestAnimationFrame(resize);
    };
    scheduleResize();

    // Safety: re-check dimensions after layout settles (covers HMR, slow paint, etc.)
    const safetyTimer = window.setTimeout(scheduleResize, 200);

    const observer = new ResizeObserver(scheduleResize);
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearTimeout(safetyTimer);
      if (frameHandle) {
        cancelAnimationFrame(frameHandle);
      }
    };
  }, [sceneMode]);

  const sceneTiles = useMemo(
    () => getSceneTiles(tiles, viewportSize, null),
    [tiles, viewportSize],
  );

  useEffect(() => {
    runtimeRef.current?.setState({
      theme: sceneTheme,
      themeAuto: sceneThemeAuto,
      flightMode: sceneMode === 'flight',
      terrainMode: sceneTerrainMode,
      tiles: sceneTiles,
    });
  }, [sceneTheme, sceneThemeAuto, sceneMode, sceneTerrainMode, sceneTiles]);

  // Pause the 3D scene when tab is hidden
  // or when the browser tab is hidden (Page Visibility API).
  // The scene is fully invisible in both cases — no reason to burn GPU/CPU cycles.
  // Resume instantly when visible again (no cold-start cost — WebGL context stays alive).
  const tabHiddenRef = useRef(false);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    const shouldPause = tabHiddenRef.current || offscreenRef.current;
    if (shouldPause) {
      runtime.pause();
    } else {
      runtime.resume();
    }
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      tabHiddenRef.current = document.hidden;
      const runtime = runtimeRef.current;
      if (!runtime) return;

      const shouldPause = document.hidden || offscreenRef.current;
      if (shouldPause) {
        runtime.pause();
      } else {
        runtime.resume();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    if (sceneBgMode === 'photo') {
      runtime.pause();
    } else if (!tabHiddenRef.current && !offscreenRef.current) {
      runtime.resume();
    }
  }, [sceneBgMode]);

  useEffect(() => {
    const node = layerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        offscreenRef.current = !entry?.isIntersecting;
        const runtime = runtimeRef.current;
        if (!runtime) return;

        if (tabHiddenRef.current || offscreenRef.current) {
          runtime.pause();
        } else {
          runtime.resume();
        }
      },
      { threshold: 0.01 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Push hoveredTileId focus to scene without causing React re-renders.
  // Uses Zustand subscribe to bypass React reconciliation entirely.
  useEffect(() => {
    let prevHovered: string | null = useWorkspaceStore.getState().hoveredTileId;
    return useWorkspaceStore.subscribe((state) => {
      if (state.hoveredTileId === prevHovered) return;
      prevHovered = state.hoveredTileId;
      const runtime = runtimeRef.current;
      if (!runtime) return;
      // Update focus on hover
      runtime.setState({
        theme: state.sceneTheme,
        themeAuto: state.sceneThemeAuto,
        flightMode: state.sceneMode === 'flight',
        terrainMode: state.sceneTerrainMode,
        tiles: getSceneTiles(state.tiles, state.viewportSize, state.hoveredTileId),
      });
    });
  }, []);

  const theme = WORKSPACE_SCENE_THEMES[sceneTheme];
  const themeLabel = sceneThemeAuto ? 'Авто' : theme.label;
  const terrainModeLabel = sceneTerrainMode === 'void'
    ? 'Убрать анимацию'
    : sceneTerrainMode === 'calm'
      ? 'Спокойный'
      : 'Живой';
  const sceneStatus = sceneBgMode === 'photo'
    ? 'Фото фон'
    : `${themeLabel} • ${sceneMode === 'flight' ? 'Полёт' : 'Поверхность'} • ${terrainModeLabel}`;
  const sceneStyle = {
    '--scene-sky-top': theme.skyTop,
    '--scene-sky-bottom': theme.skyBottom,
    '--scene-hud-border': theme.hudBorder,
    '--scene-hud-fill': theme.hudFill,
    '--scene-hud-text': theme.hudText,
  } as CSSProperties;

  return (
    <>
      <div
        ref={layerRef}
        className={`${styles.workspaceBgLayer} ${sceneMode === 'flight' ? styles.workspaceBgLayerFlight : ''}`}
        style={sceneStyle}
        aria-hidden="true"
      >
        <canvas
          ref={canvasRef}
          className={styles.workspaceBgCanvas}
          style={sceneBgMode === 'photo' ? { visibility: 'hidden' } : undefined}
        />
        {sceneBgMode === 'photo' && (
          <div className={styles.workspaceBgPhoto} />
        )}
      </div>

      <div
        ref={controlsRef}
        className={styles.sceneControlDock}
        style={sceneStyle}
        data-scene-control="true"
        data-workspace-ui="true"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={styles.sceneControlToggle}
          onClick={() => setControlsOpen((value) => !value)}
          aria-expanded={controlsOpen}
          aria-controls="workspace-scene-controls"
        >
          <span className={styles.sceneControlMeta}>
            <span className={styles.sceneControlTitle}>
              <span
                className={styles.sceneControlIndicator}
                style={{ background: sceneTerrainMode === 'void' ? theme.shellGlow : sceneMode === 'flight' ? theme.shellGlow : theme.horizon }}
                aria-hidden="true"
              />
              Сцена
            </span>
            <span className={styles.sceneControlSub}>{sceneStatus}</span>
          </span>
          <ChevronLeft className={`${styles.sceneControlChevron} ${controlsOpen ? styles.sceneControlChevronOpen : ''}`} size={18} />
        </button>

        <div
          id="workspace-scene-controls"
          className={`${styles.sceneControlPanel} ${controlsOpen ? styles.sceneControlPanelOpen : ''}`}
        >
          <div className={styles.sceneControlHeader}>
            <div className={styles.sceneControlSectionTitle}>
              <CloudMoon size={16} />
              Атмосфера
            </div>
            <div className={styles.sceneControlSectionSub}>Управление интерактивной сценой workspace</div>
          </div>

          <div className={styles.sceneControlSection}>
            <div className={styles.sceneControlSectionTitle}>
              <Image size={16} />
              Фон
            </div>
            <div className={styles.sceneControlBgGrid}>
              <button
                type="button"
                className={`${styles.sceneControlTerrainButton} ${sceneBgMode === 'scene' ? styles.sceneControlTerrainButtonActive : ''}`}
                onClick={() => setSceneBgMode('scene')}
              >
                3D сцена
              </button>
              <button
                type="button"
                className={`${styles.sceneControlTerrainButton} ${sceneBgMode === 'photo' ? styles.sceneControlTerrainButtonActive : ''}`}
                onClick={() => setSceneBgMode('photo')}
              >
                Фото
              </button>
            </div>
          </div>

          <div className={styles.sceneControlThemeGrid}>
            <button
              type="button"
              className={`${styles.sceneControlThemeButton} ${sceneThemeAuto ? styles.sceneControlThemeButtonActive : ''}`}
              onClick={() => setSceneThemeAuto(true)}
            >
              <Clock size={14} />
              Авто
            </button>
            {WORKSPACE_SCENE_THEME_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`${styles.sceneControlThemeButton} ${!sceneThemeAuto && sceneTheme === option.id ? styles.sceneControlThemeButtonActive : ''}`}
                onClick={() => setSceneTheme(option.id)}
              >
                <Sparkles size={14} />
                {option.label}
              </button>
            ))}
          </div>

          <div className={styles.sceneControlSection}>
            <div className={styles.sceneControlSectionTitle}>
              <Sparkles size={16} />
              Ландшафт
            </div>
            <div className={styles.sceneControlTerrainGrid}>
              <button
                type="button"
                className={`${styles.sceneControlTerrainButton} ${sceneTerrainMode === 'full' ? styles.sceneControlTerrainButtonActive : ''}`}
                onClick={() => setSceneTerrainMode('full')}
              >
                Живой
              </button>
              <button
                type="button"
                className={`${styles.sceneControlTerrainButton} ${sceneTerrainMode === 'calm' ? styles.sceneControlTerrainButtonActive : ''}`}
                onClick={() => setSceneTerrainMode('calm')}
              >
                Спокойный
              </button>
              <button
                type="button"
                className={`${styles.sceneControlTerrainButton} ${styles.sceneControlTerrainButtonVoid} ${sceneTerrainMode === 'void' ? styles.sceneControlTerrainButtonActive : ''}`}
                onClick={() => setSceneTerrainMode('void')}
              >
                Убрать анимацию
              </button>
            </div>
            <div className={styles.sceneControlHint}>
              Спокойный режим замораживает океаническую болтанку. Режим «Убрать анимацию» драматично уводит рельеф вниз и затем так же собирает его обратно.
            </div>
          </div>

          <div className={styles.sceneControlSection}>
            <div className={styles.sceneControlSectionTitle}>
              <Plane size={16} />
              Навигация
            </div>
            <button
              type="button"
              className={`${styles.sceneControlFlightButton} ${sceneMode === 'flight' ? styles.sceneControlFlightButtonActive : ''}`}
              onClick={() => setSceneMode(sceneMode === 'flight' ? 'surface' : 'flight')}
            >
              {sceneMode === 'flight' ? 'Режим полёта: Вкл' : 'Режим полёта: Выкл'}
            </button>
            <div className={styles.sceneControlHint}>
              F: полёт, T: авто-тема, 1-5: темы, W A S D: движение, Space / Shift: вверх и вниз, мышь: обзор.
            </div>
          </div>
        </div>
      </div>
    </>
  );
});
