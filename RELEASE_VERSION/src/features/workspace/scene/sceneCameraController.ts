import * as THREE from 'three';
import type { WorkspaceSceneRuntimeState } from './sceneTypes';
import { clamp } from './sceneHelpers';
import { computeSurfaceOrbitPosition } from './sceneCamera';
import type { WorkspaceSceneTerrainController } from './sceneTerrainController';
import {
  FLIGHT_ACCELERATION,
  FLIGHT_ALTITUDE_BOOST,
  FLIGHT_BASE_SPEED,
  FLIGHT_DRAG,
  FLIGHT_IDLE_TIMEOUT,
  LANDING_CAMERA_HEIGHT,
  MAX_FLIGHT_LOCAL_HEIGHT,
  MAX_FLIGHT_PITCH,
  MIN_FLIGHT_LOCAL_HEIGHT,
  MIN_SURFACE_CAMERA_CLEARANCE,
  SURFACE_CAMERA_LERP,
  SURFACE_TARGET_LERP,
  TERRAIN_FLIGHT_RADIUS,
  WORLD_UP,
} from './sceneConstants';

interface WorkspaceSceneCameraControllerOptions {
  camera: THREE.PerspectiveCamera;
  clock: THREE.Clock;
  terrainGroup: THREE.Group;
  getState: () => WorkspaceSceneRuntimeState;
  getDragging: () => boolean;
  terrainController: WorkspaceSceneTerrainController;
}

