import * as THREE from 'three';
import {
  WORKSPACE_SCENE_SHELL_VISUAL_TUNING,
  WORKSPACE_WIDGET_ACCENTS,
  WORKSPACE_WIDGET_SHELL_PROFILES,
  type WorkspaceSceneThemeDefinition,
} from './sceneConfig';
import { createShellTexture, easeOutCubic, paintShellTexture, seedFromId } from './sceneHelpers';
import { applyShellDimensions, buildShellTextureSignature, createShellGlowMaterial, getFieldPositionForTile } from './sceneShells';
import { workspaceShellPreviewRegistry } from './sceneShellPreviewRegistry';
import type { ShellRuntime, WorkspaceSceneRuntimeState, WorkspaceSceneTileDescriptor } from './sceneTypes';
import type { WorkspaceSceneTerrainController } from './sceneTerrainController';
import { WORLD_UP } from './sceneConstants';

interface WorkspaceSceneShellControllerOptions {
  shells: Map<string, ShellRuntime>;
  shellGroup: THREE.Group;
  bodyGeometry: THREE.BufferGeometry;
  panelGeometry: THREE.BufferGeometry;
  shadowGeometry: THREE.BufferGeometry;
  bodyMaterial: THREE.MeshPhysicalMaterial;
  softDotTexture: THREE.Texture;
  clock: THREE.Clock;
  camera: THREE.PerspectiveCamera;
  mainLight: THREE.DirectionalLight;
  getThemeTarget: () => WorkspaceSceneThemeDefinition;
  getState: () => WorkspaceSceneRuntimeState;
  getFlightIdleBlend: () => number;
  onShellHover?: (tileId: string | null) => void;
  timeFromIso: (value: string) => number;
  terrainController: WorkspaceSceneTerrainController;
}

export class WorkspaceSceneShellController {
  private readonly shells: Map<string, ShellRuntime>;
  private readonly shellGroup: THREE.Group;
  private readonly bodyGeometry: THREE.BufferGeometry;
  private readonly panelGeometry: THREE.BufferGeometry;
  private readonly shadowGeometry: THREE.BufferGeometry;
  private readonly bodyMaterial: THREE.MeshPhysicalMaterial;
  private readonly softDotTexture: THREE.Texture;
  private readonly clock: THREE.Clock;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly mainLight: THREE.DirectionalLight;
  private readonly getThemeTarget: () => WorkspaceSceneThemeDefinition;
  private readonly getState: () => WorkspaceSceneRuntimeState;
  private readonly getFlightIdleBlend: () => number;
  private readonly onShellHover: ((tileId: string | null) => void) | null;
  private readonly timeFromIso: (value: string) => number;
  private readonly terrainController: WorkspaceSceneTerrainController;
  private readonly toCameraFlat = new THREE.Vector3();
  private readonly desiredQuaternion = new THREE.Quaternion();
  private readonly surfaceQuaternion = new THREE.Quaternion();
  private readonly flightQuaternion = new THREE.Quaternion();
  private readonly orientationOffsetQuaternion = new THREE.Quaternion();
  private readonly lookMatrix = new THREE.Matrix4();
  private readonly shellEuler = new THREE.Euler();
  private readonly shadowPoint = new THREE.Vector3();
  private readonly shadowNormal = new THREE.Vector3();
  private readonly shadowLightDirection = new THREE.Vector3();
  private readonly shadowTangent = new THREE.Vector3();
  private readonly shadowBitangent = new THREE.Vector3();
  private readonly shadowBasis = new THREE.Matrix4();
  private readonly scratchColorA = new THREE.Color();
  private readonly scratchColorB = new THREE.Color();
  private readonly scratchColorC = new THREE.Color();
  private readonly scaleTarget = new THREE.Vector3(1, 1, 1);
  private hoveredShellId: string | null = null;

  constructor(options: WorkspaceSceneShellControllerOptions) {
    this.shells = options.shells;
    this.shellGroup = options.shellGroup;
    this.bodyGeometry = options.bodyGeometry;
    this.panelGeometry = options.panelGeometry;
    this.shadowGeometry = options.shadowGeometry;
    this.bodyMaterial = options.bodyMaterial;
    this.softDotTexture = options.softDotTexture;
    this.clock = options.clock;
    this.camera = options.camera;
    this.mainLight = options.mainLight;
    this.getThemeTarget = options.getThemeTarget;
    this.getState = options.getState;
    this.getFlightIdleBlend = options.getFlightIdleBlend;
    this.onShellHover = options.onShellHover ?? null;
    this.timeFromIso = options.timeFromIso;
    this.terrainController = options.terrainController;
  }

