import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { WORKSPACE_SCENE_THEMES } from './sceneConfig';
import {
  createSkyMaterial,
  createHazeMaterial,
  createMistMaterial,
  createSoftDotTexture,
} from './sceneHelpers';
import {
  FLIGHT_POINTER_EASING,
  SURFACE_POINTER_EASING,
  TERRAIN_SEGMENTS_FLIGHT,
  TERRAIN_SEGMENTS_SURFACE,
  TERRAIN_Y_OFFSET,
} from './sceneConstants';
import {
  buildTerrainLOD,
  createTerrainMeshes,
  disposeMeshes,
} from './sceneTerrainFactory';
import type { TerrainLODData, TerrainMeshes } from './sceneTerrainFactory';
import { WorkspaceSceneTerrainController } from './sceneTerrainController';
import { WorkspaceSceneCameraController } from './sceneCameraController';
import { SceneInputController } from './sceneInputController';
import { SceneAtmosphericsController } from './sceneAtmosphericsController';
import { SceneThemeController } from './sceneThemeController';
import { FlightTileProjectionController } from './sceneFlightTileProjection';
export type {
  WorkspaceSceneFlightTileProjection,
  WorkspaceSceneTileDescriptor,
  WorkspaceSceneRuntimeState,
  WorkspaceSceneRuntimeOptions,
} from './sceneTypes';
import type {
  WorkspaceSceneRuntimeState,
  WorkspaceSceneRuntimeOptions,
  ImpactWave,
} from './sceneTypes';