export class WorkspaceSceneCameraController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly clock: THREE.Clock;
  private readonly terrainGroup: THREE.Group;
  private readonly getState: () => WorkspaceSceneRuntimeState;
  private readonly getDragging: () => boolean;
  private readonly terrainController: WorkspaceSceneTerrainController;
  private readonly landingState = { active: false, targetY: 0, velocity: 0, strength: 0 };
  private readonly activeMovementKeys = new Set<string>();
  private readonly desiredCameraPosition = new THREE.Vector3(0, 12.8, 72);
  private readonly desiredCameraTarget = new THREE.Vector3(0, 3.2, 0);
  private readonly cameraTarget = new THREE.Vector3(0, 3.2, 0);
  private readonly cameraForward = new THREE.Vector3(0, -0.18, -1).normalize();
  private readonly cameraRight = new THREE.Vector3();
  private readonly moveIntent = new THREE.Vector3();
  private readonly flightVelocity = new THREE.Vector3();
  private readonly desiredFlightVelocity = new THREE.Vector3();
  private readonly terrainWorldPosition = new THREE.Vector3();
  private readonly terrainLocalPosition = new THREE.Vector3();
  private readonly terrainProbePoint = new THREE.Vector3();
  private readonly terrainProbeNormal = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly presentationCameraPosition = new THREE.Vector3(0, 12.8, 72);
  private readonly presentationCameraTarget = new THREE.Vector3(0, 3.2, 0);
  private readonly presentationLookDirection = new THREE.Vector3(0, -0.18, -1).normalize();
  private readonly presentationFocusLocal = new THREE.Vector3();
  private readonly presentationFocusWorld = new THREE.Vector3();
  private readonly presentationFocusNormal = new THREE.Vector3(0, 1, 0);
  // Smoothed versions — absorb wave-induced jitter in the raycast result
  private readonly smoothedFocusWorld = new THREE.Vector3(0, 0, 0);
  private readonly smoothedFocusNormal = new THREE.Vector3(0, 1, 0);
  private surfaceOrbitTheta = 0;
  private surfaceOrbitPhi = 0;
  private surfaceOrbitTargetTheta = 0;
  private surfaceOrbitTargetPhi = 0;
  private flightYaw = 0;
  private flightPitch = -0.22;
  private flightSpeed = FLIGHT_BASE_SPEED;
  private flightIdleBlend = 0;
  private lastFlightActivityAt = 0;
  private surfaceClearanceFloorY = Number.NEGATIVE_INFINITY;
  private flightClearanceFloorY = Number.NEGATIVE_INFINITY;

  constructor(options: WorkspaceSceneCameraControllerOptions) {
    this.camera = options.camera;
    this.clock = options.clock;
    this.terrainGroup = options.terrainGroup;
    this.getState = options.getState;
    this.getDragging = options.getDragging;
    this.terrainController = options.terrainController;
  }

  update(delta: number, time: number) {
    if (this.getState().flightMode) {
      this.updateFlightCamera(delta, time);
      return;
    }

    if (this.landingState.active) {
      const dropDistance = Math.max(0, this.camera.position.y - this.landingState.targetY);
      const targetVelocity = 8 + this.landingState.strength * 12 + dropDistance * 2.6;
      this.landingState.velocity = THREE.MathUtils.lerp(this.landingState.velocity, targetVelocity, delta * 3.4);
      this.camera.position.y -= this.landingState.velocity * delta;

      if (this.camera.position.y <= this.landingState.targetY) {
        this.camera.position.y = this.landingState.targetY;
        this.landingState.active = false;
        this.terrainController.pushImpactWave(this.terrainProbePoint, this.landingState.strength, time);
      }

      this.camera.lookAt(this.lookTarget.copy(this.camera.position).add(this.cameraForward));
      return;
    }

    this.computePresentationPose();

    if (!this.getDragging()) {
      this.surfaceOrbitTargetTheta *= Math.exp(-1.2 * delta);
      this.surfaceOrbitTargetPhi *= Math.exp(-1.2 * delta);
    }
    this.surfaceOrbitTheta += (this.surfaceOrbitTargetTheta - this.surfaceOrbitTheta) * Math.min(1, delta * 6);
    this.surfaceOrbitPhi += (this.surfaceOrbitTargetPhi - this.surfaceOrbitPhi) * Math.min(1, delta * 6);

    computeSurfaceOrbitPosition(
      this.presentationCameraPosition,
      this.presentationCameraTarget,
      this.surfaceOrbitTheta,
      this.surfaceOrbitPhi,
      this.desiredCameraPosition,
    );
    this.desiredCameraTarget.copy(this.presentationCameraTarget);

    this.camera.position.lerp(this.desiredCameraPosition, delta * SURFACE_CAMERA_LERP);
    this.cameraTarget.lerp(this.desiredCameraTarget, delta * SURFACE_TARGET_LERP);
    this.camera.lookAt(this.cameraTarget);
    this.terrainController.clampCameraAboveTerrainPlane(this.camera.position, MIN_SURFACE_CAMERA_CLEARANCE);
    this.applySmoothedSurfaceClearance(this.camera.position, MIN_SURFACE_CAMERA_CLEARANCE, delta, false);
    this.camera.lookAt(this.cameraTarget);

  }

  applyFlightMode(enabled: boolean) {
    this.activeMovementKeys.clear();
    this.flightVelocity.set(0, 0, 0);
    this.desiredFlightVelocity.set(0, 0, 0);
    this.surfaceOrbitTheta = 0;
    this.surfaceOrbitPhi = 0;
    this.surfaceOrbitTargetTheta = 0;
    this.surfaceOrbitTargetPhi = 0;
    this.flightIdleBlend = 0;
    this.surfaceClearanceFloorY = Number.NEGATIVE_INFINITY;
    this.flightClearanceFloorY = Number.NEGATIVE_INFINITY;

    if (enabled) {
      this.syncFlightLookFromCamera();
      this.constrainFlightPosition(this.camera.position);
      this.markFlightActivity();
      return;
    }

    this.beginSurfaceLanding();
  }

  initializeFromCamera() {
    this.syncFlightLookFromCamera();
  }

  placeHeroEntry() {
    this.computePresentationPose();
    this.camera.position.copy(this.presentationCameraPosition);
    this.cameraTarget.copy(this.presentationCameraTarget);
    this.camera.lookAt(this.presentationCameraTarget);
  }

  applyPointerDrag(deltaX: number, deltaY: number, flightMode: boolean) {
    if (flightMode) {
      this.flightYaw -= deltaX * 0.0052;
      this.flightPitch = clamp(
        this.flightPitch - deltaY * 0.0052 * 0.72,
        -MAX_FLIGHT_PITCH,
        MAX_FLIGHT_PITCH,
      );
      this.markFlightActivity();
      return;
    }

    this.surfaceOrbitTargetTheta = clamp(
      this.surfaceOrbitTargetTheta - deltaX * 0.0052 * 0.42,
      -0.34,
      0.34,
    );
    this.surfaceOrbitTargetPhi = clamp(
      this.surfaceOrbitTargetPhi - deltaY * 0.0052 * 0.24,
      -0.18,
      0.18,
    );
  }

  addMovementKey(code: string) {
    this.activeMovementKeys.add(code);
    this.markFlightActivity();
  }

  removeMovementKey(code: string) {
    this.activeMovementKeys.delete(code);
  }

  clearMovementKeys() {
    this.activeMovementKeys.clear();
  }

  clearInteractionState() {
    this.activeMovementKeys.clear();
  }

  getFlightIdleBlend() {
    return this.flightIdleBlend;
  }

  markInteraction() {
    this.markFlightActivity();
  }

  private updateFlightCamera(delta: number, time: number) {
    this.cameraForward.set(
      Math.sin(this.flightYaw) * Math.cos(this.flightPitch),
      Math.sin(this.flightPitch),
      Math.cos(this.flightYaw) * Math.cos(this.flightPitch),
    ).normalize();

    this.cameraRight.crossVectors(WORLD_UP, this.cameraForward).normalize();
    this.moveIntent.set(0, 0, 0);

    if (this.activeMovementKeys.has('KeyW')) this.moveIntent.add(this.cameraForward);
    if (this.activeMovementKeys.has('KeyS')) this.moveIntent.sub(this.cameraForward);
    if (this.activeMovementKeys.has('KeyD')) this.moveIntent.sub(this.cameraRight);
    if (this.activeMovementKeys.has('KeyA')) this.moveIntent.add(this.cameraRight);
    if (this.activeMovementKeys.has('Space')) this.moveIntent.add(WORLD_UP);
    if (this.activeMovementKeys.has('ShiftLeft') || this.activeMovementKeys.has('ShiftRight') || this.activeMovementKeys.has('ControlLeft') || this.activeMovementKeys.has('ControlRight')) {
      this.moveIntent.sub(WORLD_UP);
    }

    this.terrainLocalPosition.copy(this.camera.position);
    this.terrainGroup.worldToLocal(this.terrainLocalPosition);
    const altitudeFactor = THREE.MathUtils.smoothstep(this.terrainLocalPosition.z, MIN_FLIGHT_LOCAL_HEIGHT, 36);
    const cruiseSpeed = this.flightSpeed * (1 + altitudeFactor * FLIGHT_ALTITUDE_BOOST);

    if (this.moveIntent.lengthSq() > 0) {
      this.moveIntent.normalize();
      this.desiredFlightVelocity.copy(this.moveIntent).multiplyScalar(cruiseSpeed);
      this.markFlightActivity(time);
    } else {
      this.desiredFlightVelocity.set(0, 0, 0);
    }

    const velocityBlend = 1 - Math.exp(-FLIGHT_ACCELERATION * delta);
    this.flightVelocity.lerp(this.desiredFlightVelocity, velocityBlend);
    if (this.moveIntent.lengthSq() === 0) {
      this.flightVelocity.multiplyScalar(Math.exp(-FLIGHT_DRAG * delta));
    }

    const softBoundaryStart = TERRAIN_FLIGHT_RADIUS * 0.78;
    const localRadial = Math.hypot(this.terrainLocalPosition.x, this.terrainLocalPosition.y);
    if (localRadial > softBoundaryStart) {
      const pushback = THREE.MathUtils.smoothstep(localRadial, softBoundaryStart, TERRAIN_FLIGHT_RADIUS);
      const pushStrength = pushback * 42 * delta;
      const invR = localRadial > 0.001 ? 1 / localRadial : 0;
      this.terrainLocalPosition.set(
        this.terrainLocalPosition.x - this.terrainLocalPosition.x * invR * pushStrength,
        this.terrainLocalPosition.y - this.terrainLocalPosition.y * invR * pushStrength,
        this.terrainLocalPosition.z,
      );
      this.terrainGroup.localToWorld(this.terrainWorldPosition.copy(this.terrainLocalPosition));
      this.camera.position.copy(this.terrainWorldPosition);
      this.flightVelocity.multiplyScalar(Math.max(0, 1 - pushback * 0.6));
    }

    if (this.flightVelocity.lengthSq() > 0.0004) {
      this.terrainWorldPosition.copy(this.camera.position).addScaledVector(this.flightVelocity, delta);
      this.constrainFlightPosition(this.terrainWorldPosition, delta);
      this.camera.position.copy(this.terrainWorldPosition);
    }

    const idleBlendAlpha = 1 - Math.exp(-2.4 * delta);
    const idleActive = !this.getDragging() && this.moveIntent.lengthSq() === 0 && (time - this.lastFlightActivityAt) >= FLIGHT_IDLE_TIMEOUT;
    this.flightIdleBlend += ((idleActive ? 1 : 0) - this.flightIdleBlend) * idleBlendAlpha;

    if (this.flightIdleBlend > 0.001) {
      this.computePresentationPose();
      this.flightVelocity.multiplyScalar(Math.exp(-6.2 * delta * this.flightIdleBlend));

      const autoBlend = 1 - Math.exp(-(2.4 + this.flightIdleBlend * 2.6) * delta);
      this.terrainWorldPosition.copy(this.camera.position).lerp(this.presentationCameraPosition, autoBlend);
      this.constrainFlightPosition(this.terrainWorldPosition, delta);
      this.camera.position.copy(this.terrainWorldPosition);

      this.presentationLookDirection.copy(this.presentationCameraTarget).sub(this.camera.position).normalize();
      this.cameraForward.lerp(this.presentationLookDirection, autoBlend).normalize();
      this.syncFlightAnglesFromDirection(this.cameraForward);
    }

    this.camera.lookAt(this.lookTarget.copy(this.camera.position).add(this.cameraForward));
  }

  private syncFlightLookFromCamera() {
    this.camera.getWorldDirection(this.cameraForward);
    this.syncFlightAnglesFromDirection(this.cameraForward);
  }

  private syncFlightAnglesFromDirection(direction: THREE.Vector3) {
    this.flightYaw = Math.atan2(direction.x, direction.z);
    this.flightPitch = clamp(
      Math.asin(clamp(direction.y, -0.99, 0.99)),
      -MAX_FLIGHT_PITCH,
      MAX_FLIGHT_PITCH,
    );
  }

  private beginSurfaceLanding() {
    this.landingState.active = false;
    this.landingState.velocity = 0;
    this.landingState.strength = 0;
    this.flightVelocity.set(0, 0, 0);
    this.desiredFlightVelocity.set(0, 0, 0);

    this.camera.getWorldDirection(this.cameraForward).normalize();
    if (!this.terrainController.getTerrainPointBelow(this.camera.position, this.terrainProbePoint, this.terrainProbeNormal)) {
      return;
    }

    const landingHeight = this.terrainProbePoint.y + LANDING_CAMERA_HEIGHT;
    const dropDistance = this.camera.position.y - landingHeight;
    if (dropDistance <= 0.1) {
      this.camera.position.y = Math.max(this.camera.position.y, landingHeight);
      return;
    }

    this.landingState.active = true;
    this.landingState.targetY = landingHeight;
    this.landingState.velocity = 0;
    this.landingState.strength = clamp(dropDistance / 20, 0.24, 1.7);
  }

  private constrainFlightPosition(worldPosition: THREE.Vector3, delta = 1 / 60) {
    this.terrainLocalPosition.copy(worldPosition);
    this.terrainGroup.worldToLocal(this.terrainLocalPosition);

    const radialDistance = Math.hypot(this.terrainLocalPosition.x, this.terrainLocalPosition.y);
    if (radialDistance > TERRAIN_FLIGHT_RADIUS) {
      const scale = TERRAIN_FLIGHT_RADIUS / radialDistance;
      this.terrainLocalPosition.x *= scale;
      this.terrainLocalPosition.y *= scale;
    }

    this.terrainLocalPosition.z = THREE.MathUtils.clamp(
      this.terrainLocalPosition.z,
      MIN_FLIGHT_LOCAL_HEIGHT,
      MAX_FLIGHT_LOCAL_HEIGHT,
    );
    this.terrainGroup.localToWorld(this.terrainWorldPosition.copy(this.terrainLocalPosition));
    worldPosition.copy(this.terrainWorldPosition);
    this.applySmoothedSurfaceClearance(worldPosition, 3.1, delta, true);
  }

  private markFlightActivity(time = this.clock.elapsedTime) {
    this.lastFlightActivityAt = time;
  }

  private applySmoothedSurfaceClearance(
    worldPosition: THREE.Vector3,
    clearance: number,
    delta: number,
    flightMode: boolean,
  ) {
    if (!this.terrainController.getTerrainPointBelow(worldPosition, this.terrainProbePoint, this.terrainProbeNormal)) {
      this.terrainController.clampCameraAboveTerrainPlane(worldPosition, clearance);
      return;
    }

    const requiredY = this.terrainProbePoint.y + clearance;
    const deadband = flightMode ? 0.75 : 0.42;
    const riseBlend = 1 - Math.exp(-(flightMode ? 8.4 : 6.1) * delta);
    const fallBlend = 1 - Math.exp(-(flightMode ? 0.9 : 0.42) * delta);

    let floorY = flightMode ? this.flightClearanceFloorY : this.surfaceClearanceFloorY;
    if (!Number.isFinite(floorY)) {
      floorY = requiredY;
    } else if (requiredY > floorY + deadband) {
      floorY += (requiredY - floorY) * riseBlend;
    } else if (requiredY < floorY - deadband * 2) {
      floorY += (requiredY - floorY) * fallBlend;
    }

    if (flightMode) {
      this.flightClearanceFloorY = floorY;
    } else {
      this.surfaceClearanceFloorY = floorY;
    }

    worldPosition.y = Math.max(worldPosition.y, floorY);
  }

  private computePresentationPose() {
    // Keep the surface camera anchored to the default landscape pose so tile
    // creation/removal never reframes the scene.
    this.presentationCameraTarget.set(0, 3.2, 0);
    this.presentationCameraPosition.set(0, 12.8, 72);
    this.presentationLookDirection.copy(this.presentationCameraTarget).sub(this.presentationCameraPosition).normalize();
  }
}
