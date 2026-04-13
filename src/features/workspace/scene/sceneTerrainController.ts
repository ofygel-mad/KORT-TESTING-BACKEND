import * as THREE from 'three';
import type { ImpactWave, TerrainInfluence, WorkspaceSceneRuntimeState } from './sceneTypes';
import { clamp, easeOutCubic, terrainMotion } from './sceneHelpers';
import { getFieldPositionForTile } from './sceneShells';
import { trimExpiredWavesInPlace } from './sceneTerrain';
import {
  DOWN,
  TERRAIN_RADIUS,
  TERRAIN_SURFACE_VISIBLE_RADIUS,
  TERRAIN_Y_OFFSET,
  WORLD_UP,
} from './sceneConstants';

interface WorkspaceSceneTerrainControllerOptions {
  camera: THREE.PerspectiveCamera;
  terrainGroup: THREE.Group;
  surface: THREE.Mesh;
  invisiblePlane: THREE.Mesh;
  raycaster: THREE.Raycaster;
  positions: THREE.BufferAttribute;
  baseX: Float32Array;
  baseY: Float32Array;
  initialZ: Float32Array;
  fogInteractionPoints: THREE.Vector3[];
  fogInteractionWeights: number[];
  waves: ImpactWave[];
  pointer: THREE.Vector2;
  peakBeaconIndices: Uint32Array;
  peakBeaconPositionsAttribute: THREE.BufferAttribute;
  peakBeaconIntensityAttribute: THREE.BufferAttribute;
  getPointerInfluenceActive: () => boolean;
  getState: () => WorkspaceSceneRuntimeState;
  getFrameCount: () => number;
}

export type TerrainVisualState = {
  visibility: number;
  collapseProgress: number;
  motionFactor: number;
  collapsePulse: number;
  fullyCollapsed: boolean;
  staticRest: boolean;
};

