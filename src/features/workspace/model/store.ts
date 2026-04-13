import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { WORKSPACE_WIDGETS } from '../registry';
import type {
  WorkspaceEuler3D,
  WorkspaceModalSize,
  WorkspaceSceneBgMode,
  WorkspaceSceneMode,
  WorkspaceSceneTerrainMode,
  WorkspaceSceneTheme,
  WorkspaceTile,
  WorkspaceTileStatus,
  WorkspaceViewport,
  WorkspaceWidgetKind,
} from './types';

export const WORLD_FACTOR = 3;
export const ZOOM_MIN = 0.35;
export const ZOOM_MAX = 1.8;
export const ZOOM_STEP = 0.08;
export const WORKSPACE_TILE_IDLE_MS = 15_000;
export const WORKSPACE_TILE_VERSION = 2;

const VALID_WIDGET_KINDS = new Set<WorkspaceWidgetKind>(
  WORKSPACE_WIDGETS.map((widget) => widget.kind),
);
const VALID_MODAL_SIZES = new Set<WorkspaceModalSize>(['compact', 'default', 'wide']);
const VALID_SCENE_THEMES = new Set<WorkspaceSceneTheme>(['default', 'morning', 'overcast', 'dusk', 'night']);
const VALID_SCENE_TERRAIN_MODES = new Set<WorkspaceSceneTerrainMode>(['full', 'calm', 'void']);
const VALID_SCENE_BG_MODES = new Set<WorkspaceSceneBgMode>(['scene', 'photo']);
const VALID_TILE_STATUSES = new Set<WorkspaceTileStatus>(['floating', 'drifting', 'idle']);

const TILE_SIZE = { width: 260, height: 210 };

const DEFAULT_TILE_SIZE: Record<WorkspaceWidgetKind, { width: number; height: number }> = {
  leads: TILE_SIZE,
  deals: TILE_SIZE,
  customers: TILE_SIZE,
  tasks: TILE_SIZE,
  warehouse: TILE_SIZE,
  production: TILE_SIZE,
  finance: TILE_SIZE,
  employees: TILE_SIZE,
  reports: TILE_SIZE,
  documents: TILE_SIZE,
  chapan: TILE_SIZE,
};

const TITLES = Object.fromEntries(
  WORKSPACE_WIDGETS.map((widget) => [widget.kind, widget.title]),
) as Record<WorkspaceWidgetKind, string>;

export const TILE_NAV = Object.fromEntries(
  WORKSPACE_WIDGETS.map((widget) => [widget.kind, widget.navTo]),
) as Record<WorkspaceWidgetKind, string>;

interface ContextMenuState {
  tileId: string;
  x: number;
  y: number;
}

interface PersistedWorkspaceState {
  tiles?: unknown;
  viewport?: unknown;
  viewportReady?: unknown;
  zoom?: unknown;
  topZIndex?: unknown;
  sceneTheme?: unknown;
  sceneTerrainMode?: unknown;
  sceneBgMode?: unknown;
}

