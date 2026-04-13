import * as THREE from 'three';
import { clamp } from './sceneHelpers';

export function computeSurfaceOrbitPosition(
  baseCameraPosition: THREE.Vector3,
  baseCameraTarget: THREE.Vector3,
  orbitTheta: number,
  orbitPhi: number,
  outPosition: THREE.Vector3,
) {
  const orbitArmX = baseCameraPosition.x - baseCameraTarget.x;
  const orbitArmY = baseCameraPosition.y - baseCameraTarget.y;
  const orbitArmZ = baseCameraPosition.z - baseCameraTarget.z;
  const orbitRadius = Math.sqrt(
    orbitArmX * orbitArmX
    + orbitArmY * orbitArmY
    + orbitArmZ * orbitArmZ,
  );
  const baseTheta = Math.atan2(orbitArmX, orbitArmZ);
  const basePhi = Math.acos(clamp(orbitArmY / orbitRadius, -1, 1));
  const theta = baseTheta + orbitTheta;
  const phi = clamp(basePhi + orbitPhi, 0.18, Math.PI / 2 + 0.28);

  outPosition.set(
    baseCameraTarget.x + orbitRadius * Math.sin(phi) * Math.sin(theta),
    baseCameraTarget.y + orbitRadius * Math.cos(phi),
    baseCameraTarget.z + orbitRadius * Math.sin(phi) * Math.cos(theta),
  );
}

export function computePresentationMetrics(
  laneWidth: number,
  laneDepth: number,
  focusX: number,
  heroCameraDistance: number,
  heroTargetLift: number,
) {
  const spread = Math.max(laneWidth * 0.62, laneDepth * 0.78);

  return {
    spread,
    cameraDistance: heroCameraDistance + clamp(spread * 0.5, 0, 26),
    targetLift: heroTargetLift + clamp(laneDepth * 0.04, 0, 1.8),
    lateralBias: clamp(focusX * 0.06, -4.2, 4.2),
  };
}
