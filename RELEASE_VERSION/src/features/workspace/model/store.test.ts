import { describe, expect, it } from 'vitest';
import {
  ZOOM_MAX,
  clampTileToViewportBounds,
  clampTileToWorldBounds,
  clampViewportToBounds,
  getTileViewportBounds,
  getVisibleWorldRect,
  sanitizeWorkspacePersistedState,
} from './store';

describe('sanitizeWorkspacePersistedState', () => {
  it('drops unsupported tiles and normalizes malformed persisted values', () => {
    const state = sanitizeWorkspacePersistedState({
      tiles: [
        {
          id: 'legacy-summary',
          kind: 'summary',
          title: 'Legacy Summary',
          x: 40,
          y: 20,
          width: 240,
          height: 155,
          modalSize: 'default',
          version: 1,
          createdAt: '2026-03-18T00:00:00.000Z',
        },
        {
          id: 'tasks-1',
          kind: 'tasks',
          title: '',
          x: Number.NaN,
          y: 35,
          width: 0,
          height: Number.POSITIVE_INFINITY,
          modalSize: 'huge',
          version: 0,
          createdAt: 'invalid-date',
          distance3D: 'near',
          pinned: 'yes',
          zIndex: -5,
        },
      ],
      viewport: { x: 'bad', y: 15 },
      viewportReady: 'yes',
      zoom: 999,
      topZIndex: -10,
    });

    expect(state.tiles).toHaveLength(1);
    expect(state.tiles[0]).toMatchObject({
      id: 'tasks-1',
      kind: 'tasks',
      distance3D: 'mid',
      x: 20,
      y: 35,
      width: 260,
      height: 210,
      modalSize: 'default',
      version: 2,
      status: 'floating',
      rotation3D: { x: -0.03, y: 0, z: 0 },
      pinned: false,
      zIndex: 1,
    });
    expect(state.tiles[0].createdAt).toEqual(expect.any(String));
    expect(state.tiles[0].lastInteractionAt).toEqual(expect.any(String));
    expect(state.viewport).toEqual({ x: 0, y: 15 });
    expect(state.viewportReady).toBe(false);
    expect(state.zoom).toBe(ZOOM_MAX);
    expect(state.topZIndex).toBe(10);
  });

  it('returns safe defaults when persisted state is absent', () => {
    const state = sanitizeWorkspacePersistedState(undefined);

    expect(state).toEqual({
      tiles: [],
      viewport: { x: 0, y: 0 },
      viewportReady: false,
      zoom: 1,
      topZIndex: 10,
      sceneTheme: 'morning',
      sceneTerrainMode: 'full',
      sceneBgMode: 'photo',
    });
  });

  it('migrates legacy production shortcuts away from Chapan', () => {
    const state = sanitizeWorkspacePersistedState({
      tiles: [
        {
          id: 'chapan-legacy',
          kind: 'chapan',
          title: 'Производство',
          x: 40,
          y: 20,
          width: 260,
          height: 170,
          modalSize: 'default',
          version: 1,
          createdAt: '2026-03-18T00:00:00.000Z',
          lastInteractionAt: '2026-03-18T00:00:00.000Z',
        },
      ],
    });

    expect(state.tiles[0]).toMatchObject({
      kind: 'production',
      title: 'Производство',
      version: 2,
    });
  });

  it('keeps current Chapan shortcuts intact', () => {
    const state = sanitizeWorkspacePersistedState({
      tiles: [
        {
          id: 'chapan-current',
          kind: 'chapan',
          title: 'Чапан',
          x: 40,
          y: 20,
          width: 260,
          height: 170,
          modalSize: 'default',
          version: 2,
          createdAt: '2026-03-18T00:00:00.000Z',
          lastInteractionAt: '2026-03-18T00:00:00.000Z',
        },
      ],
    });

    expect(state.tiles[0]).toMatchObject({
      kind: 'chapan',
      title: 'Чапан',
      version: 2,
    });
  });

  it('clamps viewport and tile positions to the current workspace bounds', () => {
    const viewport = clampViewportToBounds({ x: -5000, y: 120 }, 800, 600);
    const tile = clampTileToWorldBounds(
      {
        id: 'tile-1',
        kind: 'tasks',
        title: 'Tasks',
        x: 2600,
        y: 1900,
        width: 260,
        height: 170,
        modalSize: 'default',
        version: 1,
        createdAt: '2026-03-18T00:00:00.000Z',
        lastInteractionAt: '2026-03-18T00:00:00.000Z',
        status: 'floating',
        rotation3D: { x: -0.03, y: 0, z: 0 },
        distance3D: 'mid',
        pinned: false,
        zIndex: 10,
      },
      800,
      600,
    );

    expect(viewport).toEqual({ x: -1600, y: 0 });
    expect(tile.x).toBe(2140);
    expect(tile.y).toBe(1630);
  });

  it('uses zoom-aware viewport limits and visible workspace bounds', () => {
    const viewport = clampViewportToBounds({ x: -5000, y: -5000 }, 800, 600, 1.5);
    const visible = getVisibleWorldRect({ x: -900, y: -450 }, { width: 1200, height: 800 }, 1.5);
    const tileBounds = getTileViewportBounds(
      { x: -900, y: -450 },
      { width: 1200, height: 800 },
      1.5,
      { width: 260, height: 170 },
    );

    expect(viewport).toEqual({ x: -2800, y: -2100 });
    expect(visible).toEqual({
      left: 600,
      top: 300,
      right: 1400,
      bottom: 833.3333333333334,
      width: 800,
      height: 533.3333333333334,
    });
    expect(tileBounds).toEqual({
      minX: 600,
      maxX: 1140,
      minY: 300,
      maxY: 663.3333333333334,
    });
  });

  it('clamps dragged tiles to the visible viewport in surface mode', () => {
    const position = clampTileToViewportBounds(
      { x: 1400, y: 900, width: 260, height: 170 },
      { x: -900, y: -450 },
      { width: 1200, height: 800 },
      1.5,
    );

    expect(position).toEqual({
      x: 1140,
      y: 663.3333333333334,
    });
  });
});
