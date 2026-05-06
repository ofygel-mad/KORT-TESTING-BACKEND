import type * as THREE from 'three';
import type { DevicePerformanceProfile } from '../../../shared/lib/browser';
import type {
  WorkspaceTileDistance,
  WorkspaceTileStatus,
  WorkspaceWidgetKind,
} from '../model/types';
import type { WorkspaceWidgetShellProfile } from './sceneConfig';

export interface WorkspaceSceneTileDescriptor {
  id: string;
  kind: WorkspaceWidgetKind;
  title: string;
  version: number;
  status: WorkspaceTileStatus;
  distance3D: WorkspaceTileDistance;
  width: number;
  height: number;
  normalizedX: number;
  normalizedY: number;
  isFocused: boolean;
  isPinned: boolean;
  createdAt: string;
}

export interface WorkspaceSceneRuntimeState {
  theme: import('../model/types').WorkspaceSceneTheme;
  themeAuto: boolean;
  flightMode: boolean;
  terrainMode: import('../model/types').WorkspaceSceneTerrainMode;
  tiles: WorkspaceSceneTileDescriptor[];
}

export interface WorkspaceSceneRuntimeOptions {
  canvas: HTMLCanvasElement;
  host: HTMLElement;
  qualityProfile: DevicePerformanceProfile;
  onFlightTileProjection?: (tiles: WorkspaceSceneFlightTileProjection[]) => void;
}

export interface WorkspaceSceneFlightTileProjection {
  id: string;
  left: number;
  top: number;
  scale: number;
  opacity: number;
  blur: number;
  zIndex: number;
  visible: boolean;
}

export type ImpactWave = {
  localPoint: THREE.Vector3;
  startedAt: number;
  strength: number;
};

export type TerrainInfluence = {
  localPoint: THREE.Vector3;
  radius: number;
  depth: number;
  ripple: number;
  wobble: number;
};

export type LandingState = {
  active: boolean;
  targetY: number;
  velocity: number;
  strength: number;
};

export type ShellRuntime = {
  descriptor: WorkspaceSceneTileDescriptor;
  group: THREE.Group;
  body: THREE.Mesh;
  screen: THREE.Mesh;
  backPanel: THREE.Mesh;
  glow: THREE.Mesh;
  shadow: THREE.Mesh;
  screenMaterial: THREE.MeshBasicMaterial;
  backMaterial: THREE.MeshBasicMaterial;
  glowMaterial: THREE.MeshBasicMaterial;
  shadowMaterial: THREE.MeshBasicMaterial;
  texture: THREE.CanvasTexture;
  targetPosition: THREE.Vector3;
  terrainWorldPoint: THREE.Vector3;
  terrainWorldNormal: THREE.Vector3;
  terrainLocalPoint: THREE.Vector3;
  profile: WorkspaceWidgetShellProfile;
  seed: number;
  introAt: number;
  landed: boolean;
  textureSignature: string;
  previewRevision: number;
  depth: number;
};