interface WorkspaceStore {
  tiles: WorkspaceTile[];
  viewport: WorkspaceViewport;
  viewportSize: { width: number; height: number };
  viewportReady: boolean;
  hoveredTileId: string | null;
  zoom: number;
  contextMenu: ContextMenuState | null;
  topZIndex: number;
  sceneTheme: WorkspaceSceneTheme;
  sceneThemeAuto: boolean;
  sceneMode: WorkspaceSceneMode;
  sceneTerrainMode: WorkspaceSceneTerrainMode;
  sceneBgMode: WorkspaceSceneBgMode;
  addTile: (kind: WorkspaceWidgetKind) => string;
  alignTilesToGrid: () => void;
  setTilePosition: (id: string, x: number, y: number) => void;
  bringToFront: (id: string) => void;
  removeTile: (id: string) => void;
  renameTile: (id: string, title: string) => void;
  toggleTilePinned: (id: string) => void;
  setViewport: (x: number, y: number) => void;
  initializeViewport: (width: number, height: number) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setHoveredTile: (id: string | null) => void;
  markTileActive: (
    id: string,
    opts?: { rotation3D?: Partial<WorkspaceEuler3D>; status?: WorkspaceTileStatus },
  ) => void;
  updateIdleTiles: () => void;
  openContextMenu: (tileId: string, x: number, y: number) => void;
  closeContextMenu: () => void;
  setSceneTheme: (theme: WorkspaceSceneTheme) => void;
  setSceneThemeAuto: (auto: boolean) => void;
  setSceneMode: (mode: WorkspaceSceneMode) => void;
  setSceneTerrainMode: (mode: WorkspaceSceneTerrainMode) => void;
  setSceneBgMode: (mode: WorkspaceSceneBgMode) => void;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

function isWorkspaceWidgetKind(v: unknown): v is WorkspaceWidgetKind {
  return typeof v === 'string' && VALID_WIDGET_KINDS.has(v as WorkspaceWidgetKind);
}

function isWorkspaceModalSize(v: unknown): v is WorkspaceModalSize {
  return typeof v === 'string' && VALID_MODAL_SIZES.has(v as WorkspaceModalSize);
}

function isWorkspaceSceneTheme(v: unknown): v is WorkspaceSceneTheme {
  return typeof v === 'string' && VALID_SCENE_THEMES.has(v as WorkspaceSceneTheme);
}

function isWorkspaceSceneTerrainMode(v: unknown): v is WorkspaceSceneTerrainMode {
  return typeof v === 'string' && VALID_SCENE_TERRAIN_MODES.has(v as WorkspaceSceneTerrainMode);
}

function isWorkspaceSceneBgMode(v: unknown): v is WorkspaceSceneBgMode {
  return typeof v === 'string' && VALID_SCENE_BG_MODES.has(v as WorkspaceSceneBgMode);
}

function isWorkspaceTileStatus(v: unknown): v is WorkspaceTileStatus {
  return typeof v === 'string' && VALID_TILE_STATUSES.has(v as WorkspaceTileStatus);
}

function toFiniteNumber(v: unknown, fb: number) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fb;
}

function toPositiveNumber(v: unknown, fb: number) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fb;
}

function toIsoString(v: unknown, fb: string) {
  return typeof v === 'string' && !Number.isNaN(new Date(v).getTime()) ? v : fb;
}

function nowIsoString() {
  return new Date().toISOString();
}

function deriveTile3DRotation(status: WorkspaceTileStatus): WorkspaceEuler3D {
  if (status === 'drifting') return { x: -0.14, y: 0.12, z: -0.04 };
  if (status === 'idle') return { x: -0.08, y: 0.02, z: 0 };
  return { x: -0.03, y: 0, z: 0 };
}

function sanitizeEuler3D(v: unknown, fb: WorkspaceEuler3D): WorkspaceEuler3D {
  if (!v || typeof v !== 'object') return fb;
  const next = v as Partial<WorkspaceEuler3D>;
  return {
    x: toFiniteNumber(next.x, fb.x),
    y: toFiniteNumber(next.y, fb.y),
    z: toFiniteNumber(next.z, fb.z),
  };
}

function getWorldBounds(width: number, height: number) {
  return {
    width: Math.max(0, width * WORLD_FACTOR),
    height: Math.max(0, height * WORLD_FACTOR),
  };
}

function clampAxisWithinWorld(value: number, size: number, worldSize: number) {
  return clamp(value, 0, Math.max(0, worldSize - size));
}

