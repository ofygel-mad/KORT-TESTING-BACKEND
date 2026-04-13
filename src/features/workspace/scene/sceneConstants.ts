import * as THREE from 'three';

export const MOVEMENT_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'Space',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
]);

export const WORLD_UP = new THREE.Vector3(0, 1, 0);
export const WORLD_FORWARD = new THREE.Vector3(0, 0, 1);
export const DOWN = new THREE.Vector3(0, -1, 0);
export const TERRAIN_RADIUS = 128;
export const TERRAIN_FLIGHT_RADIUS = TERRAIN_RADIUS * 0.92;
export const TERRAIN_FOG_INNER_RADIUS = TERRAIN_RADIUS * 0.88;
export const TERRAIN_FOG_OUTER_RADIUS = TERRAIN_RADIUS * 1.18;
export const TERRAIN_Y_OFFSET = -10;
export const MIN_FLIGHT_LOCAL_HEIGHT = 7.2;
export const MAX_FLIGHT_LOCAL_HEIGHT = 62;
export const MIN_SURFACE_CAMERA_CLEARANCE = 3.2;
export const MAX_FLIGHT_PITCH = Math.PI / 2 - 0.12;
export const DRAG_ROTATION_SPEED = 0.0052;
export const SURFACE_POINTER_EASING = 0.06;
export const FLIGHT_POINTER_EASING = 0.11;
export const SURFACE_CAMERA_LERP = 1.72;
export const SURFACE_TARGET_LERP = 1.9;
export const FLIGHT_BASE_SPEED = 66;
export const FLIGHT_ACCELERATION = 4.8;
export const FLIGHT_DRAG = 3.6;
export const FLIGHT_ALTITUDE_BOOST = 0.34;
export const LANDING_CAMERA_HEIGHT = 4.2;
export const FLIGHT_IDLE_TIMEOUT = 4;
export const FLIGHT_IDLE_BLEND_SPEED = 2.4;
export const HERO_CAMERA_HEIGHT = 8.6;
export const HERO_CAMERA_DISTANCE = 45;
export const HERO_TARGET_LIFT = 8.4;
export const PARTICLE_COUNT = 42;
export const RAIN_COUNT = 900;
/** High-detail geometry used when flight mode is OFF (only visible zone updated) */
export const TERRAIN_SEGMENTS_SURFACE = 152;
/** Low-detail geometry used when flight mode is ON (full terrain updated) */
export const TERRAIN_SEGMENTS_FLIGHT = 96;
/** Radius in terrain-local units within which vertices animate in surface mode */
export const TERRAIN_SURFACE_VISIBLE_RADIUS = TERRAIN_RADIUS * 1.1;
export const NEON_EDGE_BASE_COLOR = new THREE.Color(0x7ed0ff);
