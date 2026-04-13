import type { ShortcutNavItemId } from '../../../shared/navigation/appNavigation';

export type WorkspaceWidgetKind = ShortcutNavItemId;
export type WorkspaceSceneTheme = 'default' | 'morning' | 'overcast' | 'dusk' | 'night';
export type WorkspaceSceneMode = 'surface' | 'flight';
export type WorkspaceSceneTerrainMode = 'full' | 'calm' | 'void';
export type WorkspaceSceneBgMode = 'scene' | 'photo';
export type WorkspaceTileDistance = 'near' | 'mid' | 'far';

export interface WorkspaceViewport { x: number; y: number; }
export type WorkspaceModalSize = 'compact' | 'default' | 'wide';
export type WorkspaceTileStatus = 'floating' | 'drifting' | 'idle';
export interface WorkspaceEuler3D { x: number; y: number; z: number; }

export interface WorkspaceTile {
  id: string;
  kind: WorkspaceWidgetKind;
  title: string;
  x: number; y: number;
  width: number; height: number;
  modalSize: WorkspaceModalSize;
  version: number;
  createdAt: string;
  lastInteractionAt: string;
  status: WorkspaceTileStatus;
  rotation3D: WorkspaceEuler3D;
  distance3D: WorkspaceTileDistance;
  pinned?: boolean;
  zIndex?: number;
}

export interface FabPosition { x: number; y: number; }
