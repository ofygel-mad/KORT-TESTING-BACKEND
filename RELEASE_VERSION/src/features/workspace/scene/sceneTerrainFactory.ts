import * as THREE from 'three';
import type { WorkspaceSceneThemeDefinition } from './sceneConfig';
import {
  createCircularTerrainGeometry,
  createBoundaryFogMaterial,
  createTerrainFogMaterial,
} from './sceneHelpers';
import { buildPeakBeaconField, createPeakBeaconMaterial } from './sceneTerrain';
import {
  TERRAIN_FOG_INNER_RADIUS,
  TERRAIN_FOG_OUTER_RADIUS,
  TERRAIN_RADIUS,
} from './sceneConstants';

// ── Terrain LOD bundle ──────────────────────────────────────────────────────

export type TerrainLODData = {
  geometry: THREE.BufferGeometry;
  positions: THREE.BufferAttribute;
  baseX: Float32Array;
  baseY: Float32Array;
  initialZ: Float32Array;
};

export function buildTerrainLOD(segments: number): TerrainLODData {
  const geometry = createCircularTerrainGeometry(TERRAIN_RADIUS, segments, segments);
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const baseX = new Float32Array(positions.count);
  const baseY = new Float32Array(positions.count);
  const initialZ = new Float32Array(positions.count);

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const radialDistance = Math.hypot(x, y);
    const edgeBlend = THREE.MathUtils.smoothstep(radialDistance, TERRAIN_RADIUS * 0.7, TERRAIN_RADIUS);
    const z = (Math.random() - 0.5) * (3.8 - edgeBlend * 2.2) - edgeBlend * 9.5;

    baseX[index] = x;
    baseY[index] = y;
    initialZ[index] = z;
    positions.setZ(index, z);
  }

  geometry.computeVertexNormals();
  return { geometry, positions, baseX, baseY, initialZ };
}

// ── Terrain mesh bundle ─────────────────────────────────────────────────────

export type TerrainMeshes = {
  surface: THREE.Mesh;
  wireframe: THREE.Mesh;
  glowWireframe: THREE.Mesh;
  surfacePoints: THREE.Points;
  peakBeacons: THREE.Points;
  peakBeaconPositions: THREE.BufferAttribute;
  peakBeaconIntensity: THREE.BufferAttribute;
  peakBeaconIndices: Uint32Array;
  boundaryFog: THREE.Mesh;
  terrainFogLayer: THREE.Mesh;
};

export function createTerrainMeshes(
  geometry: THREE.BufferGeometry,
  theme: WorkspaceSceneThemeDefinition,
  softDotTexture: THREE.CanvasTexture,
  surfaceBaseX: Float32Array,
  surfaceBaseY: Float32Array,
  fogInteractionPoints: THREE.Vector3[],
  fogInteractionWeights: number[],
): TerrainMeshes {
  const surface = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: theme.terrainFill,
    emissive: theme.terrainEmissive,
    emissiveIntensity: theme.emissiveIntensity,
    roughness: theme.meshRoughness,
    metalness: theme.meshMetalness,
    flatShading: true,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.96,
  }));

  const wireframe = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: theme.terrainWire,
    wireframe: true,
    transparent: true,
    opacity: theme.wireOpacity,
    blending: THREE.NormalBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -6,
  }));
  wireframe.scale.setScalar(1.0028);
  wireframe.renderOrder = 1;

  const glowWireframe = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: theme.terrainGlow,
    wireframe: true,
    transparent: true,
    opacity: 0.04,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -9,
  }));
  glowWireframe.scale.setScalar(1.0038);
  glowWireframe.renderOrder = 2;

  const surfacePoints = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: theme.terrainPoints,
    size: 0.058,
    transparent: true,
    opacity: theme.pointsOpacity,
    alphaMap: softDotTexture,
    alphaTest: 0.08,
    blending: THREE.NormalBlending,
    depthWrite: false,
  }));

  const peakBeaconField = buildPeakBeaconField(surfaceBaseX, surfaceBaseY, TERRAIN_RADIUS);
  const peakBeaconGeometry = new THREE.BufferGeometry();
  const peakBeaconPositions = new THREE.BufferAttribute(peakBeaconField.positions, 3);
  const peakBeaconIntensity = new THREE.BufferAttribute(peakBeaconField.intensity, 1);
  peakBeaconGeometry.setAttribute('position', peakBeaconPositions);
  peakBeaconGeometry.setAttribute('aIntensity', peakBeaconIntensity);
  peakBeaconGeometry.setAttribute('aSeed', new THREE.BufferAttribute(peakBeaconField.seeds, 1));
  const peakBeacons = new THREE.Points(peakBeaconGeometry, createPeakBeaconMaterial(theme.terrainBeacon));
  peakBeacons.renderOrder = 4;
  peakBeacons.visible = false;

  const boundaryFog = new THREE.Mesh(
    new THREE.RingGeometry(TERRAIN_FOG_INNER_RADIUS, TERRAIN_FOG_OUTER_RADIUS, 64, 1),
    createBoundaryFogMaterial(theme, TERRAIN_FOG_INNER_RADIUS, TERRAIN_FOG_OUTER_RADIUS),
  );
  boundaryFog.position.z = 5.8;
  boundaryFog.visible = false;

  const terrainFogLayer = new THREE.Mesh(
    new THREE.CircleGeometry(TERRAIN_RADIUS * 1.02, 64),
    createTerrainFogMaterial(theme, fogInteractionPoints, fogInteractionWeights),
  );
  terrainFogLayer.position.z = 8.6;

  return {
    surface,
    wireframe,
    glowWireframe,
    surfacePoints,
    peakBeacons,
    peakBeaconPositions,
    peakBeaconIntensity,
    peakBeaconIndices: peakBeaconField.indices,
    boundaryFog,
    terrainFogLayer,
  };
}

// ── Disposal helper ─────────────────────────────────────────────────────────

export function disposeMeshes(...meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments)[]) {
  for (const mesh of meshes) {
    (mesh.geometry as THREE.BufferGeometry).dispose();
    if (Array.isArray(mesh.material)) {
      for (const mat of mesh.material) (mat as THREE.Material).dispose();
    } else {
      (mesh.material as THREE.Material).dispose();
    }
  }
}
