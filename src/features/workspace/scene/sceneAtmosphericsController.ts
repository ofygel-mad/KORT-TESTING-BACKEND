import * as THREE from 'three';
import { PARTICLE_COUNT, RAIN_COUNT } from './sceneConstants';
import type { WorkspaceSceneThemeDefinition } from './sceneConfig';
import type { WorkspaceSceneTerrainController } from './sceneTerrainController';

// ── Particle wrap boundaries ────────────────────────────────────────────────
const PARTICLE_WRAP_X_MIN = -120;
const PARTICLE_WRAP_X_MAX = 120;
const PARTICLE_WRAP_Y_MAX = 60;
const PARTICLE_WRAP_Y_MIN = -10;
const PARTICLE_WRAP_Z_MAX = 70;
const PARTICLE_WRAP_Z_MIN = -70;
const PARTICLE_INFLUENCE_RADIUS_SQ = 400;
const PARTICLE_INFLUENCE_FORCE = 0.06;
const PARTICLE_RETURN_SPEED = 0.04;

// ── Rain constants ──────────────────────────────────────────────────────────
const RAIN_SPREAD = 170;
const RAIN_CEILING = 32;
const RAIN_CEILING_VARIANCE = 64;
const RAIN_PROXIMITY = 112;

export interface SceneAtmosphericsControllerOptions {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  terrainGroup: THREE.Group;
  boundaryFog: THREE.Mesh;
  terrainFogLayer: THREE.Mesh;
  horizonMesh: THREE.Mesh;
  mistMesh: THREE.Mesh;
  softDotTexture: THREE.CanvasTexture;
  initialTheme: WorkspaceSceneThemeDefinition;
  getTerrainController: () => WorkspaceSceneTerrainController;
  getThemeTarget: () => WorkspaceSceneThemeDefinition;
  getFrameCount: () => number;
}

export class SceneAtmosphericsController {
  readonly ambientParticles: THREE.Points;
  readonly rain: THREE.LineSegments;
  readonly rainGeometry: THREE.BufferGeometry;

  private readonly camera: THREE.PerspectiveCamera;
  private readonly terrainGroup: THREE.Group;
  private readonly boundaryFog: THREE.Mesh;
  private readonly terrainFogLayer: THREE.Mesh;
  private readonly horizonMesh: THREE.Mesh;
  private readonly mistMesh: THREE.Mesh;
  private readonly getTerrainController: () => WorkspaceSceneTerrainController;
  private readonly getThemeTarget: () => WorkspaceSceneThemeDefinition;
  private readonly getFrameCount: () => number;

  private readonly particleVelocities: THREE.Vector3[] = [];
  private readonly particleBaseVelocities: THREE.Vector3[] = [];
  private readonly rainDrops = new Float32Array(RAIN_COUNT * 3);
  private readonly rainVelocity = new Float32Array(RAIN_COUNT);
  private readonly rainDrift = new Float32Array(RAIN_COUNT);
  private readonly rainLength = new Float32Array(RAIN_COUNT);
  private readonly rainPhase = new Float32Array(RAIN_COUNT);
  private readonly rainSwing = new Float32Array(RAIN_COUNT);
  private readonly rainDepth = new Float32Array(RAIN_COUNT);
  private readonly pointerWorldPosition = new THREE.Vector3();