  syncShells(tiles: WorkspaceSceneTileDescriptor[]) {
    const nextIds = new Set(tiles.map((tile) => tile.id));

    this.shells.forEach((shell, id) => {
      if (!nextIds.has(id)) {
        this.disposeShell(shell);
        this.shells.delete(id);
      }
    });

    tiles.forEach((tile) => {
      const field = getFieldPositionForTile(tile);
      let shell = this.shells.get(tile.id);
      if (!shell) {
        shell = this.createShell(tile);
        shell.terrainLocalPoint.set(field.x, field.y, 0);
        this.shells.set(tile.id, shell);
        this.shellGroup.add(shell.shadow);
        this.shellGroup.add(shell.group);
      }

      shell.descriptor = tile;
      shell.depth = field.depth;
      shell.terrainLocalPoint.set(field.x, field.y, 0);
      applyShellDimensions(shell);
      this.updateShellTexture(shell);
    });
  }

  refreshPreviewTextures() {
    this.shells.forEach((shell) => {
      this.updateShellTexture(shell);
    });
  }

  updateAnimations(delta: number, time: number) {
    const state = this.getState();
    const theme = this.getThemeTarget();
    const shellVisual = WORKSPACE_SCENE_SHELL_VISUAL_TUNING[theme.id];
    const focusScale = state.flightMode ? THREE.MathUtils.lerp(1, 0.65, this.getFlightIdleBlend()) : 0.65;

    this.shells.forEach((shell) => {
      const hoveredInFlight = state.flightMode && this.hoveredShellId === shell.descriptor.id;
      const field = getFieldPositionForTile(shell.descriptor);
      this.terrainController.sampleTerrainPoint(shell.terrainLocalPoint.x, shell.terrainLocalPoint.y, shell.terrainWorldPoint, shell.terrainWorldNormal);

      const introAge = time - shell.introAt;
      const introProgress = THREE.MathUtils.clamp(introAge / 1.85, 0, 1);
      const introOffset = (1 - easeOutCubic(introProgress)) * (shell.profile.introLift + shell.seed * 0.16);
      const bobAmplitude = state.flightMode ? 0.06 : 0.024;
      const bob = Math.sin(time * (0.8 + shell.seed * 0.03) + shell.seed) * bobAmplitude;
      const focusLift = shell.descriptor.isFocused ? 0.22 * focusScale : 0;
      const hoverPreviewLift = hoveredInFlight
        ? (shell.descriptor.distance3D === 'near' ? 0.34 : shell.descriptor.distance3D === 'far' ? 0.18 : 0.26)
        : 0;
      const hoverLift = field.hover + bob + focusLift + hoverPreviewLift;
      const distanceScale =
        shell.descriptor.distance3D === 'near'
          ? shellVisual.distanceScaleNear
          : shell.descriptor.distance3D === 'far'
            ? shellVisual.distanceScaleFar
            : shellVisual.distanceScaleMid;
      const interactionScale = shell.descriptor.isFocused ? 1.06 : hoveredInFlight ? 1.035 : 1;
      this.scaleTarget.setScalar(distanceScale * interactionScale);
      shell.group.scale.lerp(this.scaleTarget, delta * 4.4);

      shell.targetPosition.copy(shell.terrainWorldPoint).addScaledVector(WORLD_UP, hoverLift + introOffset);
      shell.group.position.lerp(shell.targetPosition, state.flightMode ? delta * 5 : delta * (shell.landed ? 4.2 : 3.15));

      if (!shell.landed && introProgress >= 1) {
        shell.landed = true;
        this.terrainController.pushImpactWave(shell.terrainWorldPoint, THREE.MathUtils.clamp(0.52 + shell.depth * 0.065, 0.48, 1.5), time);
      }

      this.toCameraFlat.copy(this.camera.position).sub(shell.group.position).setY(0);
      const surfaceYaw = Math.atan2(this.toCameraFlat.x, this.toCameraFlat.z);
      const surfacePitch = -0.014 - Math.sin(time * 0.5 + shell.seed) * 0.007;
      const surfaceRoll = Math.cos(time * 0.55 + shell.seed) * 0.006;
      this.surfaceQuaternion.setFromEuler(this.shellEuler.set(surfacePitch, surfaceYaw, surfaceRoll));

      if (state.flightMode) {
        const yaw = shell.descriptor.distance3D === 'far' ? -0.035 : shell.descriptor.distance3D === 'near' ? 0.03 : 0;
        const pitch = -0.024 + Math.sin(time * 0.42 + shell.seed) * 0.012;
        const roll = Math.cos(time * 0.48 + shell.seed * 0.7) * 0.016;
        this.orientationOffsetQuaternion.setFromEuler(this.shellEuler.set(pitch, yaw, roll));
        this.flightQuaternion.copy(this.surfaceQuaternion).multiply(this.orientationOffsetQuaternion);
        this.desiredQuaternion.copy(this.flightQuaternion).slerp(this.surfaceQuaternion, this.getFlightIdleBlend());
        if (hoveredInFlight || shell.descriptor.isFocused) {
          this.desiredQuaternion.slerp(this.surfaceQuaternion, hoveredInFlight ? 0.66 : 0.32);
        }
      } else {
        this.desiredQuaternion.copy(this.surfaceQuaternion);
      }
      shell.group.quaternion.slerp(this.desiredQuaternion, state.flightMode ? delta * 4.6 : delta * 5.2);

      const glowUniforms = (shell.glowMaterial as unknown as THREE.ShaderMaterial).uniforms;
      if (glowUniforms) {
        const surfaceGlowOpacity = shellVisual.surfaceGlowOpacity + (shell.descriptor.isFocused ? 0.08 : 0);
        const flightGlowOpacity = shellVisual.flightGlowOpacity
          + (shell.descriptor.isFocused ? 0.1 : 0)
          + (hoveredInFlight ? shellVisual.hoverGlowBoost : 0);
        const glowOpacityTarget = state.flightMode
          ? THREE.MathUtils.clamp(THREE.MathUtils.lerp(flightGlowOpacity, surfaceGlowOpacity, this.getFlightIdleBlend()), 0, 0.42)
          : THREE.MathUtils.clamp(surfaceGlowOpacity, 0, 0.42);
        glowUniforms.uOpacity.value += (glowOpacityTarget - glowUniforms.uOpacity.value) * (delta * 3.2);
      }

      const surfaceScreenOpacity = shellVisual.surfaceScreenOpacity + (shell.descriptor.isFocused ? 0.08 : 0);
      const flightScreenOpacity = shellVisual.flightScreenOpacity + (hoveredInFlight ? shellVisual.hoverScreenBoost : 0);
      const screenOpacityTarget = state.flightMode
        ? THREE.MathUtils.clamp(THREE.MathUtils.lerp(flightScreenOpacity, surfaceScreenOpacity, this.getFlightIdleBlend()), 0.4, 1)
        : THREE.MathUtils.clamp(surfaceScreenOpacity, 0.4, 1);
      shell.screenMaterial.opacity += (screenOpacityTarget - shell.screenMaterial.opacity) * (delta * 2.8);

      const screenTint = WORKSPACE_WIDGET_ACCENTS[shell.descriptor.kind].accent;
      const accentColor = this.scratchColorB.set(screenTint);
      const surfaceScreenColor = this.scratchColorA.set('#ffffff').lerp(accentColor, shellVisual.surfaceAccentMix);
      const flightScreenColor = this.scratchColorC.set('#ffffff').lerp(accentColor, shellVisual.flightAccentMix);
      const screenColorTarget = state.flightMode
        ? this.scratchColorB.copy(flightScreenColor).lerp(surfaceScreenColor, this.getFlightIdleBlend())
        : surfaceScreenColor;
      shell.screenMaterial.color.lerp(screenColorTarget, delta * 2.4);
      shell.backMaterial.color.lerp(this.scratchColorA.set(theme.shellBack), delta * 2);

      this.lookMatrix.lookAt(shell.group.position, this.camera.position, WORLD_UP);
      shell.glow.quaternion.setFromRotationMatrix(this.lookMatrix);
      const glowDistanceScale = 1 + (distanceScale - 1) * 0.38;
      const glowScaleX = (shell.descriptor.isFocused ? 1.16 : hoveredInFlight ? 1.08 : 1) * glowDistanceScale;
      const glowScaleY = (shell.descriptor.isFocused ? 1.2 : hoveredInFlight ? 1.12 : 1) * glowDistanceScale;
      shell.glow.scale.x = THREE.MathUtils.lerp(shell.glow.scale.x, glowScaleX, delta * 4);
      shell.glow.scale.y = THREE.MathUtils.lerp(shell.glow.scale.y, glowScaleY, delta * 4);

      this.updateProjectedShadow(shell, delta, state.flightMode, hoveredInFlight);
    });
  }

