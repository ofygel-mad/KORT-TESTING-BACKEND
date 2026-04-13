import * as THREE from 'three';
import { WORKSPACE_SCENE_FLIGHT_TILE_TUNING } from './sceneConfig';
import type { WorkspaceSceneThemeDefinition } from './sceneConfig';
import { clamp } from './sceneHelpers';
import { TERRAIN_RADIUS, WORLD_UP } from './sceneConstants';
import type {
  WorkspaceSceneFlightTileProjection,
  WorkspaceSceneTileDescriptor,
  WorkspaceSceneRuntimeState,
} from './sceneTypes';
import type { WorkspaceSceneTerrainController } from './sceneTerrainController';

type FlightTileAnchorRuntime = {
  descriptor: WorkspaceSceneTileDescriptor;
  wallAngleOffset: number;
  wallHeight: number;
  sourceLocalX: number;
  sourceLocalY: number;
  sourceLift: number;
  bandScale: number;
  bandOpacity: number;
  bandBlur: number;
  bandOrder: number;
};

// ── Margin constants for visibility checks ────────────────────────────────
const MARGIN_X = 320;
const MARGIN_Y = 220;
const DISTANCE_SCALE_REF = 92;
const DISTANCE_SCALE_MIN = 0.58;
const DISTANCE_SCALE_MAX = 1.12;
const EDGE_FADE_X_THRESHOLD = 0.74;
const EDGE_FADE_X_STEEPNESS = 1.9;
const EDGE_FADE_Y_THRESHOLD = 0.68;
const EDGE_FADE_Y_STEEPNESS = 2.3;
const BLEND_DECAY_RATE = 5.4;

function normalizeAngle(angle: number) {
  let normalized = angle;
  while (normalized <= -Math.PI) normalized += Math.PI * 2;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  return normalized;
}

function shortestAngleDelta(target: number, source: number) {
  return normalizeAngle(target - source);
}

export interface FlightTileProjectionControllerOptions {
  camera: THREE.PerspectiveCamera;
  terrainGroup: THREE.Group;
  host: HTMLElement;
  getTerrainController: () => WorkspaceSceneTerrainController;
  getThemeTarget: () => WorkspaceSceneThemeDefinition;
  getState: () => WorkspaceSceneRuntimeState;
  onFlightTileProjection: ((tiles: WorkspaceSceneFlightTileProjection[]) => void) | null;
}