  constructor(options: SceneAtmosphericsControllerOptions) {
    this.camera = options.camera;
    this.terrainGroup = options.terrainGroup;
    this.boundaryFog = options.boundaryFog;
    this.terrainFogLayer = options.terrainFogLayer;
    this.horizonMesh = options.horizonMesh;
    this.mistMesh = options.mistMesh;
    this.getTerrainController = options.getTerrainController;
    this.getThemeTarget = options.getThemeTarget;
    this.getFrameCount = options.getFrameCount;

    // ── Initialize particles ──────────────────────────────────────────────
    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      particlePositions[i3] = (Math.random() - 0.5) * 200;
      particlePositions[i3 + 1] = (Math.random() - 0.5) * 30 + 10;
      particlePositions[i3 + 2] = (Math.random() - 0.5) * 100;

      const velocity = new THREE.Vector3(
        -(Math.random() * 0.04 + 0.01),
        Math.random() * 0.01 + 0.005,
        Math.random() * 0.02 + 0.01,
      );
      this.particleVelocities.push(velocity.clone());
      this.particleBaseVelocities.push(velocity.clone());
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    this.ambientParticles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({
      color: options.initialTheme.particles,
      size: 0.16,
      transparent: true,
      opacity: 0.6,
      alphaMap: options.softDotTexture,
      alphaTest: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    options.scene.add(this.ambientParticles);

    // ── Initialize rain ───────────────────────────────────────────────────
    const rainPositions = new Float32Array(RAIN_COUNT * 2 * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      const i3 = i * 3;
      this.rainDrops[i3] = (Math.random() - 0.5) * 220;
      this.rainDrops[i3 + 1] = Math.random() * 120 + 10;
      this.rainDrops[i3 + 2] = (Math.random() - 0.5) * 220;
      this.rainVelocity[i] = 18 + Math.random() * 14;
      this.rainDrift[i] = 1.6 + Math.random() * 2.2;
      this.rainLength[i] = 0.32 + Math.random() * 0.9;
      this.rainPhase[i] = Math.random() * Math.PI * 2;
      this.rainSwing[i] = 0.12 + Math.random() * 0.38;
      this.rainDepth[i] = 0.5 + Math.random() * 0.95;
    }

    this.rainGeometry = new THREE.BufferGeometry();
    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    this.rain = new THREE.LineSegments(this.rainGeometry, new THREE.LineBasicMaterial({
      color: options.initialTheme.horizon,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.NormalBlending,
    }));
    options.scene.add(this.rain);
  }

  update(delta: number, time: number) {
    const tc = this.getTerrainController();
    const terrainVisual = tc.getVisualState(time);

    // Particles — skip every 2nd frame and skip entirely in void mode
    if (this.getFrameCount() % 2 === 0 && !terrainVisual.fullyCollapsed) {
      const pointerWorldPoint = tc.getPointerWorldPoint(this.pointerWorldPosition)
        ? this.pointerWorldPosition
        : null;

      const positions = (this.ambientParticles.geometry as THREE.BufferGeometry).attributes.position.array as Float32Array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;

        if (pointerWorldPoint) {
          const dx = positions[i3] - pointerWorldPoint.x;
          const dy = positions[i3 + 1] - pointerWorldPoint.y;
          const dz = positions[i3 + 2] - pointerWorldPoint.z;
          const distSq = dx * dx + dy * dy + dz * dz;
          if (distSq > 0.001 && distSq < PARTICLE_INFLUENCE_RADIUS_SQ) {
            const dist = Math.sqrt(distSq);
            this.particleVelocities[i].x += (dx / dist) * PARTICLE_INFLUENCE_FORCE;
            this.particleVelocities[i].y += (dy / dist) * PARTICLE_INFLUENCE_FORCE;
            this.particleVelocities[i].z += (dz / dist) * PARTICLE_INFLUENCE_FORCE;
          }
        }

        this.particleVelocities[i].lerp(this.particleBaseVelocities[i], PARTICLE_RETURN_SPEED);
        positions[i3] += this.particleVelocities[i].x;
        positions[i3 + 1] += this.particleVelocities[i].y;
        positions[i3 + 2] += this.particleVelocities[i].z;

        if (positions[i3] < PARTICLE_WRAP_X_MIN) positions[i3] = PARTICLE_WRAP_X_MAX;
        if (positions[i3 + 1] > PARTICLE_WRAP_Y_MAX) positions[i3 + 1] = PARTICLE_WRAP_Y_MIN;
        if (positions[i3 + 2] > PARTICLE_WRAP_Z_MAX) positions[i3 + 2] = PARTICLE_WRAP_Z_MIN;
      }
      (this.ambientParticles.geometry as THREE.BufferGeometry).attributes.position.needsUpdate = true;
    }

    // Rain
    const denseFogTheme = this.getThemeTarget().id === 'overcast';
    const rainMaterial = this.rain.material as THREE.LineBasicMaterial;
    const rainVisible = rainMaterial.opacity > 0.005 || denseFogTheme;

    if (rainVisible) {
      const rainCenter = this.camera.position;
      const rainArray = this.rainGeometry.attributes.position.array as Float32Array;
      const rainGust = denseFogTheme ? (Math.sin(time * 0.62) * 1.5 + Math.cos(time * 0.31) * 0.9) : 0;
      const rainCrosswind = denseFogTheme ? Math.cos(time * 0.44) * 0.8 : 0;

      for (let i = 0; i < RAIN_COUNT; i++) {
        const i3 = i * 3;
        const lineIndex = i * 6;
        const flutter = Math.sin(time * (1.3 + this.rainSwing[i]) + this.rainPhase[i]) * this.rainSwing[i];
        const drizzlePulse = 0.82 + Math.sin(time * 0.55 + this.rainPhase[i] * 0.7) * 0.12;
        const lateralDrift = (-this.rainDrift[i] * 0.07) + rainGust * this.rainDepth[i] * 0.06 + flutter * 0.05;
        const forwardDrift = (this.rainDrift[i] * 0.34) + rainCrosswind * this.rainDepth[i] * 0.08;
        const fallSpeed = this.rainVelocity[i] * drizzlePulse;
        const segmentLength = this.rainLength[i] * (0.75 + this.rainDepth[i] * 0.35);

        this.rainDrops[i3] += lateralDrift * delta;
        this.rainDrops[i3 + 1] -= fallSpeed * delta;
        this.rainDrops[i3 + 2] += forwardDrift * delta;

        const outOfRange =
          this.rainDrops[i3 + 1] < rainCenter.y - 18
          || Math.abs(this.rainDrops[i3] - rainCenter.x) > RAIN_PROXIMITY
          || Math.abs(this.rainDrops[i3 + 2] - rainCenter.z) > RAIN_PROXIMITY;

        if (outOfRange) {
          this.rainDrops[i3] = rainCenter.x + (Math.random() - 0.5) * RAIN_SPREAD;
          this.rainDrops[i3 + 1] = rainCenter.y + RAIN_CEILING + Math.random() * RAIN_CEILING_VARIANCE;
          this.rainDrops[i3 + 2] = rainCenter.z + (Math.random() - 0.5) * RAIN_SPREAD;
        }

        rainArray[lineIndex] = this.rainDrops[i3];
        rainArray[lineIndex + 1] = this.rainDrops[i3 + 1];
        rainArray[lineIndex + 2] = this.rainDrops[i3 + 2];
        rainArray[lineIndex + 3] = this.rainDrops[i3] + lateralDrift * 0.08;
        rainArray[lineIndex + 4] = this.rainDrops[i3 + 1] + segmentLength;
        rainArray[lineIndex + 5] = this.rainDrops[i3 + 2] - forwardDrift * 0.06;
      }
      this.rainGeometry.attributes.position.needsUpdate = true;
    }

    // Atmospheric mesh transforms — skip when terrain is fully collapsed
    if (!terrainVisual.fullyCollapsed) {
      this.terrainGroup.rotation.z = Math.sin(time * 0.03) * 0.0018 * terrainVisual.motionFactor;
      this.boundaryFog.rotation.z = time * (0.012 + terrainVisual.collapseProgress * 0.018);
      this.boundaryFog.position.z = 5.8 + Math.sin(time * 0.18) * (0.35 + terrainVisual.collapseProgress * 0.28);
      this.terrainFogLayer.position.z += (
        (
          (denseFogTheme ? 11.8 : 8.6)
          + Math.sin(time * 0.22) * (denseFogTheme ? 0.65 : 0.22 + terrainVisual.collapseProgress * 0.18)
          + terrainVisual.collapseProgress * 1.4
        ) - this.terrainFogLayer.position.z
      ) * 0.08;
      this.horizonMesh.rotation.z = Math.sin(time * 0.11) * 0.015;
      this.mistMesh.rotation.z = -time * 0.01;
    }

    // Horizon / mist position convergence — runs regardless of collapse state
    const themeId = this.getThemeTarget().id;
    this.horizonMesh.position.x += (0 - this.horizonMesh.position.x) * 0.016;
    this.horizonMesh.position.y += ((themeId === 'overcast' ? 4.2 : 3.4) - this.horizonMesh.position.y) * 0.02;
    this.mistMesh.position.x += (0 - this.mistMesh.position.x) * 0.012;
    this.mistMesh.position.y += (((themeId === 'overcast' ? 9.8 : (themeId === 'morning' || themeId === 'night') ? 8.8 : 7.9)) - this.mistMesh.position.y) * 0.016;
  }

  dispose() {
    (this.ambientParticles.geometry as THREE.BufferGeometry).dispose();
    (this.ambientParticles.material as THREE.Material).dispose();
    this.rainGeometry.dispose();
    (this.rain.material as THREE.Material).dispose();
  }
}