  updateHover(raycaster: THREE.Raycaster, pointer: THREE.Vector2) {
    if (!this.shells.size) {
      this.setHoveredShellId(null);
      return;
    }

    raycaster.setFromCamera(pointer, this.camera);
    let closestId: string | null = null;
    let closestDist = Infinity;

    this.shells.forEach((shell, id) => {
      const hits = raycaster.intersectObjects([shell.screen, shell.body], false);
      if (hits.length && hits[0].distance < closestDist) {
        closestDist = hits[0].distance;
        closestId = id;
      }
    });

    this.setHoveredShellId(closestId);
  }

  clearHover() {
    this.setHoveredShellId(null);
  }

  getHoveredShellId() {
    return this.hoveredShellId;
  }

  disposeAll() {
    this.shells.forEach((shell) => this.disposeShell(shell));
    this.shells.clear();
  }

  private createShell(tile: WorkspaceSceneTileDescriptor) {
    const texture = createShellTexture(tile);
    const profile = WORKSPACE_WIDGET_SHELL_PROFILES[tile.kind];
    const screenMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.28,
      toneMapped: false,
      color: new THREE.Color('#ffffff'),
    });
    const backMaterial = new THREE.MeshBasicMaterial({
      color: this.getThemeTarget().shellBack,
      transparent: true,
      opacity: 0.92,
    });
    const glowMaterial = createShellGlowMaterial(this.getThemeTarget().shellGlow);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x02050a,
      transparent: true,
      opacity: 0.12,
      alphaMap: this.softDotTexture,
      alphaTest: 0.02,
      depthWrite: false,
      toneMapped: false,
    });

    const group = new THREE.Group();
    const body = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
    const screen = new THREE.Mesh(this.panelGeometry, screenMaterial);
    const backPanel = new THREE.Mesh(this.panelGeometry, backMaterial);
    const glow = new THREE.Mesh(this.panelGeometry, glowMaterial);
    const shadow = new THREE.Mesh(this.shadowGeometry, shadowMaterial);

    group.add(glow);
    group.add(body);
    group.add(backPanel);
    group.add(screen);

    const recentAge = this.timeFromIso(tile.createdAt);
    const shell: ShellRuntime = {
      descriptor: tile,
      group,
      body,
      screen,
      backPanel,
      glow,
      shadow,
      screenMaterial,
      backMaterial,
      glowMaterial,
      shadowMaterial,
      texture,
      targetPosition: new THREE.Vector3(),
      terrainWorldPoint: new THREE.Vector3(),
      terrainWorldNormal: new THREE.Vector3(0, 1, 0),
      terrainLocalPoint: new THREE.Vector3(),
      profile,
      seed: seedFromId(tile.id),
      introAt: recentAge <= 16 ? this.clock.elapsedTime - recentAge : -100,
      landed: recentAge > 3,
      textureSignature: buildShellTextureSignature(tile),
      previewRevision: 0,
      depth: 0,
    };

    applyShellDimensions(shell);
    this.updateShellTexture(shell);
    return shell;
  }

  private updateProjectedShadow(shell: ShellRuntime, delta: number, flightMode: boolean, hoveredInFlight: boolean) {
    const theme = this.getThemeTarget();
    this.shadowLightDirection.copy(shell.group.position).sub(this.mainLight.position).normalize();
    if (this.shadowLightDirection.y > -0.12) {
      this.shadowLightDirection.y = -0.12;
      this.shadowLightDirection.normalize();
    }

    this.terrainController.projectAlongDirection(
      shell.group.position,
      this.shadowLightDirection,
      shell.terrainWorldPoint,
      shell.terrainWorldNormal,
      this.shadowPoint,
      this.shadowNormal,
    );

    const heightAboveTerrain = shell.group.position.distanceTo(this.shadowPoint);
    shell.shadow.position.copy(this.shadowPoint).addScaledVector(this.shadowNormal, 0.08);

    this.shadowTangent.copy(this.shadowLightDirection).projectOnPlane(this.shadowNormal);
    if (this.shadowTangent.lengthSq() < 0.0001) {
      this.shadowTangent.set(0, 1, 0).projectOnPlane(this.shadowNormal);
    }
    this.shadowTangent.normalize();
    this.shadowBitangent.crossVectors(this.shadowNormal, this.shadowTangent).normalize();
    this.shadowBasis.makeBasis(this.shadowBitangent, this.shadowTangent, this.shadowNormal);
    shell.shadow.quaternion.setFromRotationMatrix(this.shadowBasis);

    const grazing = 1 - Math.abs(this.shadowLightDirection.dot(this.shadowNormal));
    const shellScale = shell.group.scale.x;
    const baseWidth = shell.body.scale.x * shellScale * (0.82 + heightAboveTerrain * 0.028);
    const baseLength = shell.body.scale.y * shellScale * (0.34 + heightAboveTerrain * 0.056 + grazing * 0.16);
    shell.shadow.scale.x = THREE.MathUtils.lerp(shell.shadow.scale.x, baseWidth, delta * 6);
    shell.shadow.scale.y = THREE.MathUtils.lerp(shell.shadow.scale.y, baseLength, delta * 6);

    const surfaceOpacity = THREE.MathUtils.clamp(0.15 - heightAboveTerrain * 0.016, 0.04, 0.15);
    const flightOpacity = THREE.MathUtils.clamp(0.12 - heightAboveTerrain * 0.01, 0.032, 0.12);
    const focusBoost = shell.descriptor.isFocused ? 0.018 : hoveredInFlight ? 0.012 : 0;
    const shadowOpacityTarget = (flightMode ? flightOpacity : surfaceOpacity) + focusBoost;
    shell.shadowMaterial.opacity += (shadowOpacityTarget - shell.shadowMaterial.opacity) * (delta * 4.2);
    shell.shadowMaterial.color.lerp(
      this.scratchColorA.set('#01060b')
        .lerp(this.scratchColorB.set(theme.terrainFill), 0.18)
        .lerp(this.scratchColorB.set(theme.fog), 0.16),
      delta * 2.2,
    );
  }

  private updateShellTexture(shell: ShellRuntime) {
    const nextSignature = buildShellTextureSignature(shell.descriptor);
    if (nextSignature !== shell.textureSignature) {
      shell.textureSignature = nextSignature;
      workspaceShellPreviewRegistry.requestCapture(shell.descriptor.id);

      if (shell.previewRevision === 0 && shell.texture.image instanceof HTMLCanvasElement) {
        paintShellTexture(shell.texture.image, shell.descriptor);
        shell.texture.needsUpdate = true;
      }
    }

    const livePreview = workspaceShellPreviewRegistry.getSnapshot(shell.descriptor.id);
    if (livePreview) {
      if (livePreview.revision !== shell.previewRevision || shell.texture.image !== livePreview.canvas) {
        shell.texture.image = livePreview.canvas;
        shell.texture.needsUpdate = true;
        shell.previewRevision = livePreview.revision;
      }
      return;
    }

    workspaceShellPreviewRegistry.requestCapture(shell.descriptor.id);

    if (shell.previewRevision !== 0) {
      shell.previewRevision = 0;
      if (shell.texture.image instanceof HTMLCanvasElement) {
        paintShellTexture(shell.texture.image, shell.descriptor);
      } else {
        shell.texture = createShellTexture(shell.descriptor);
        shell.screenMaterial.map = shell.texture;
      }
      shell.texture.needsUpdate = true;
    }
  }

  private disposeShell(shell: ShellRuntime) {
    shell.texture.dispose();
    shell.screenMaterial.dispose();
    shell.backMaterial.dispose();
    shell.glowMaterial.dispose();
    shell.shadowMaterial.dispose();
    this.shellGroup.remove(shell.shadow);
    this.shellGroup.remove(shell.group);
  }

  private setHoveredShellId(tileId: string | null) {
    if (tileId === this.hoveredShellId) {
      return;
    }

    this.hoveredShellId = tileId;
    this.onShellHover?.(tileId);
  }
}
