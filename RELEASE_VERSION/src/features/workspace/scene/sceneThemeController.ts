import * as THREE from 'three';
import type { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { WorkspaceSceneTheme } from '../model/types';
import {
  WORKSPACE_SCENE_THEMES,
  WORKSPACE_SCENE_VISUAL_TUNING,
  getThemeByTime,
} from './sceneConfig';
import type { WorkspaceSceneThemeDefinition } from './sceneConfig';
import { _scratchColor, lerpColor } from './sceneHelpers';
import { computeLightningFlash, resolveThemeAtmosphere } from './sceneEffects';
import type { WorkspaceSceneRuntimeState } from './sceneTypes';
import type { WorkspaceSceneTerrainController } from './sceneTerrainController';

// ── Transition tuning ───────────────────────────────────────────────────────
const TRANSITION_DURATION = 3.8;
const LIGHTNING_INITIAL_PROGRESS = 0.55;
const LIGHTNING_COOLDOWN_BASE = 26;
const LIGHTNING_COOLDOWN_VARIANCE = 8;
const AUTO_THEME_CHECK_INTERVAL = 120;

// ── Typed material references (cast once, used every frame) ─────────────────
interface ThemeMaterials {
  sky: THREE.ShaderMaterial;
  haze: THREE.ShaderMaterial;
  mist: THREE.ShaderMaterial;
  terrainFog: THREE.ShaderMaterial;
  boundaryFog: THREE.ShaderMaterial;
  rain: THREE.LineBasicMaterial;
  surface: THREE.MeshStandardMaterial;
  wire: THREE.MeshBasicMaterial;
  glowWire: THREE.MeshBasicMaterial;
  points: THREE.PointsMaterial;
  particle: THREE.PointsMaterial;
  sceneFog: THREE.FogExp2;
  peakBeacon: THREE.ShaderMaterial;
}

export interface SceneThemeControllerOptions {
  host: HTMLElement;
  initialTheme: WorkspaceSceneThemeDefinition;
  // Scene objects — stored as typed material refs, not as raw meshes
  skyDome: THREE.Mesh;
  horizonMesh: THREE.Mesh;
  mistMesh: THREE.Mesh;
  terrainFogLayer: THREE.Mesh;
  boundaryFog: THREE.Mesh;
  rain: THREE.LineSegments;
  surface: THREE.Mesh;
  wireframe: THREE.Mesh;
  glowWireframe: THREE.Mesh;
  surfacePoints: THREE.Points;
  peakBeacons: THREE.Points;
  ambientParticles: THREE.Points;
  // Lights
  ambientLight: THREE.AmbientLight;
  hemiLight: THREE.HemisphereLight;
  mainLight: THREE.DirectionalLight;
  accentLight: THREE.DirectionalLight;
  // Renderer
  renderer: THREE.WebGLRenderer;
  bloomPass: UnrealBloomPass | null;
  sceneFog: THREE.FogExp2;
  // Dependencies
  getState: () => WorkspaceSceneRuntimeState;
  getTerrainController: () => WorkspaceSceneTerrainController;
  getFrameCount: () => number;
}

export class SceneThemeController {
  private themeTarget: WorkspaceSceneThemeDefinition;
  private lastResolvedTimeTheme: WorkspaceSceneTheme;
  private hasFirstStateApplied = false;

  // Cinematic transition state
  private transitionActive = false;
  private transitionT = 0;
  private transitionFromTheme: WorkspaceSceneThemeDefinition;

  // Lightning
  private lightningProgress = 0;
  private nextLightningAt = 30;
  private readonly lightningOverlay: HTMLDivElement;

  // Color scratch objects (pooled, zero allocation per frame)
  private readonly sharedColorA = new THREE.Color();
  private readonly sharedColorB = new THREE.Color();
  private readonly neonEdgeThemeColor = new THREE.Color();
  private readonly neonEdgeTargetColor = new THREE.Color();
  private readonly wireShiftColorA = new THREE.Color();
  private readonly wireShiftColorB = new THREE.Color();
  private readonly wireShiftColorC = new THREE.Color();
  private readonly terrainFillColor = new THREE.Color();
  private readonly terrainWireColor = new THREE.Color();
  private readonly terrainGlowColor = new THREE.Color();
  private readonly terrainPointColor = new THREE.Color();
  private readonly particleColor = new THREE.Color();
  private readonly peakBeaconColor = new THREE.Color();

  // Typed material refs (cast once in constructor)
  private readonly mat: ThemeMaterials;

  // Mesh visibility refs
  private readonly horizonMesh: THREE.Mesh;
  private readonly mistMesh: THREE.Mesh;
  private readonly terrainFogLayer: THREE.Mesh;
  private readonly boundaryFog: THREE.Mesh;
  private readonly peakBeacons: THREE.Points;

  // Lights
  private readonly ambientLight: THREE.AmbientLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly mainLight: THREE.DirectionalLight;
  private readonly accentLight: THREE.DirectionalLight;

  // Renderer
  private readonly renderer: THREE.WebGLRenderer;
  private readonly bloomPass: UnrealBloomPass | null;
  private readonly host: HTMLElement;

  // Dependencies
  private readonly getState: () => WorkspaceSceneRuntimeState;
  private readonly getTerrainController: () => WorkspaceSceneTerrainController;
  private readonly getFrameCount: () => number;

  constructor(options: SceneThemeControllerOptions) {
    this.themeTarget = options.initialTheme;
    this.transitionFromTheme = options.initialTheme;
    this.lastResolvedTimeTheme = getThemeByTime();
    this.host = options.host;
    this.getState = options.getState;
    this.getTerrainController = options.getTerrainController;
    this.getFrameCount = options.getFrameCount;

    // Typed material refs — cast once
    this.mat = {
      sky: options.skyDome.material as THREE.ShaderMaterial,
      haze: options.horizonMesh.material as THREE.ShaderMaterial,
      mist: options.mistMesh.material as THREE.ShaderMaterial,
      terrainFog: options.terrainFogLayer.material as THREE.ShaderMaterial,
      boundaryFog: options.boundaryFog.material as THREE.ShaderMaterial,
      rain: options.rain.material as THREE.LineBasicMaterial,
      surface: options.surface.material as THREE.MeshStandardMaterial,
      wire: options.wireframe.material as THREE.MeshBasicMaterial,
      glowWire: options.glowWireframe.material as THREE.MeshBasicMaterial,
      points: options.surfacePoints.material as THREE.PointsMaterial,
      particle: options.ambientParticles.material as THREE.PointsMaterial,
      sceneFog: options.sceneFog,
      peakBeacon: options.peakBeacons.material as THREE.ShaderMaterial,
    };

    // Mesh refs for visibility toggling
    this.horizonMesh = options.horizonMesh;
    this.mistMesh = options.mistMesh;
    this.terrainFogLayer = options.terrainFogLayer;
    this.boundaryFog = options.boundaryFog;
    this.peakBeacons = options.peakBeacons;

    // Lights
    this.ambientLight = options.ambientLight;
    this.hemiLight = options.hemiLight;
    this.mainLight = options.mainLight;
    this.accentLight = options.accentLight;

    // Renderer
    this.renderer = options.renderer;
    this.bloomPass = options.bloomPass;

    // Lightning overlay
    this.lightningOverlay = this.createLightningOverlay();
  }

  getThemeTarget() {
    return this.themeTarget;
  }

  isTransitionActive() {
    return this.transitionActive;
  }

  /**
   * Called from orchestrator's setState().
   * Returns true if the theme changed (triggers flight tile anchor rebuild).
   */
  resolveAndSync(previousState: WorkspaceSceneRuntimeState, nextState: WorkspaceSceneRuntimeState): boolean {
    const previousResolvedTheme = previousState.themeAuto ? this.lastResolvedTimeTheme : previousState.theme;
    const nextResolvedTheme = nextState.themeAuto ? getThemeByTime() : nextState.theme;
    this.lastResolvedTimeTheme = nextResolvedTheme;

    if (previousResolvedTheme === nextResolvedTheme) {
      this.hasFirstStateApplied = true;
      return false;
    }

    this.triggerTransition(WORKSPACE_SCENE_THEMES[nextResolvedTheme]);
    this.hasFirstStateApplied = true;
    return true;
  }

  /**
   * Returns true if an auto-theme change happened (needs flight tile anchor rebuild).
   */
  syncAutoTheme(): boolean {
    if (!this.getState().themeAuto || this.getFrameCount() % AUTO_THEME_CHECK_INTERVAL !== 0) {
      return false;
    }

    const nextTimeTheme = getThemeByTime();
    if (nextTimeTheme === this.lastResolvedTimeTheme) return false;

    this.lastResolvedTimeTheme = nextTimeTheme;
    this.triggerTransition(WORKSPACE_SCENE_THEMES[nextTimeTheme]);
    return true;
  }

  update(delta: number, time: number) {
    const theme = this.themeTarget;
    const { denseFogTheme, overcastIntensity } = resolveThemeAtmosphere(theme.id);
    const lerpSpeed = Math.min(0.1, delta * 0.9);
    const m = this.mat;

    // ── Cinematic transition ────────────────────────────────────────────────
    if (this.transitionActive) {
      this.transitionT = Math.min(1, this.transitionT + delta / TRANSITION_DURATION);
      if (this.transitionT >= 1) this.transitionActive = false;
    }
    const sinT = Math.sin(this.transitionT * Math.PI);
    const isT = this.transitionActive;

    const skyLerpSpeed     = lerpSpeed * (isT ? 1.0 + sinT * 3.2 + (1 - this.transitionT) * 1.4 : 1.0);
    const lightLerpSpeed   = lerpSpeed * (isT ? 1.2 + sinT * 3.8 : 1.0);
    const fogLerpSpeed     = lerpSpeed * (isT ? 0.3 + sinT * 2.8 : 1.0);
    const terrainLerpSpeed = lerpSpeed * (isT ? Math.max(0.08, this.transitionT * this.transitionT * 2.8) : 1.0);
    const exposureFlash    = isT ? sinT * -0.18 : 0;
    const bloomSpike       = isT ? sinT * 0.45 : 0;
    const fogDensityBoost  = isT ? sinT * 0.0055 : 0;
    const terrainPulse     = isT ? 1.0 + sinT * 0.28 : 1.0;

    // ── Lightning ───────────────────────────────────────────────────────────
    if (denseFogTheme && this.lightningProgress <= 0 && time >= this.nextLightningAt) {
      this.lightningProgress = LIGHTNING_INITIAL_PROGRESS;
      this.nextLightningAt = time + LIGHTNING_COOLDOWN_BASE + Math.random() * LIGHTNING_COOLDOWN_VARIANCE;
    }
    if (this.lightningProgress > 0) {
      this.lightningProgress = Math.max(0, this.lightningProgress - delta);
    }
    const lightningFlash = computeLightningFlash(this.lightningProgress, denseFogTheme);

    // ── Terrain visual state ────────────────────────────────────────────────
    const tc = this.getTerrainController();
    const visual = WORKSPACE_SCENE_VISUAL_TUNING[theme.id];
    const terrainVisual = tc.getVisualState(time);
    const terrainVisibility = terrainVisual.visibility;
    const terrainOpacity = Math.pow(terrainVisibility, 1.15);
    const terrainCollapse = terrainVisual.collapseProgress;
    const terrainStillness = 1 - terrainVisual.motionFactor;
    const voidAura = terrainVisual.collapsePulse * 0.16 + terrainCollapse * (1 - terrainVisibility) * 0.18;
    tc.setPeakBeaconsEnabled(visual.beaconOpacity > 0.001 && terrainVisibility > 0.05);

    const terrainViewHeight = tc.getCameraLocalHeight();
    const flightSurveyFactor = THREE.MathUtils.smoothstep(terrainViewHeight, 10, 36);
    const flightMode = this.getState().flightMode;
    const wireOpacityTarget = flightMode
      ? THREE.MathUtils.lerp(visual.wireFlightOpacityNear, visual.wireFlightOpacityFar, flightSurveyFactor)
      : visual.wireSurfaceOpacity;
    const glowOpacityBase = flightMode
      ? THREE.MathUtils.lerp(visual.glowFlightOpacityNear, visual.glowFlightOpacityFar, flightSurveyFactor)
      : visual.glowSurfaceOpacity;

    // ── Sky: Stage 1 ────────────────────────────────────────────────────────
    m.sky.uniforms.time.value = time;
    (m.sky.uniforms.topColor.value as THREE.Color).lerp(_scratchColor.set(theme.skyTop), skyLerpSpeed);
    (m.sky.uniforms.bottomColor.value as THREE.Color).lerp(_scratchColor.set(theme.skyBottom), skyLerpSpeed);
    (m.sky.uniforms.horizonColor.value as THREE.Color).lerp(_scratchColor.set(theme.horizon), skyLerpSpeed);

    // ── Atmosphere: Stage 2 ─────────────────────────────────────────────────
    m.sceneFog.color.lerp(_scratchColor.set(theme.fog), fogLerpSpeed);
    m.sceneFog.density += (theme.fogDensity + fogDensityBoost + terrainCollapse * 0.0016 - m.sceneFog.density) * fogLerpSpeed;
    this.renderer.toneMappingExposure += (
      (theme.exposure + lightningFlash * 0.44 + exposureFlash - terrainCollapse * 0.03) - this.renderer.toneMappingExposure
    ) * lerpSpeed;

    // ── Terrain colours: Stage 3 ────────────────────────────────────────────
    lerpColor(this.terrainFillColor, theme.terrainFill, terrainLerpSpeed);
    lerpColor(this.terrainWireColor, theme.terrainWire, terrainLerpSpeed);
    lerpColor(this.terrainPointColor, theme.terrainPoints, terrainLerpSpeed);
    lerpColor(this.particleColor, theme.particles, lerpSpeed);

    this.sharedColorB.copy(this.terrainFillColor).lerp(
      _scratchColor.set(theme.fog),
      denseFogTheme ? 0.14 : theme.id === 'night' ? 0.07 : 0.1,
    );
    m.surface.color.copy(this.sharedColorB);
    m.surface.emissive.lerp(_scratchColor.set(theme.terrainEmissive), terrainLerpSpeed);
    m.surface.emissiveIntensity += (Math.min(theme.emissiveIntensity, visual.emissiveCap) - m.surface.emissiveIntensity) * terrainLerpSpeed;
    m.surface.roughness += (theme.meshRoughness - m.surface.roughness) * terrainLerpSpeed;
    m.surface.metalness += (theme.meshMetalness - m.surface.metalness) * terrainLerpSpeed;
    m.surface.opacity += ((0.96 * terrainOpacity) - m.surface.opacity) * (terrainLerpSpeed * 1.6);

    // ── Wireframe hue shift ─────────────────────────────────────────────────
    this.wireShiftColorA.set(theme.terrainWire);
    this.wireShiftColorB.set(theme.terrainGlow);
    this.wireShiftColorC.set(theme.horizon);

    const shiftPhaseA = (Math.sin(time * 0.18) * 0.5 + 0.5);
    const shiftPhaseB = (Math.sin(time * 0.11 + 1.9) * 0.5 + 0.5);
    const shiftPhaseC = (Math.cos(time * 0.07 + 3.4) * 0.5 + 0.5);

    this.sharedColorA.copy(this.wireShiftColorA)
      .lerp(this.wireShiftColorB, shiftPhaseA * 0.38)
      .lerp(this.wireShiftColorC, shiftPhaseB * 0.14);
    this.sharedColorA.lerp(this.terrainFillColor, 1 - visual.wireBlend);
    m.wire.color.lerp(this.sharedColorA, terrainLerpSpeed * 2.2);
    m.wire.opacity += (
      ((Math.min(theme.wireOpacity, wireOpacityTarget) * terrainOpacity) + voidAura * 0.26 - m.wire.opacity)
    ) * terrainLerpSpeed;

    // ── Glow wireframe ──────────────────────────────────────────────────────
    this.neonEdgeThemeColor.set(theme.horizon);
    this.neonEdgeTargetColor.set(theme.terrainGlow).lerp(this.neonEdgeThemeColor, 0.18);
    this.neonEdgeTargetColor
      .lerp(this.wireShiftColorC, shiftPhaseA * 0.55)
      .lerp(this.wireShiftColorA, shiftPhaseC * 0.22);
    this.terrainGlowColor.lerp(this.neonEdgeTargetColor, terrainLerpSpeed * 1.8);
    m.glowWire.color.copy(this.terrainGlowColor);

    const edgeBreath = 0.92 + Math.sin(time * 0.42) * 0.05 + Math.cos(time * 0.21 + 0.8) * 0.025 + shiftPhaseB * 0.03;
    m.glowWire.opacity += (
      (((glowOpacityBase * edgeBreath) * terrainOpacity) + voidAura * 0.3 - m.glowWire.opacity)
    ) * (terrainLerpSpeed * 1.5);

    // ── Points & beacons ────────────────────────────────────────────────────
    this.sharedColorB.copy(this.terrainFillColor).lerp(this.terrainPointColor, 0.46);
    m.points.color.copy(this.sharedColorB);
    m.points.opacity += (
      ((Math.min(theme.pointsOpacity, visual.pointOpacity) * (flightMode ? 0.9 : 1) * terrainOpacity) - m.points.opacity)
    ) * terrainLerpSpeed;
    m.peakBeacon.uniforms.uTime.value = time;
    this.peakBeaconColor.copy(_scratchColor.set(theme.fog)).lerp(this.sharedColorA.set(theme.terrainBeacon), 0.82);
    (m.peakBeacon.uniforms.uColor.value as THREE.Color).lerp(this.peakBeaconColor, terrainLerpSpeed * 1.2);
    m.peakBeacon.uniforms.uOpacity.value += (
      ((visual.beaconOpacity * terrainOpacity) - m.peakBeacon.uniforms.uOpacity.value)
    ) * (terrainLerpSpeed * 1.4);

    // ── Particles & rain ────────────────────────────────────────────────────
    m.particle.color.copy(this.particleColor);
    m.rain.color.lerp(_scratchColor.set(theme.horizon), fogLerpSpeed * 0.7);
    m.rain.opacity += ((denseFogTheme ? 0.18 : 0) - m.rain.opacity) * (fogLerpSpeed * 1.85);

    // ── Haze, mist, terrain fog ─────────────────────────────────────────────
    m.haze.uniforms.time.value = time;
    (m.haze.uniforms.baseColor.value as THREE.Color).lerp(_scratchColor.set(theme.fog), fogLerpSpeed);
    (m.haze.uniforms.glowColor.value as THREE.Color).lerp(_scratchColor.set(theme.horizon), fogLerpSpeed);
    m.haze.uniforms.storminess.value += (overcastIntensity - m.haze.uniforms.storminess.value) * (fogLerpSpeed * 1.5);
    m.haze.uniforms.opacity.value += (
      (THREE.MathUtils.clamp(
        visual.hazeOpacity + (flightMode ? 0.014 : 0) + terrainCollapse * 0.02,
        0, 0.26,
      ) - m.haze.uniforms.opacity.value)
    ) * fogLerpSpeed;

    m.mist.uniforms.time.value = time;
    (m.mist.uniforms.baseColor.value as THREE.Color).lerp(_scratchColor.set(theme.fog), fogLerpSpeed);
    (m.mist.uniforms.highlightColor.value as THREE.Color).lerp(_scratchColor.set(theme.horizon), fogLerpSpeed);
    m.mist.uniforms.storminess.value += (overcastIntensity - m.mist.uniforms.storminess.value) * (fogLerpSpeed * 1.5);
    m.mist.uniforms.opacity.value += (
      (THREE.MathUtils.clamp(
        visual.mistOpacity + (flightMode ? 0.01 : 0) + terrainCollapse * 0.028,
        0, 0.26,
      ) - m.mist.uniforms.opacity.value)
    ) * fogLerpSpeed;

    m.terrainFog.uniforms.time.value = time;
    (m.terrainFog.uniforms.baseColor.value as THREE.Color).lerp(_scratchColor.set(theme.fog), fogLerpSpeed);
    (m.terrainFog.uniforms.highlightColor.value as THREE.Color).lerp(_scratchColor.set(theme.horizon), fogLerpSpeed);
    m.terrainFog.uniforms.storminess.value += (overcastIntensity - m.terrainFog.uniforms.storminess.value) * (fogLerpSpeed * 1.5);
    m.terrainFog.uniforms.opacity.value += (
      (THREE.MathUtils.clamp(
        visual.terrainFogOpacity + (flightMode ? 0.012 : 0) + terrainCollapse * 0.08 + terrainStillness * 0.012,
        0, 0.36,
      ) - m.terrainFog.uniforms.opacity.value)
    ) * fogLerpSpeed;

    (m.boundaryFog.uniforms.baseColor.value as THREE.Color).lerp(_scratchColor.set(theme.fog), fogLerpSpeed);
    (m.boundaryFog.uniforms.glowColor.value as THREE.Color).lerp(_scratchColor.set(theme.horizon), fogLerpSpeed);
    m.boundaryFog.uniforms.opacity.value += (0 - m.boundaryFog.uniforms.opacity.value) * fogLerpSpeed;

    // ── Lights ──────────────────────────────────────────────────────────────
    this.ambientLight.color.lerp(_scratchColor.set(theme.ambientLight), lightLerpSpeed);
    this.mainLight.color.lerp(_scratchColor.set(theme.mainLight), lightLerpSpeed);
    this.accentLight.color.lerp(_scratchColor.set(theme.accentLight), lightLerpSpeed);
    this.hemiLight.color.lerp(_scratchColor.set(theme.mainLight), lightLerpSpeed);
    this.hemiLight.groundColor.lerp(_scratchColor.set(theme.fog), lightLerpSpeed);
    this.ambientLight.intensity = 0.72 + lightningFlash * 1.2;
    this.hemiLight.intensity = 0.38 + lightningFlash * 0.5;
    this.mainLight.intensity = 0.78 + lightningFlash * 2.9;
    this.accentLight.intensity = 0.2 + lightningFlash * 0.95;

    // ── Bloom & post ────────────────────────────────────────────────────────
    if (this.bloomPass) {
      this.bloomPass.strength += (
        Math.min(theme.bloomStrength + bloomSpike + voidAura * 0.9, 1.2) - this.bloomPass.strength
      ) * lerpSpeed;
    }
    const nextLightningOpacity = denseFogTheme ? String(Math.min(0.82, lightningFlash * 0.44)) : '0';
    if (this.lightningOverlay.style.opacity !== nextLightningOpacity) {
      this.lightningOverlay.style.opacity = nextLightningOpacity;
    }

    // ── Visibility ──────────────────────────────────────────────────────────
    this.horizonMesh.visible = !denseFogTheme && m.haze.uniforms.opacity.value > 0.004;
    this.mistMesh.visible = !denseFogTheme && m.mist.uniforms.opacity.value > 0.004;
    this.terrainFogLayer.visible = m.terrainFog.uniforms.opacity.value > 0.01;
    this.boundaryFog.visible = false;
    this.peakBeacons.visible = terrainVisibility > 0.05 && m.peakBeacon.uniforms.uOpacity.value > 0.008;

    // Pass terrain pulse to controller
    tc.setAmplitudePulse(terrainPulse);
  }

  dispose() {
    if (this.lightningOverlay.parentElement === this.host) {
      this.host.removeChild(this.lightningOverlay);
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private triggerTransition(nextTheme: WorkspaceSceneThemeDefinition) {
    if (nextTheme === this.themeTarget) return;
    if (!this.hasFirstStateApplied) {
      this.themeTarget = nextTheme;
      return;
    }
    this.transitionFromTheme = this.themeTarget;
    this.themeTarget = nextTheme;
    this.transitionT = 0;
    this.transitionActive = true;
  }

  private createLightningOverlay() {
    const el = document.createElement('div');
    el.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 2;
      opacity: 0;
      mix-blend-mode: screen;
      background:
        radial-gradient(circle at 50% 24%, rgba(232,243,255,0.9) 0%, rgba(232,243,255,0.35) 22%, rgba(232,243,255,0.08) 48%, rgba(232,243,255,0) 74%),
        linear-gradient(180deg, rgba(228,240,255,0.55) 0%, rgba(228,240,255,0.18) 38%, rgba(228,240,255,0) 100%);
      transition: opacity 40ms linear;
    `;
    this.host.appendChild(el);
    return el;
  }
}