export class FlightTileProjectionController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly terrainGroup: THREE.Group;
  private readonly host: HTMLElement;
  private readonly getTerrainController: () => WorkspaceSceneTerrainController;
  private readonly getThemeTarget: () => WorkspaceSceneThemeDefinition;
  private readonly getState: () => WorkspaceSceneRuntimeState;
  private readonly onFlightTileProjection: ((tiles: WorkspaceSceneFlightTileProjection[]) => void) | null;

  private readonly anchors = new Map<string, FlightTileAnchorRuntime>();
  private readonly projected: WorkspaceSceneFlightTileProjection[] = [];
  private readonly sourcePoint = new THREE.Vector3();
  private readonly sourceNormal = new THREE.Vector3();
  private readonly targetPoint = new THREE.Vector3();
  private readonly projectedPoint = new THREE.Vector3();
  private readonly clipPoint = new THREE.Vector3();
  private readonly localCamPos = new THREE.Vector3();
  private readonly localFwdPoint = new THREE.Vector3();
  private readonly localFwdDir = new THREE.Vector3();

  private blend = 0;
  private wallYaw = 0;
  private wallTargetYaw = 0;

  constructor(options: FlightTileProjectionControllerOptions) {
    this.camera = options.camera;
    this.terrainGroup = options.terrainGroup;
    this.host = options.host;
    this.getTerrainController = options.getTerrainController;
    this.getThemeTarget = options.getThemeTarget;
    this.getState = options.getState;
    this.onFlightTileProjection = options.onFlightTileProjection;
  }

  syncAnchors(
    previousTiles: WorkspaceSceneTileDescriptor[],
    nextTiles: WorkspaceSceneTileDescriptor[],
    themeChanged: boolean,
  ) {
    if (!nextTiles.length) {
      this.anchors.clear();
      return;
    }

    if (themeChanged || this.shouldRebuild(previousTiles, nextTiles)) {
      this.rebuild(nextTiles);
      return;
    }

    nextTiles.forEach((tile) => {
      const anchor = this.anchors.get(tile.id);
      if (anchor) anchor.descriptor = tile;
    });
  }

  onFlightModeChanged(enabled: boolean) {
    this.blend = 0;
    if (enabled) {
      this.captureWallYaw();
    } else {
      this.onFlightTileProjection?.([]);
    }
  }

  update(delta: number) {
    if (!this.onFlightTileProjection) return;

    const state = this.getState();

    // Lerp blend toward flight mode target
    this.blend += ((state.flightMode ? 1 : 0) - this.blend) * (1 - Math.exp(-BLEND_DECAY_RATE * delta));

    if (!state.flightMode || !this.anchors.size) {
      this.onFlightTileProjection([]);
      return;
    }

    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (width <= 0 || height <= 0) {
      this.onFlightTileProjection([]);
      return;
    }

    const tuning = WORKSPACE_SCENE_FLIGHT_TILE_TUNING[this.getThemeTarget().id];
    this.updateWallYaw(delta);
    this.projected.length = 0;
    const wallRadius = TERRAIN_RADIUS * tuning.wallRadius;

    this.anchors.forEach((anchor) => {
      this.getTerrainController().sampleTerrainPoint(
        anchor.sourceLocalX,
        anchor.sourceLocalY,
        this.sourcePoint,
        this.sourceNormal,
      );
      this.sourcePoint.addScaledVector(WORLD_UP, anchor.sourceLift);

      const wallAngle = this.wallYaw + anchor.wallAngleOffset;
      this.targetPoint.set(
        Math.sin(wallAngle) * wallRadius,
        Math.cos(wallAngle) * wallRadius,
        anchor.wallHeight,
      );
      this.terrainGroup.localToWorld(this.targetPoint);

      this.projectedPoint.copy(this.sourcePoint).lerp(this.targetPoint, this.blend);
      this.clipPoint.copy(this.projectedPoint).project(this.camera);

      const left = (this.clipPoint.x * 0.5 + 0.5) * width;
      const top = (-this.clipPoint.y * 0.5 + 0.5) * height;
      const inFront = this.clipPoint.z > -1 && this.clipPoint.z < 1;
      const withinMargin = left > -MARGIN_X && left < width + MARGIN_X && top > -MARGIN_Y && top < height + MARGIN_Y;
      const visible = inFront && withinMargin;
      const distance = this.camera.position.distanceTo(this.projectedPoint);
      const focusBoost = anchor.descriptor.isFocused ? 0.06 : 0;
      const distanceScale = clamp(DISTANCE_SCALE_REF / distance, DISTANCE_SCALE_MIN, DISTANCE_SCALE_MAX);
      const edgeFadeX = clamp(1 - Math.max(0, Math.abs(this.clipPoint.x) - EDGE_FADE_X_THRESHOLD) * EDGE_FADE_X_STEEPNESS, 0, 1);
      const edgeFadeY = clamp(1 - Math.max(0, Math.abs(this.clipPoint.y) - EDGE_FADE_Y_THRESHOLD) * EDGE_FADE_Y_STEEPNESS, 0, 1);
      const opacity = visible
        ? clamp(anchor.bandOpacity * edgeFadeX * edgeFadeY - (1 - edgeFadeX * edgeFadeY) * tuning.edgeOpacityDecay + focusBoost, 0, 1)
        : 0;
      const blur = anchor.bandBlur + (1 - edgeFadeX * edgeFadeY) * tuning.edgeBlurGain + (visible ? 0 : 0.8);
      const zIndex = anchor.bandOrder * 100 + Math.round(clamp(320 - distance, 0, 180));

      this.projected.push({
        id: anchor.descriptor.id,
        left,
        top,
        scale: anchor.bandScale * distanceScale + focusBoost + (anchor.descriptor.isPinned ? tuning.pinnedScaleBoost : 0),
        opacity,
        blur,
        zIndex,
        visible,
      });
    });

    this.onFlightTileProjection(this.projected);
  }

  dispose() {
    this.onFlightTileProjection?.([]);
    this.anchors.clear();
  }

  // ── Private ────────────────────────────────────────────────────────────

  private shouldRebuild(
    previousTiles: WorkspaceSceneTileDescriptor[],
    nextTiles: WorkspaceSceneTileDescriptor[],
  ) {
    if (previousTiles.length !== nextTiles.length || this.anchors.size !== nextTiles.length) {
      return true;
    }

    const previousById = new Map(previousTiles.map((tile) => [tile.id, tile]));
    for (const tile of nextTiles) {
      const prev = previousById.get(tile.id);
      if (!prev || !this.anchors.has(tile.id) || !this.hasStableLayout(prev, tile)) {
        return true;
      }
    }
    return false;
  }

  private hasStableLayout(prev: WorkspaceSceneTileDescriptor, next: WorkspaceSceneTileDescriptor) {
    return prev.distance3D === next.distance3D
      && prev.normalizedX === next.normalizedX
      && prev.normalizedY === next.normalizedY
      && prev.isPinned === next.isPinned;
  }

  private rebuild(tiles: WorkspaceSceneTileDescriptor[]) {
    this.anchors.clear();
    if (!tiles.length) return;

    const themeTuning = WORKSPACE_SCENE_FLIGHT_TILE_TUNING[this.getThemeTarget().id];
    const buckets = {
      far: tiles.filter((t) => t.distance3D === 'far'),
      mid: tiles.filter((t) => t.distance3D === 'mid'),
      near: tiles.filter((t) => t.distance3D === 'near'),
    };

    (Object.keys(buckets) as Array<keyof typeof buckets>).forEach((distance) => {
      const bucket = [...buckets[distance]].sort((a, b) => {
        if (a.normalizedX !== b.normalizedX) return a.normalizedX - b.normalizedX;
        return (a.isPinned === b.isPinned) ? a.id.localeCompare(b.id) : (a.isPinned ? -1 : 1);
      });

      const style = themeTuning[distance];
      const arcOffsets = this.buildArcOffsets(bucket.length, style.wallArc);

      bucket.forEach((tile, index) => {
        const sourceLocalX = clamp(tile.normalizedX * TERRAIN_RADIUS * 0.42, -TERRAIN_RADIUS * 0.48, TERRAIN_RADIUS * 0.48);
        const sourceLocalY = clamp(18 + tile.normalizedY * TERRAIN_RADIUS * 0.18, -TERRAIN_RADIUS * 0.18, TERRAIN_RADIUS * 0.42);
        this.anchors.set(tile.id, {
          descriptor: tile,
          wallAngleOffset: arcOffsets[index] ?? 0,
          wallHeight: style.wallHeight,
          sourceLocalX,
          sourceLocalY,
          sourceLift: style.sourceLift,
          bandScale: style.scale,
          bandOpacity: style.opacity,
          bandBlur: style.blur,
          bandOrder: distance === 'far' ? 1 : distance === 'mid' ? 2 : 3,
        });
      });
    });
  }

  private buildArcOffsets(count: number, halfArc: number) {
    if (count <= 0) return [];
    if (count === 1) return [0];
    return Array.from({ length: count }, (_, i) => {
      const normalized = i / (count - 1);
      const centered = normalized * 2 - 1;
      const shaped = Math.sign(centered) * Math.pow(Math.abs(centered), 0.84);
      return shaped * halfArc;
    });
  }

  private captureWallYaw() {
    const yaw = this.getLocalCameraForwardYaw();
    this.wallTargetYaw = this.snapWallYaw(yaw);
    this.wallYaw = this.wallTargetYaw;
  }

  private updateWallYaw(delta: number) {
    if (!this.getState().flightMode) return;

    const tuning = WORKSPACE_SCENE_FLIGHT_TILE_TUNING[this.getThemeTarget().id];
    const forwardYaw = this.getLocalCameraForwardYaw();
    const snappedYaw = this.snapWallYaw(forwardYaw);
    const targetDelta = Math.abs(shortestAngleDelta(snappedYaw, this.wallTargetYaw));
    const forwardDelta = Math.abs(shortestAngleDelta(forwardYaw, this.wallTargetYaw));

    if (targetDelta > 0.001 && forwardDelta >= tuning.wallSwitchThreshold) {
      this.wallTargetYaw = snappedYaw;
    }

    const blend = 1 - Math.exp(-tuning.wallSwitchBlendSpeed * delta);
    this.wallYaw = normalizeAngle(
      this.wallYaw + shortestAngleDelta(this.wallTargetYaw, this.wallYaw) * blend,
    );
  }

  private getLocalCameraForwardYaw() {
    this.localCamPos.copy(this.camera.position);
    this.localFwdPoint.copy(this.camera.position);
    this.camera.getWorldDirection(this.localFwdDir);
    this.localFwdPoint.add(this.localFwdDir);

    this.terrainGroup.worldToLocal(this.localCamPos);
    this.terrainGroup.worldToLocal(this.localFwdPoint);
    this.localFwdDir.copy(this.localFwdPoint).sub(this.localCamPos);

    if (this.localFwdDir.lengthSq() < 0.0001) return this.wallYaw;
    return Math.atan2(this.localFwdDir.x, this.localFwdDir.y);
  }

  private snapWallYaw(yaw: number) {
    const walls = [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5];
    let closest = walls[0];
    let closestDelta = Infinity;
    for (const wallYaw of walls) {
      const d = Math.abs(shortestAngleDelta(yaw, wallYaw));
      if (d < closestDelta) {
        closestDelta = d;
        closest = wallYaw;
      }
    }
    return closest;
  }
}