export function getVisibleWorldRect(
  viewport: WorkspaceViewport,
  viewportSize: { width: number; height: number },
  zoom: number,
) {
  const world = getWorldBounds(viewportSize.width, viewportSize.height);
  const safeZoom = Math.max(zoom, 0.001);
  const left = clamp(-viewport.x / safeZoom, 0, world.width);
  const top = clamp(-viewport.y / safeZoom, 0, world.height);
  const right = clamp((viewportSize.width - viewport.x) / safeZoom, 0, world.width);
  const bottom = clamp((viewportSize.height - viewport.y) / safeZoom, 0, world.height);

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export function getTileViewportBounds(
  viewport: WorkspaceViewport,
  viewportSize: { width: number; height: number },
  zoom: number,
  tileSize: { width: number; height: number },
) {
  const world = getWorldBounds(viewportSize.width, viewportSize.height);
  const visible = getVisibleWorldRect(viewport, viewportSize, zoom);
  const maxX = Math.max(0, world.width - tileSize.width);
  const maxY = Math.max(0, world.height - tileSize.height);
  const minX = clamp(visible.left, 0, maxX);
  const minY = clamp(visible.top, 0, maxY);
  const visibleMaxX = clamp(visible.right - tileSize.width, 0, maxX);
  const visibleMaxY = clamp(visible.bottom - tileSize.height, 0, maxY);

  return {
    minX: Math.min(minX, visibleMaxX),
    maxX: Math.max(minX, visibleMaxX),
    minY: Math.min(minY, visibleMaxY),
    maxY: Math.max(minY, visibleMaxY),
  };
}

export function clampViewportToBounds(
  viewport: WorkspaceViewport,
  width: number,
  height: number,
  zoom = 1,
): WorkspaceViewport {
  const world = getWorldBounds(width, height);
  return {
    x: clamp(viewport.x, Math.min(0, width - world.width * zoom), 0),
    y: clamp(viewport.y, Math.min(0, height - world.height * zoom), 0),
  };
}

export function clampTileToWorldBounds(tile: WorkspaceTile, width: number, height: number): WorkspaceTile {
  const world = getWorldBounds(width, height);
  const nextX = clampAxisWithinWorld(tile.x, tile.width, world.width);
  const nextY = clampAxisWithinWorld(tile.y, tile.height, world.height);
  if (nextX === tile.x && nextY === tile.y) return tile;
  return { ...tile, x: nextX, y: nextY };
}

export function clampTileToViewportBounds(
  tile: Pick<WorkspaceTile, 'x' | 'y' | 'width' | 'height'>,
  viewport: WorkspaceViewport,
  viewportSize: { width: number; height: number },
  zoom: number,
) {
  const bounds = getTileViewportBounds(viewport, viewportSize, zoom, tile);
  return {
    x: clamp(tile.x, bounds.minX, bounds.maxX),
    y: clamp(tile.y, bounds.minY, bounds.maxY),
  };
}

function sanitizeTile(raw: unknown, fallbackZIndex: number): WorkspaceTile | null {
  if (!raw || typeof raw !== 'object') return null;

  const tile = raw as Partial<WorkspaceTile>;
  if (!isWorkspaceWidgetKind(tile.kind)) return null;

  const version = Math.max(1, Math.round(toFiniteNumber(tile.version, 1)));
  const isLegacyProductionShortcut = tile.kind === 'chapan' && version < WORKSPACE_TILE_VERSION;
  const kind: WorkspaceWidgetKind = isLegacyProductionShortcut ? 'production' : tile.kind;
  const size = DEFAULT_TILE_SIZE[kind];
  const fallbackCreatedAt = nowIsoString();
  const zIndex = Math.max(1, Math.round(toFiniteNumber(tile.zIndex, fallbackZIndex)));
  const status = isWorkspaceTileStatus(tile.status) ? tile.status : 'floating';
  const legacyTitle = typeof tile.title === 'string' ? tile.title.trim() : '';
  const title = isLegacyProductionShortcut ? TITLES.production : legacyTitle || TITLES[kind];

  return {
    id: typeof tile.id === 'string' && tile.id.trim() ? tile.id : nanoid(),
    kind,
    title,
    x: Math.max(0, toFiniteNumber(tile.x, 20)),
    y: Math.max(0, toFiniteNumber(tile.y, 20)),
    width: size.width,
    height: size.height,
    modalSize: isWorkspaceModalSize(tile.modalSize) ? tile.modalSize : 'default',
    version: Math.max(WORKSPACE_TILE_VERSION, version),
    createdAt: toIsoString(tile.createdAt, fallbackCreatedAt),
    lastInteractionAt: toIsoString(tile.lastInteractionAt, fallbackCreatedAt),
    status,
    rotation3D: sanitizeEuler3D(tile.rotation3D, deriveTile3DRotation(status)),
    distance3D: 'mid',
    pinned: typeof tile.pinned === 'boolean' ? tile.pinned : false,
    zIndex,
  };
}

function sanitizeTiles(raw: unknown): WorkspaceTile[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((tile, index) => sanitizeTile(tile, 10 + index))
    .filter((tile): tile is WorkspaceTile => tile !== null);
}

function sanitizeViewport(raw: unknown): WorkspaceViewport {
  if (!raw || typeof raw !== 'object') return { x: 0, y: 0 };
  const viewport = raw as Partial<WorkspaceViewport>;
  return {
    x: toFiniteNumber(viewport.x, 0),
    y: toFiniteNumber(viewport.y, 0),
  };
}

export function sanitizeWorkspacePersistedState(persistedRaw: unknown) {
  const persisted = (persistedRaw ?? {}) as PersistedWorkspaceState;
  const tiles = sanitizeTiles(persisted.tiles);

  return {
    tiles,
    viewport: sanitizeViewport(persisted.viewport),
    viewportReady: typeof persisted.viewportReady === 'boolean' ? persisted.viewportReady : false,
    zoom: clamp(toFiniteNumber(persisted.zoom, 1), ZOOM_MIN, ZOOM_MAX),
    topZIndex: Math.max(
      10,
      Math.round(toFiniteNumber(persisted.topZIndex, 10)),
      tiles.reduce((max, tile) => Math.max(max, tile.zIndex ?? 10), 10),
    ),
    sceneTheme: isWorkspaceSceneTheme(persisted.sceneTheme) ? persisted.sceneTheme : 'morning',
    sceneTerrainMode: isWorkspaceSceneTerrainMode(persisted.sceneTerrainMode)
      ? persisted.sceneTerrainMode
      : 'full',
    sceneBgMode: isWorkspaceSceneBgMode(persisted.sceneBgMode) ? persisted.sceneBgMode : 'photo',
  };
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      tiles: [],
      viewport: { x: 0, y: 0 },
      viewportSize: { width: 0, height: 0 },
      viewportReady: false,
      hoveredTileId: null,
      zoom: 1,
      contextMenu: null,
      topZIndex: 10,
      sceneTheme: 'morning',
      sceneThemeAuto: false,
      sceneMode: 'surface',
      sceneTerrainMode: 'full',
      sceneBgMode: 'photo',
      addTile: (kind) => {
        const { viewport, viewportSize, topZIndex, zoom } = get();
        const size = DEFAULT_TILE_SIZE[kind];
        const visible = getVisibleWorldRect(viewport, viewportSize, zoom);
        const bounds = getTileViewportBounds(viewport, viewportSize, zoom, size);
        const scatter = get().tiles.length;
        const id = nanoid();
        const newZIndex = topZIndex + 1;
        const createdAt = nowIsoString();
        const x = clamp(
          visible.left + visible.width / 2 - size.width / 2 + (scatter % 4) * 24 - 36,
          bounds.minX,
          bounds.maxX,
        );
        const y = clamp(
          visible.top + visible.height / 2 - size.height / 2 + Math.floor(scatter / 4) * 24 - 12,
          bounds.minY,
          bounds.maxY,
        );

        const tile: WorkspaceTile = {
          id,
          kind,
          title: TITLES[kind],
          x,
          y,
          width: size.width,
          height: size.height,
          modalSize: 'default',
          version: WORKSPACE_TILE_VERSION,
          createdAt,
          lastInteractionAt: createdAt,
          status: 'floating',
          rotation3D: deriveTile3DRotation('floating'),
          distance3D: 'mid',
          pinned: false,
          zIndex: newZIndex,
        };

        set((state) => ({ tiles: [...state.tiles, tile], topZIndex: newZIndex }));
        return id;
      },
      alignTilesToGrid: () => {
        const { tiles, viewport, viewportSize, zoom } = get();
        if (!tiles.length || viewportSize.width <= 0) return;

        const maxTileWidth = Math.max(...tiles.map((tile) => tile.width));
        const maxTileHeight = Math.max(...tiles.map((tile) => tile.height));
        const gap = 24;
        const padding = 20;
        const cols = Math.max(
          1,
          Math.floor((viewportSize.width - padding * 2 + gap) / (maxTileWidth + gap)),
        );
        const worldWidth = viewportSize.width * WORLD_FACTOR;
        const worldHeight = viewportSize.height * WORLD_FACTOR;
        const visible = getVisibleWorldRect(viewport, viewportSize, zoom);
        const startX = clamp(visible.left + padding, 0, Math.max(0, worldWidth - maxTileWidth));
        const startY = clamp(visible.top + padding, 0, Math.max(0, worldHeight - maxTileHeight));

        set((state) => ({
          tiles: state.tiles.map((tile, index) => ({
            ...tile,
            x: clamp(
              startX + (index % cols) * (maxTileWidth + gap),
              0,
              Math.max(0, worldWidth - tile.width),
            ),
            y: clamp(
              startY + Math.floor(index / cols) * (maxTileHeight + gap),
              0,
              Math.max(0, worldHeight - tile.height),
            ),
          })),
        }));
      },
      setTilePosition: (id, x, y) =>
        set((state) => {
          const target = state.tiles.find((tile) => tile.id === id);
          if (!target) return state;

          const status: WorkspaceTileStatus = target.pinned ? 'idle' : 'floating';
          const pos =
            state.viewportSize.width > 0 && state.viewportSize.height > 0 && state.sceneMode !== 'flight'
              ? clampTileToViewportBounds({ ...target, x, y }, state.viewport, state.viewportSize, state.zoom)
              : clampTileToWorldBounds({ ...target, x, y }, state.viewportSize.width, state.viewportSize.height);

          const PUSH_GAP = 14;
          const dx = pos.x;
          const dy = pos.y;
          const dw = target.width;
          const dh = target.height;

          const tiles = state.tiles.map((tile) => {
            if (tile.id === id) {
              return { ...tile, x: pos.x, y: pos.y, lastInteractionAt: nowIsoString(), status, rotation3D: deriveTile3DRotation(status) };
            }
            if (tile.pinned) return tile;

            const ox = Math.min(dx + dw, tile.x + tile.width) - Math.max(dx, tile.x);
            const oy = Math.min(dy + dh, tile.y + tile.height) - Math.max(dy, tile.y);
            if (ox <= 0 || oy <= 0) return tile;

            const dcx = dx + dw / 2;
            const dcy = dy + dh / 2;
            const tcx = tile.x + tile.width / 2;
            const tcy = tile.y + tile.height / 2;

            let nx = tile.x;
            let ny = tile.y;
            if (ox < oy) {
              nx = tcx > dcx ? dx + dw + PUSH_GAP : dx - tile.width - PUSH_GAP;
            } else {
              ny = tcy > dcy ? dy + dh + PUSH_GAP : dy - tile.height - PUSH_GAP;
            }
            nx = Math.max(0, nx);
            ny = Math.max(0, ny);
            if (nx === tile.x && ny === tile.y) return tile;
            return { ...tile, x: nx, y: ny };
          });

          return { tiles, contextMenu: state.contextMenu?.tileId === id ? null : state.contextMenu };
        }),
      bringToFront: (id) => {
        const newZIndex = get().topZIndex + 1;
        set((state) => ({
          tiles: state.tiles.map((tile) =>
            tile.id === id
              ? {
                  ...tile,
                  zIndex: newZIndex,
                  lastInteractionAt: nowIsoString(),
                  status: 'floating',
                  rotation3D: deriveTile3DRotation('floating'),
                }
              : tile,
          ),
          topZIndex: newZIndex,
        }));
      },
      removeTile: (id) =>
        set((state) => ({
          tiles: state.tiles.filter((tile) => tile.id !== id),
          hoveredTileId: state.hoveredTileId === id ? null : state.hoveredTileId,
          contextMenu: state.contextMenu?.tileId === id ? null : state.contextMenu,
        })),
      renameTile: (id, title) =>
        set((state) => ({
          tiles: state.tiles.map((tile) =>
            tile.id === id ? { ...tile, title: title.trim() || tile.title } : tile,
          ),
        })),
      toggleTilePinned: (id) =>
        set((state) => ({
          tiles: state.tiles.map((tile) => {
            if (tile.id !== id) return tile;
            const pinned = !tile.pinned;
            const status: WorkspaceTileStatus = pinned ? 'idle' : 'floating';
            return {
              ...tile,
              pinned,
              lastInteractionAt: nowIsoString(),
              status,
              rotation3D: deriveTile3DRotation(status),
            };
          }),
        })),
      setViewport: (x, y) =>
        set((state) => ({
          viewport: clampViewportToBounds({ x, y }, state.viewportSize.width, state.viewportSize.height, state.zoom),
        })),
      initializeViewport: (width, height) =>
        set((state) => ({
          viewportSize: { width, height },
          viewport: clampViewportToBounds(
            state.viewportReady ? state.viewport : { x: 0, y: 0 },
            width,
            height,
            state.zoom,
          ),
          tiles:
            width > 0 && height > 0
              ? state.tiles.map((tile) => clampTileToWorldBounds(tile, width, height))
              : state.tiles,
          viewportReady: true,
        })),
      setZoom: (zoom) =>
        set((state) => {
          const nextZoom = clamp(zoom, ZOOM_MIN, ZOOM_MAX);
          return {
            zoom: nextZoom,
            viewport: clampViewportToBounds(
              state.viewport,
              state.viewportSize.width,
              state.viewportSize.height,
              nextZoom,
            ),
          };
        }),
      zoomIn: () =>
        set((state) => {
          const nextZoom = clamp(+(state.zoom + ZOOM_STEP).toFixed(2), ZOOM_MIN, ZOOM_MAX);
          return {
            zoom: nextZoom,
            viewport: clampViewportToBounds(
              state.viewport,
              state.viewportSize.width,
              state.viewportSize.height,
              nextZoom,
            ),
          };
        }),
      zoomOut: () =>
        set((state) => {
          const nextZoom = clamp(+(state.zoom - ZOOM_STEP).toFixed(2), ZOOM_MIN, ZOOM_MAX);
          return {
            zoom: nextZoom,
            viewport: clampViewportToBounds(
              state.viewport,
              state.viewportSize.width,
              state.viewportSize.height,
              nextZoom,
            ),
          };
        }),
      resetZoom: () =>
        set((state) => ({
          zoom: 1,
          viewport: clampViewportToBounds(
            state.viewport,
            state.viewportSize.width,
            state.viewportSize.height,
            1,
          ),
        })),
      setHoveredTile: (id) => set({ hoveredTileId: id }),
      markTileActive: (id, opts) =>
        set((state) => {
          const target = state.tiles.find((tile) => tile.id === id);
          if (!target) return state;

          const nextStatus = opts?.status ?? 'floating';
          if (target.status === nextStatus && !opts?.rotation3D) {
            return state;
          }

          return {
            tiles: state.tiles.map((tile) =>
              tile.id !== id
                ? tile
                : {
                    ...tile,
                    lastInteractionAt: nowIsoString(),
                    status: nextStatus,
                    rotation3D: { ...deriveTile3DRotation(nextStatus), ...opts?.rotation3D },
                  },
            ),
          };
        }),
      updateIdleTiles: () =>
        set((state) => {
          const now = Date.now();
          let changed = false;

          const tiles = state.tiles.map((tile) => {
            const elapsed = now - new Date(tile.lastInteractionAt).getTime();
            const nextStatus: WorkspaceTileStatus = tile.pinned
              ? 'idle'
              : elapsed >= WORKSPACE_TILE_IDLE_MS
              ? 'drifting'
              : 'floating';

            if (nextStatus === tile.status) {
              return tile;
            }

            changed = true;
            return {
              ...tile,
              status: nextStatus,
              rotation3D: deriveTile3DRotation(nextStatus),
            };
          });

          return changed ? { tiles } : state;
        }),
      openContextMenu: (tileId, x, y) => set({ contextMenu: { tileId, x, y } }),
      closeContextMenu: () => set({ contextMenu: null }),
      setSceneTheme: (sceneTheme) => set({ sceneTheme, sceneThemeAuto: false }),
      setSceneThemeAuto: (sceneThemeAuto) => set({ sceneThemeAuto }),
      setSceneMode: (sceneMode) => set({ sceneMode }),
      setSceneTerrainMode: (sceneTerrainMode) => set({ sceneTerrainMode }),
      setSceneBgMode: (sceneBgMode) => set({ sceneBgMode }),
    }),
    {
      name: 'kort-workspace',
      partialize: (state) => ({
        tiles: state.tiles,
        viewport: state.viewport,
        viewportReady: state.viewportReady,
        zoom: state.zoom,
        topZIndex: state.topZIndex,
        sceneTheme: state.sceneTheme,
        sceneTerrainMode: state.sceneTerrainMode,
        sceneBgMode: state.sceneBgMode,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...sanitizeWorkspacePersistedState(persisted),
      }),
    },
  ),
);