export class WorkspaceSceneRuntime {
  private readonly canvas: HTMLCanvasElement;
  private readonly host: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(54, 1, 0.1, 1800);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer | null;
  private readonly bloomPass: UnrealBloomPass | null;
  private readonly clock = new THREE.Clock();
  private readonly terrainGroup = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly fogInteractionPoints = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly fogInteractionWeights = [0, 0, 0];
  private readonly invisiblePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600, 1, 1),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  private readonly ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  private readonly hemiLight = new THREE.HemisphereLight(0xffffff, 0x223040, 0.38);
  private readonly mainLight = new THREE.DirectionalLight(0xffffff, 0.78);
  private readonly accentLight = new THREE.DirectionalLight(0xffffff, 0.22);
  private readonly skyDome: THREE.Mesh;
  private readonly horizonMesh: THREE.Mesh;
  private readonly mistMesh: THREE.Mesh;
  private readonly softDotTexture = createSoftDotTexture();
  private readonly waves: ImpactWave[] = [];

  // Terrain — LOD data grouped into two bundles
  private readonly surfaceLOD: TerrainLODData;
  private readonly flightLOD: TerrainLODData;
  private readonly terrain: TerrainMeshes;

  // Sub-controllers
  private readonly terrainController: WorkspaceSceneTerrainController;
  private readonly cameraController: WorkspaceSceneCameraController;
  private readonly inputController: SceneInputController;
  private readonly atmosphericsController: SceneAtmosphericsController;
  private readonly themeController: SceneThemeController;
  private readonly flightTileController: FlightTileProjectionController;

  private frameHandle = 0;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private state: WorkspaceSceneRuntimeState = {
    theme: 'default',
    themeAuto: false,
    flightMode: false,
    terrainMode: 'full',
    tiles: [],
  };
  private frameCount = 0;
  private mounted = true;
  private pendingDelta = 0;
  private paused = false;
  private readonly qualityProfile: WorkspaceSceneRuntimeOptions['qualityProfile'];

  constructor(options: WorkspaceSceneRuntimeOptions) {
    this.canvas = options.canvas;
    this.host = options.host;
    this.qualityProfile = options.qualityProfile;
    const initialTheme = WORKSPACE_SCENE_THEMES.default;

    // ── Renderer ───────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: options.qualityProfile.antialias,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = initialTheme.exposure;
    renderer.setClearColor(0x000000, 0);
    this.renderer = renderer;

    if (options.qualityProfile.enableBloom) {
      const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), initialTheme.bloomStrength, 0.3, 0.6);
      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(this.scene, this.camera));
      composer.addPass(bloomPass);
      this.bloomPass = bloomPass;
      this.composer = composer;
    } else {
      this.bloomPass = null;
      this.composer = null;
    }

    this.scene.fog = new THREE.FogExp2(initialTheme.fog, initialTheme.fogDensity);

    // ── Environment ────────────────────────────────────────────────────────
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(600, 20, 10), createSkyMaterial(initialTheme));
    this.horizonMesh = new THREE.Mesh(new THREE.PlaneGeometry(420, 78, 1, 1), createHazeMaterial(initialTheme));
    this.horizonMesh.position.set(0, 3.4, -115);
    this.mistMesh = new THREE.Mesh(new THREE.PlaneGeometry(560, 96, 1, 1), createMistMaterial(initialTheme));
    this.mistMesh.position.set(0, 8.8, -150);
    this.scene.add(this.skyDome, this.horizonMesh, this.mistMesh);

    // ── Terrain LOD + meshes ───────────────────────────────────────────────
    this.surfaceLOD = buildTerrainLOD(TERRAIN_SEGMENTS_SURFACE);
    this.flightLOD = buildTerrainLOD(TERRAIN_SEGMENTS_FLIGHT);
    this.terrain = createTerrainMeshes(
      this.surfaceLOD.geometry,
      initialTheme,
      this.softDotTexture,
      this.surfaceLOD.baseX,
      this.surfaceLOD.baseY,
      this.fogInteractionPoints,
      this.fogInteractionWeights,
    );
    this.terrainGroup.add(
      this.terrain.surface,
      this.terrain.wireframe,
      this.terrain.glowWireframe,
      this.terrain.surfacePoints,
      this.terrain.peakBeacons,
      this.terrain.boundaryFog,
      this.terrain.terrainFogLayer,
    );
    this.terrainGroup.rotation.x = -Math.PI / 2.12;
    this.terrainGroup.position.y = TERRAIN_Y_OFFSET;
    this.scene.add(this.terrainGroup);

    this.invisiblePlane.rotation.x = -Math.PI / 2.12;
    this.invisiblePlane.position.y = TERRAIN_Y_OFFSET;
    this.scene.add(this.invisiblePlane);

    // ── Lights & camera ────────────────────────────────────────────────────
    this.mainLight.position.set(-18, 34, 12);
    this.accentLight.position.set(22, 16, -10);
    this.scene.add(this.ambientLight, this.hemiLight, this.mainLight, this.accentLight);
    this.camera.position.set(0, 12.8, 72);
    this.camera.lookAt(0, 3.2, 0);
    this.canvas.style.cursor = 'grab';
    this.canvas.style.touchAction = 'none';

    // ── Sub-controllers ────────────────────────────────────────────────────
    this.inputController = new SceneInputController({
      canvas: this.canvas,
      host: this.host,
      getState: () => this.state,
      getCameraController: () => this.cameraController,
    });

    this.terrainController = new WorkspaceSceneTerrainController({
      camera: this.camera,
      terrainGroup: this.terrainGroup,
      surface: this.terrain.surface,
      invisiblePlane: this.invisiblePlane,
      raycaster: this.raycaster,
      positions: this.surfaceLOD.positions,
      baseX: this.surfaceLOD.baseX,
      baseY: this.surfaceLOD.baseY,
      initialZ: this.surfaceLOD.initialZ,
      fogInteractionPoints: this.fogInteractionPoints,
      fogInteractionWeights: this.fogInteractionWeights,
      waves: this.waves,
      pointer: this.inputController.pointer,
      peakBeaconIndices: this.terrain.peakBeaconIndices,
      peakBeaconPositionsAttribute: this.terrain.peakBeaconPositions,
      peakBeaconIntensityAttribute: this.terrain.peakBeaconIntensity,
      getPointerInfluenceActive: () => this.inputController.isPointerInfluenceActive(),
      getState: () => this.state,
      getFrameCount: () => this.frameCount,
    });

    this.cameraController = new WorkspaceSceneCameraController({
      camera: this.camera,
      clock: this.clock,
      terrainGroup: this.terrainGroup,
      getState: () => this.state,
      getDragging: () => this.inputController.isDragging(),
      terrainController: this.terrainController,
    });
    this.cameraController.initializeFromCamera();

    this.atmosphericsController = new SceneAtmosphericsController({
      scene: this.scene,
      camera: this.camera,
      terrainGroup: this.terrainGroup,
      boundaryFog: this.terrain.boundaryFog,
      terrainFogLayer: this.terrain.terrainFogLayer,
      horizonMesh: this.horizonMesh,
      mistMesh: this.mistMesh,
      softDotTexture: this.softDotTexture,
      initialTheme,
      getTerrainController: () => this.terrainController,
      getThemeTarget: () => this.themeController.getThemeTarget(),
      getFrameCount: () => this.frameCount,
    });

    this.themeController = new SceneThemeController({
      host: this.host,
      initialTheme,
      skyDome: this.skyDome,
      horizonMesh: this.horizonMesh,
      mistMesh: this.mistMesh,
      terrainFogLayer: this.terrain.terrainFogLayer,
      boundaryFog: this.terrain.boundaryFog,
      rain: this.atmosphericsController.rain,
      surface: this.terrain.surface,
      wireframe: this.terrain.wireframe,
      glowWireframe: this.terrain.glowWireframe,
      surfacePoints: this.terrain.surfacePoints,
      peakBeacons: this.terrain.peakBeacons,
      ambientParticles: this.atmosphericsController.ambientParticles,
      ambientLight: this.ambientLight,
      hemiLight: this.hemiLight,
      mainLight: this.mainLight,
      accentLight: this.accentLight,
      renderer: this.renderer,
      bloomPass: this.bloomPass,
      sceneFog: this.scene.fog as THREE.FogExp2,
      getState: () => this.state,
      getTerrainController: () => this.terrainController,
      getFrameCount: () => this.frameCount,
    });

    this.flightTileController = new FlightTileProjectionController({
      camera: this.camera,
      terrainGroup: this.terrainGroup,
      host: this.host,
      getTerrainController: () => this.terrainController,
      getThemeTarget: () => this.themeController.getThemeTarget(),
      getState: () => this.state,
      onFlightTileProjection: options.onFlightTileProjection ?? null,
    });

    this.inputController.bind();
    this.animate();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  resize(width: number, height: number) {
    const safeWidth = Math.max(1, Math.round(width));
    const safeHeight = Math.max(1, Math.round(height));
    if (safeWidth <= 1 || safeHeight <= 1) {
      return; // Skip degenerate sizes — layout not ready yet
    }
    if (safeWidth === this.viewportWidth && safeHeight === this.viewportHeight) {
      return;
    }

    this.viewportWidth = safeWidth;
    this.viewportHeight = safeHeight;
    this.inputController.suppressPointerInfluence();
    this.inputController.updateCachedRect(this.canvas.getBoundingClientRect());
    this.camera.aspect = safeWidth / safeHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.qualityProfile.maxPixelRatio));
    this.renderer.setSize(safeWidth, safeHeight, false);
    this.composer?.setSize(safeWidth, safeHeight);
    this.bloomPass?.setSize(Math.ceil(safeWidth / 2), Math.ceil(safeHeight / 2));
    this.renderFrame();
  }

  setState(nextState: WorkspaceSceneRuntimeState) {
    const previous = this.state;
    this.state = nextState;

    const themeChanged = this.themeController.resolveAndSync(previous, nextState);

    if (previous.flightMode !== nextState.flightMode) {
      this.applyFlightMode(nextState.flightMode);
    }

    if (previous.terrainMode !== nextState.terrainMode) {
      this.terrainController.setTerrainMode(nextState.terrainMode, this.clock.elapsedTime);
    }

    this.flightTileController.syncAnchors(previous.tiles, nextState.tiles, themeChanged);
    if (this.paused) {
      this.renderFrame();
    }
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    cancelAnimationFrame(this.frameHandle);
    this.frameHandle = 0;
    this.clock.stop();
  }

  resume() {
    if (!this.paused || !this.mounted) return;
    this.paused = false;
    this.clock.start();
    this.pendingDelta = 0;
    this.animate();
  }

  isPaused() {
    return this.paused;
  }

  dispose() {
    this.mounted = false;
    this.paused = true;
    cancelAnimationFrame(this.frameHandle);
    this.inputController.dispose();
    this.themeController.dispose();
    this.atmosphericsController.dispose();
    this.flightTileController.dispose();
    this.disposeSceneResources();
  }

  // ── Private: frame loop ───────────────────────────────────────────────────

  private animate = () => {
    if (!this.mounted) {
      return;
    }

    this.frameHandle = requestAnimationFrame(this.animate);
    const rawDelta = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.elapsedTime;
    this.frameCount += 1;

    const terrainIdle = this.terrainController.getVisualState();
    const sceneIdle = !this.state.flightMode
      && !this.themeController.isTransitionActive()
      && (terrainIdle.fullyCollapsed || terrainIdle.staticRest);

    if (sceneIdle) {
      const skipInterval = terrainIdle.fullyCollapsed
        ? (this.qualityProfile.tier === 'low' ? 8 : this.qualityProfile.tier === 'balanced' ? 5 : 3)
        : (this.qualityProfile.tier === 'low' ? 4 : 2);
      if (this.frameCount % skipInterval !== 0) {
        this.pendingDelta += rawDelta;
        return;
      }
    }

    const delta = Math.min(rawDelta + this.pendingDelta, 0.1);
    this.pendingDelta = 0;

    const autoThemeChanged = this.themeController.syncAutoTheme();
    if (autoThemeChanged) {
      this.flightTileController.syncAnchors(this.state.tiles, this.state.tiles, true);
    }

    this.inputController.pointer.lerp(
      this.inputController.pointerTarget,
      this.state.flightMode ? FLIGHT_POINTER_EASING : SURFACE_POINTER_EASING,
    );

    this.themeController.update(delta, time);
    this.terrainController.updateTerrain(time);
    this.cameraController.update(delta, time);
    this.atmosphericsController.update(delta, time);
    this.flightTileController.update(delta);

    this.renderFrame();
  };

  // ── Private: flight mode ──────────────────────────────────────────────────

  private applyFlightMode(enabled: boolean) {
    this.inputController.resetDrag();

    const lod = enabled ? this.flightLOD : this.surfaceLOD;
    this.terrain.surface.geometry = lod.geometry;
    this.terrain.wireframe.geometry = lod.geometry;
    this.terrain.glowWireframe.geometry = lod.geometry;
    this.terrain.surfacePoints.geometry = lod.geometry;
    this.terrainController.swapGeometry(lod.positions, lod.baseX, lod.baseY, lod.initialZ);

    this.cameraController.applyFlightMode(enabled);
    this.flightTileController.onFlightModeChanged(enabled);
  }

  // ── Private: disposal ─────────────────────────────────────────────────────

  private disposeSceneResources() {
    this.softDotTexture.dispose();
    this.renderer.dispose();
    this.composer?.dispose();
    this.surfaceLOD.geometry.dispose();
    this.flightLOD.geometry.dispose();
    disposeMeshes(
      this.skyDome,
      this.horizonMesh,
      this.mistMesh,
      this.terrain.surface,
      this.terrain.wireframe,
      this.terrain.glowWireframe,
      this.terrain.surfacePoints,
      this.terrain.peakBeacons,
      this.terrain.boundaryFog,
      this.terrain.terrainFogLayer,
    );
  }

  private renderFrame() {
    if (this.composer) {
      this.composer.render();
      return;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