export class WorkspaceSceneTerrainController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly terrainGroup: THREE.Group;
  private readonly surface: THREE.Mesh;
  private readonly invisiblePlane: THREE.Mesh;
  private readonly raycaster: THREE.Raycaster;
  private positions: THREE.BufferAttribute;
  private baseX: Float32Array;
  private baseY: Float32Array;
  private initialZ: Float32Array;
  private readonly fogInteractionPoints: THREE.Vector3[];
  private readonly fogInteractionWeights: number[];
  private readonly waves: ImpactWave[];
  private readonly pointer: THREE.Vector2;
  private readonly peakBeaconIndices: Uint32Array;
  private readonly peakBeaconPositionsAttribute: THREE.BufferAttribute;
  private readonly peakBeaconIntensityAttribute: THREE.BufferAttribute;
  private readonly getPointerInfluenceActive: () => boolean;
  private readonly getState: () => WorkspaceSceneRuntimeState;
  private readonly getFrameCount: () => number;
  private readonly terrainLocalPointer = new THREE.Vector3(9999, 9999, 0);
  private readonly terrainLocalPosition = new THREE.Vector3();
  private readonly terrainWorldPosition = new THREE.Vector3();
  private readonly terrainProbeOrigin = new THREE.Vector3();
  private readonly terrainProbePoint = new THREE.Vector3();
  private readonly terrainProbeNormal = new THREE.Vector3();
  private readonly normalMatrix = new THREE.Matrix3();
  private readonly projectedRayOrigin = new THREE.Vector3();
  private readonly terrainLocalPointerTarget = new THREE.Vector3(9999, 9999, 0);
  private peakBeaconsEnabled = true;
  private amplitudePulse = 1.0;
  private pointerInfluenceStrength = 0;
  private readonly influencePool: TerrainInfluence[] = [];
  private static readonly EMPTY_INFLUENCES: TerrainInfluence[] = [];
  private terrainMode: WorkspaceSceneRuntimeState['terrainMode'];
  private transitionActive = false;
  private transitionStartedAt = 0;
  private transitionDuration = 0;
  private collapseProgress = 0;
  private collapseFrom = 0;
  private collapseTo = 0;
  private visibility = 1;
  private visibilityFrom = 1;
  private visibilityTo = 1;
  private motionFactor = 1;
  private motionFrom = 1;
  private motionTo = 1;
  private collapsePulse = 0;
  private geometryDirty = false;

  constructor(options: WorkspaceSceneTerrainControllerOptions) {
    this.camera = options.camera;
    this.terrainGroup = options.terrainGroup;
    this.surface = options.surface;
    this.invisiblePlane = options.invisiblePlane;
    this.raycaster = options.raycaster;
    this.positions = options.positions;
    this.baseX = options.baseX;
    this.baseY = options.baseY;
    this.initialZ = options.initialZ;
    this.fogInteractionPoints = options.fogInteractionPoints;
    this.fogInteractionWeights = options.fogInteractionWeights;
    this.waves = options.waves;
    this.pointer = options.pointer;
    this.peakBeaconIndices = options.peakBeaconIndices;
    this.peakBeaconPositionsAttribute = options.peakBeaconPositionsAttribute;
    this.peakBeaconIntensityAttribute = options.peakBeaconIntensityAttribute;
    this.getPointerInfluenceActive = options.getPointerInfluenceActive;
    this.getState = options.getState;
    this.getFrameCount = options.getFrameCount;
    this.terrainMode = options.getState().terrainMode;
    this.visibility = this.terrainMode === 'void' ? 0 : 1;
    this.collapseProgress = this.terrainMode === 'void' ? 1 : 0;
    this.motionFactor = this.terrainMode === 'full' ? 1 : 0;
    this.visibilityFrom = this.visibility;
    this.visibilityTo = this.visibility;
    this.collapseFrom = this.collapseProgress;
    this.collapseTo = this.collapseProgress;
    this.motionFrom = this.motionFactor;
    this.motionTo = this.motionFactor;
  }

  setAmplitudePulse(v: number) {
    this.amplitudePulse = v;
  }

  swapGeometry(
    positions: THREE.BufferAttribute,
    baseX: Float32Array,
    baseY: Float32Array,
    initialZ: Float32Array,
  ) {
    this.positions = positions;
    this.baseX = baseX;
    this.baseY = baseY;
    this.initialZ = initialZ;
    this.geometryDirty = true;
  }

  setTerrainMode(mode: WorkspaceSceneRuntimeState['terrainMode'], time: number) {
    this.syncTerrainState(time);
    this.terrainMode = mode;

    const nextCollapse = mode === 'void' ? 1 : 0;
    const nextVisibility = mode === 'void' ? 0 : 1;
    const nextMotion = mode === 'full' ? 1 : 0;

    if (
      Math.abs(this.collapseProgress - nextCollapse) < 0.001
      && Math.abs(this.visibility - nextVisibility) < 0.001
      && Math.abs(this.motionFactor - nextMotion) < 0.001
    ) {
      this.transitionActive = false;
      this.collapseProgress = nextCollapse;
      this.visibility = nextVisibility;
      this.motionFactor = nextMotion;
      this.geometryDirty = true;
      return;
    }

    this.transitionActive = true;
    this.transitionStartedAt = time;
    this.transitionDuration = mode === 'void' ? 3.6 : this.visibility < 0.999 ? 3.9 : 1.05;
    this.collapseFrom = this.collapseProgress;
    this.collapseTo = nextCollapse;
    this.visibilityFrom = this.visibility;
    this.visibilityTo = nextVisibility;
    this.motionFrom = this.motionFactor;
    this.motionTo = nextMotion;
    this.geometryDirty = true;
  }

  getVisualState(time?: number): TerrainVisualState {
    if (typeof time === 'number') {
      this.syncTerrainState(time);
    }

    return {
      visibility: this.visibility,
      collapseProgress: this.collapseProgress,
      motionFactor: this.motionFactor,
      collapsePulse: this.collapsePulse,
      fullyCollapsed: this.isFullyCollapsed(),
      staticRest: this.isStaticRest(),
    };
  }

  updateTerrain(time: number) {
    this.syncTerrainState(time);

    const state = this.getState();
    const frameCount = this.getFrameCount();
    const querySuppressed = this.isTerrainQuerySuppressed();
    const fullyCollapsedRest = this.isFullyCollapsed() && !this.transitionActive;
    const allowMotion = this.motionFactor > 0.001 || this.collapseProgress > 0.001 || this.transitionActive;
    const staticFrame = (!allowMotion || fullyCollapsedRest) && !this.geometryDirty;

    if (this.terrainMode === 'full' && this.getPointerInfluenceActive() && !querySuppressed) {
      this.updatePointerInfluence();
    } else {
      this.clearPointerInfluence();
    }

    this.terrainLocalPosition.copy(this.camera.position);
    this.terrainGroup.worldToLocal(this.terrainLocalPosition);
    const cameraInsideTerrain = Math.hypot(this.terrainLocalPosition.x, this.terrainLocalPosition.y) < TERRAIN_RADIUS * 1.06;
    const latestWave = this.waves.length ? this.waves[this.waves.length - 1] : null;
    const latestWaveAge = latestWave ? time - latestWave.startedAt : 999;
    const hasPointerInfluence = this.terrainMode === 'full' && this.hasPointerInfluence();
    const fogStrength = this.visibility * (this.terrainMode === 'void' ? 0.42 : this.terrainMode === 'calm' ? 0.18 : 1);
    const fogInfluences = [
      hasPointerInfluence ? { point: this.terrainLocalPointer, weight: fogStrength } : null,
      cameraInsideTerrain ? { point: this.terrainLocalPosition, weight: (state.flightMode ? 0.95 : 0.35) * fogStrength } : null,
      latestWave && latestWaveAge <= 2.8 && this.motionFactor > 0.08
        ? { point: latestWave.localPoint, weight: Math.max(0, 1 - latestWaveAge / 2.8) * fogStrength }
        : null,
    ];

    for (let index = 0; index < this.fogInteractionPoints.length; index += 1) {
      const influence = fogInfluences[index];
      if (influence) {
        this.fogInteractionPoints[index].copy(influence.point);
        this.fogInteractionWeights[index] += (influence.weight - this.fogInteractionWeights[index]) * 0.16;
      } else {
        this.fogInteractionPoints[index].set(9999, 9999, 0);
        this.fogInteractionWeights[index] += (0 - this.fogInteractionWeights[index]) * 0.16;
      }
    }

    if (staticFrame) {
      trimExpiredWavesInPlace(this.waves, time, 2.8);
      return;
    }

    const forceNormalUpdate = this.geometryDirty;
    const influences = this.collectTerrainInfluences(time, state.flightMode);
    const isSurface = !state.flightMode;
    const camLX = this.terrainLocalPosition.x;
    const camLY = this.terrainLocalPosition.y;
    const surfaceVisibleSq = TERRAIN_SURFACE_VISIBLE_RADIUS * TERRAIN_SURFACE_VISIBLE_RADIUS;
    const motionAmplitude = this.motionFactor * this.amplitudePulse * (1 - this.collapseProgress * 0.56);
    const collapseFront = THREE.MathUtils.lerp(TERRAIN_RADIUS * 1.08, -TERRAIN_RADIUS * 1.08, this.collapseProgress);

    for (let index = 0; index < this.positions.count; index += 1) {
      const baseX = this.baseX[index];
      const baseY = this.baseY[index];

      if (isSurface && this.collapseProgress < 0.001 && motionAmplitude > 0.001) {
        const dxCam = baseX - camLX;
        const dyCam = baseY - camLY;
        if (dxCam * dxCam + dyCam * dyCam > surfaceVisibleSq) {
          this.positions.setXYZ(index, baseX, baseY, this.initialZ[index]);
          continue;
        }
      }

      const radialDistance = Math.hypot(baseX, baseY);
      const edgeBlend = THREE.MathUtils.smoothstep(radialDistance, TERRAIN_RADIUS * 0.72, TERRAIN_RADIUS);
      const edgeFactor = THREE.MathUtils.smoothstep(radialDistance, TERRAIN_RADIUS * 0.54, TERRAIN_RADIUS * 0.98);
      const baseMotion = motionAmplitude > 0.001
        ? terrainMotion(baseX, baseY, time, isSurface) * motionAmplitude
        : 0;

      let nextX = baseX;
      let nextY = baseY;
      let z = this.initialZ[index] + baseMotion * (1 - edgeBlend * 0.58) - edgeBlend * 7.8;

      if (motionAmplitude > 0.001) {
        for (const influence of influences) {
          const dx = baseX - influence.localPoint.x;
          const dy = baseY - influence.localPoint.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= influence.radius) {
            continue;
          }

          const force = Math.pow((influence.radius - dist) / influence.radius, 2.05);
          const ripple = Math.sin(dist * 0.64 - time * influence.wobble) * influence.ripple;
          z -= force * (influence.depth + ripple) * (1 - edgeBlend * 0.72) * this.motionFactor;
        }

        for (const wave of this.waves) {
          const waveAge = time - wave.startedAt;
          const dx = baseX - wave.localPoint.x;
          const dy = baseY - wave.localPoint.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const waveFront = waveAge * 21;
          const waveWidth = 10 + wave.strength * 4;
          const envelope = Math.exp(-Math.pow((dist - waveFront) / waveWidth, 2));
          const decay = Math.max(0, 1 - waveAge / 2.8) * this.motionFactor;
          const ring = Math.sin((dist - waveFront) * 0.34) * envelope * 4.2 * wave.strength * decay;
          const crater = -Math.max(0, 1 - dist / (14 + wave.strength * 10))
            * Math.max(0, 1 - waveAge / 0.32)
            * 3.4
            * wave.strength
            * this.motionFactor;
          z += (ring + crater) * (1 - edgeBlend * 0.7);
        }
      }

      if (this.collapseProgress > 0.001) {
        const fractureNoise = (
          Math.sin(baseX * 0.078 + baseY * 0.051 + index * 0.013)
          + Math.cos(baseX * 0.031 - baseY * 0.063 + index * 0.007)
        ) * 0.5;
        const fractureOffset = fractureNoise * 10.5 + edgeFactor * 7.2 - (1 - edgeFactor) * 3.4;
        const frontBand = 5.2 + edgeFactor * 6.8;
        const collapse = THREE.MathUtils.smoothstep(baseY + fractureOffset, collapseFront - frontBand, collapseFront + frontBand);
        const collapseForce = collapse * collapse;
        const collapseDeep = Math.pow(collapse, 3.2);
        const frontCrackle = Math.max(0, 1 - Math.abs(collapse - 0.5) * 2) * (0.52 + edgeFactor * 0.48);
        const crumble = frontCrackle * (0.66 + Math.sin(time * 14 + index * 0.17) * 0.34) * this.collapsePulse;
        const driftSign = fractureNoise >= 0 ? 1 : -1;

        nextX += fractureNoise * collapseForce * collapseForce * 7.4 + driftSign * collapseForce * (1.8 + edgeFactor * 5.2);
        nextY += collapseForce * (2.4 + edgeFactor * 10.5) + fractureNoise * collapseForce * 4.2;
        z -= collapseForce * (18 + edgeFactor * 42) + collapseDeep * 120;
        z -= crumble * (4.8 + edgeFactor * 7.2);
        z -= (1 - edgeBlend * 0.55) * frontCrackle * this.collapsePulse * 3.6;
      }

      this.positions.setXYZ(index, nextX, nextY, z);
    }

    this.positions.needsUpdate = true;
    this.geometryDirty = false;

    if (this.peakBeaconsEnabled && !state.flightMode && this.visibility > 0.06 && frameCount % 3 === 0) {
      this.updatePeakBeacons();
    }

    if (forceNormalUpdate || (allowMotion && frameCount % 4 === 0)) {
      const geometry = this.surface.geometry as THREE.BufferGeometry;
      geometry.computeVertexNormals();
    }

    trimExpiredWavesInPlace(this.waves, time, 2.8);
  }

  private updatePeakBeacons() {
    const peakBeaconPositions = this.peakBeaconPositionsAttribute.array as Float32Array;
    const peakBeaconIntensity = this.peakBeaconIntensityAttribute.array as Float32Array;

    for (let index = 0; index < this.peakBeaconIndices.length; index += 1) {
      const vertexIndex = this.peakBeaconIndices[index];
      const x = this.positions.getX(vertexIndex);
      const y = this.positions.getY(vertexIndex);
      const z = this.positions.getZ(vertexIndex);
      const radial = Math.hypot(this.baseX[vertexIndex], this.baseY[vertexIndex]);
      const edgeFade = 1 - THREE.MathUtils.smoothstep(radial, TERRAIN_RADIUS * 0.72, TERRAIN_RADIUS * 0.96);
      const peakSignal = THREE.MathUtils.smoothstep(z, 4.2, 8.9) * edgeFade;
      const nextIntensity = peakSignal * peakSignal * 0.92 * this.visibility;

      peakBeaconIntensity[index] += (nextIntensity - peakBeaconIntensity[index]) * 0.14;
      const i3 = index * 3;
      peakBeaconPositions[i3] = x;
      peakBeaconPositions[i3 + 1] = y;
      peakBeaconPositions[i3 + 2] = z + 0.22 + peakBeaconIntensity[index] * 0.34;
    }

    this.peakBeaconPositionsAttribute.needsUpdate = true;
    this.peakBeaconIntensityAttribute.needsUpdate = true;
  }

  sampleTerrainPoint(localX: number, localY: number, outPoint: THREE.Vector3, outNormal: THREE.Vector3) {
    if (this.isTerrainQuerySuppressed()) {
      this.setFlatSampleFallback(localX, localY, outPoint, outNormal);
      return;
    }

    this.terrainProbeOrigin.set(localX, localY, 140);
    this.terrainGroup.localToWorld(this.terrainProbeOrigin);
    this.raycaster.set(this.terrainProbeOrigin, DOWN);
    const hits = this.raycaster.intersectObject(this.surface, false);

    if (!hits.length) {
      this.setFlatSampleFallback(localX, localY, outPoint, outNormal);
      return;
    }

    outPoint.copy(hits[0].point);
    if (hits[0].face) {
      this.normalMatrix.getNormalMatrix(this.surface.matrixWorld);
      outNormal.copy(hits[0].face.normal).applyMatrix3(this.normalMatrix).normalize();
    } else {
      outNormal.copy(WORLD_UP);
    }
  }

  getTerrainPointBelow(worldPosition: THREE.Vector3, outPoint: THREE.Vector3, outNormal: THREE.Vector3) {
    if (this.isTerrainQuerySuppressed()) {
      this.setFlatWorldFallback(worldPosition, outPoint, outNormal);
      return true;
    }

    this.terrainProbeOrigin.copy(worldPosition);
    this.terrainProbeOrigin.y += 240;
    this.raycaster.set(this.terrainProbeOrigin, DOWN);
    const hits = this.raycaster.intersectObject(this.surface, false);

    if (!hits.length) {
      return false;
    }

    outPoint.copy(hits[0].point);
    if (hits[0].face) {
      this.normalMatrix.getNormalMatrix(this.surface.matrixWorld);
      outNormal.copy(hits[0].face.normal).applyMatrix3(this.normalMatrix).normalize();
    } else {
      outNormal.copy(WORLD_UP);
    }
    return true;
  }

  projectAlongDirection(
    worldOrigin: THREE.Vector3,
    worldDirection: THREE.Vector3,
    fallbackPoint: THREE.Vector3,
    fallbackNormal: THREE.Vector3,
    outPoint: THREE.Vector3,
    outNormal: THREE.Vector3,
  ) {
    if (this.isTerrainQuerySuppressed()) {
      outPoint.copy(fallbackPoint);
      outNormal.copy(fallbackNormal);
      return false;
    }

    this.projectedRayOrigin.copy(worldOrigin).addScaledVector(worldDirection, -0.3);
    this.raycaster.set(this.projectedRayOrigin, worldDirection);
    const hits = this.raycaster.intersectObject(this.surface, false);

    if (!hits.length) {
      outPoint.copy(fallbackPoint);
      outNormal.copy(fallbackNormal);
      return false;
    }

    outPoint.copy(hits[0].point);
    if (hits[0].face) {
      this.normalMatrix.getNormalMatrix(this.surface.matrixWorld);
      outNormal.copy(hits[0].face.normal).applyMatrix3(this.normalMatrix).normalize();
    } else {
      outNormal.copy(fallbackNormal);
    }
    return true;
  }

  pushImpactWave(worldPoint: THREE.Vector3, strength: number, time: number) {
    if (this.motionFactor < 0.08 || this.terrainMode !== 'full') {
      return;
    }

    const localPoint = this.terrainGroup.worldToLocal(worldPoint.clone());
    this.waves.push({
      localPoint,
      startedAt: time,
      strength,
    });
  }

  clampCameraAboveTerrainPlane(worldPosition: THREE.Vector3, minLocalHeight: number) {
    this.terrainLocalPosition.copy(worldPosition);
    this.terrainGroup.worldToLocal(this.terrainLocalPosition);

    if (this.terrainLocalPosition.z < minLocalHeight) {
      this.terrainLocalPosition.z = minLocalHeight;
      this.terrainGroup.localToWorld(this.terrainWorldPosition.copy(this.terrainLocalPosition));
      worldPosition.copy(this.terrainWorldPosition);
    }
  }

  clampCameraAboveSurface(worldPosition: THREE.Vector3, clearance: number) {
    if (!this.getTerrainPointBelow(worldPosition, this.terrainProbePoint, this.terrainProbeNormal)) {
      this.clampCameraAboveTerrainPlane(worldPosition, clearance);
      return;
    }

    worldPosition.y = Math.max(worldPosition.y, this.terrainProbePoint.y + clearance);
  }

  getCameraLocalHeight() {
    this.terrainLocalPosition.copy(this.camera.position);
    this.terrainGroup.worldToLocal(this.terrainLocalPosition);
    return this.terrainLocalPosition.z;
  }

  getPointerWorldPoint(outPoint: THREE.Vector3) {
    if (!this.hasPointerInfluence()) {
      return false;
    }

    outPoint.copy(this.terrainLocalPointer);
    this.terrainGroup.localToWorld(outPoint);
    return true;
  }

  hasPointerInfluence() {
    return Number.isFinite(this.terrainLocalPointer.x)
      && Number.isFinite(this.terrainLocalPointer.y)
      && Math.hypot(this.terrainLocalPointer.x, this.terrainLocalPointer.y) < TERRAIN_RADIUS * 0.92;
  }

  setPeakBeaconsEnabled(enabled: boolean) {
    this.peakBeaconsEnabled = enabled;
  }

  private syncTerrainState(time: number) {
    if (!this.transitionActive) {
      this.collapsePulse = 0;
      return;
    }

    const progress = clamp((time - this.transitionStartedAt) / this.transitionDuration, 0, 1);
    const collapseEase = this.collapseTo > this.collapseFrom
      ? Math.pow(progress, 0.82)
      : 1 - Math.pow(1 - progress, 2.4);
    const visibilityProgress = this.visibilityTo < this.visibilityFrom
      ? clamp((progress - 0.1) / 0.72, 0, 1)
      : clamp((progress - 0.04) / 0.84, 0, 1);
    const motionDelay = this.motionTo > this.motionFrom ? 0.58 : 0;
    const motionProgress = clamp((progress - motionDelay) / (1 - motionDelay), 0, 1);

    this.collapseProgress = THREE.MathUtils.lerp(this.collapseFrom, this.collapseTo, collapseEase);
    this.visibility = THREE.MathUtils.lerp(this.visibilityFrom, this.visibilityTo, easeOutCubic(visibilityProgress));
    this.motionFactor = THREE.MathUtils.lerp(this.motionFrom, this.motionTo, easeOutCubic(motionProgress));
    this.collapsePulse = Math.sin(progress * Math.PI) * (this.collapseTo > this.collapseFrom ? 1 : 0.72);

    if (progress >= 1) {
      this.transitionActive = false;
      this.collapseProgress = this.collapseTo;
      this.visibility = this.visibilityTo;
      this.motionFactor = this.motionTo;
      this.collapsePulse = 0;
    }
  }

  private isTerrainQuerySuppressed() {
    return this.terrainMode === 'void' || (this.isFullyCollapsed() && !this.transitionActive);
  }

  private isFullyCollapsed() {
    return this.visibility < 0.01 && this.collapseProgress > 0.995;
  }

  private isStaticRest() {
    return this.visibility > 0.99 && this.collapseProgress < 0.005 && this.motionFactor < 0.005;
  }

  private setFlatSampleFallback(localX: number, localY: number, outPoint: THREE.Vector3, outNormal: THREE.Vector3) {
    outPoint.set(localX, TERRAIN_Y_OFFSET, localY);
    outNormal.copy(WORLD_UP);
  }

  private setFlatWorldFallback(worldPosition: THREE.Vector3, outPoint: THREE.Vector3, outNormal: THREE.Vector3) {
    outPoint.set(worldPosition.x, TERRAIN_Y_OFFSET, worldPosition.z);
    outNormal.copy(WORLD_UP);
  }

  private updatePointerInfluence() {
    if (!this.getPointerInfluenceActive()) {
      this.clearPointerInfluence();
      return;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.invisiblePlane, false);
    if (!hits.length) {
      this.clearPointerInfluence();
      return;
    }

    this.terrainLocalPointerTarget.copy(hits[0].point);
    this.terrainGroup.worldToLocal(this.terrainLocalPointerTarget);

    const radialDistance = Math.hypot(this.terrainLocalPointerTarget.x, this.terrainLocalPointerTarget.y);
    if (radialDistance > TERRAIN_RADIUS * 0.84 || Math.abs(this.terrainLocalPointerTarget.z) > 14) {
      this.clearPointerInfluence();
      return;
    }

    if (!this.hasPointerInfluence()) {
      this.terrainLocalPointer.copy(this.terrainLocalPointerTarget);
    } else {
      this.terrainLocalPointer.lerp(this.terrainLocalPointerTarget, 0.4);
    }

    this.terrainLocalPointer.z = 0;
    this.pointerInfluenceStrength = 1;
  }

  private clearPointerInfluence() {
    this.terrainLocalPointer.set(9999, 9999, 0);
    this.terrainLocalPointerTarget.set(9999, 9999, 0);
    this.pointerInfluenceStrength = 0;
  }

  private getPooledInfluence(index: number): TerrainInfluence {
    if (index < this.influencePool.length) {
      return this.influencePool[index];
    }
    const influence: TerrainInfluence = {
      localPoint: new THREE.Vector3(),
      radius: 0,
      depth: 0,
      ripple: 0,
      wobble: 0,
    };
    this.influencePool.push(influence);
    return influence;
  }

  private collectTerrainInfluences(time: number, flightMode: boolean) {
    if (this.terrainMode !== 'full' || this.motionFactor < 0.05) {
      return WorkspaceSceneTerrainController.EMPTY_INFLUENCES;
    }

    let count = 0;

    if (this.hasPointerInfluence() && this.pointerInfluenceStrength > 0.025) {
      const inf = this.getPooledInfluence(count);
      inf.localPoint = this.terrainLocalPointer;
      inf.radius = flightMode ? 30 : 38;
      inf.depth = flightMode ? 6.2 : 9.4;
      inf.ripple = flightMode ? 0.9 : 1.35;
      inf.wobble = flightMode ? 8.2 : 8.8;
      count += 1;
    }

    const tiles = this.getState().tiles;
    for (let index = 0; index < tiles.length; index += 1) {
      const tile = tiles[index];
      const field = getFieldPositionForTile(tile);
      const createdAt = Date.parse(tile.createdAt);
      const introAge = Number.isNaN(createdAt) ? 999 : (Date.now() - createdAt) / 1000;
      const introProgress = clamp(introAge / 1.9, 0, 1);
      const introStrength = introProgress < 1 ? Math.pow(1 - introProgress, 2.1) : 0;
      const focusBoost = tile.isFocused ? 0.12 : 0;
      const pinnedBoost = tile.isPinned ? 0.06 : 0;
      const wobbleSeed = tile.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const inf = this.getPooledInfluence(count);
      inf.localPoint.set(field.x, field.y, 0);
      inf.radius = 5.4 + field.depth * 0.8 + introStrength * 9.5;
      inf.depth = 0.34 + field.depth * 0.085 + introStrength * 2.2 + focusBoost + pinnedBoost;
      inf.ripple = 0.06 + introStrength * 0.32;
      inf.wobble = 4.6 + (wobbleSeed % 37) * 0.16 + index * 0.03;
      count += 1;
    }

    // Return a view of the pool up to `count` entries (no allocation)
    return this.influencePool.slice(0, count);
  }
}
