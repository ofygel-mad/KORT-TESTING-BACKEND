import * as THREE from 'three';
import { getTileDistanceOffset } from './sceneConfig';
import type { ShellRuntime, WorkspaceSceneTileDescriptor } from './sceneTypes';

export function buildShellTextureSignature(tile: WorkspaceSceneTileDescriptor) {
  return `${tile.kind}:${tile.title}:${tile.distance3D}:${tile.status}:${tile.version}`;
}

export function createShellGlowMaterial(color: string) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0.12 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec2 center = vUv - 0.5;
        float dist = length(center) * 2.0;
        float falloff = 1.0 - smoothstep(0.0, 1.0, dist);
        gl_FragColor = vec4(uColor, uOpacity * falloff * falloff);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }) as unknown as THREE.MeshBasicMaterial;
}

export function applyShellDimensions(shell: ShellRuntime) {
  const width = Math.min(Math.max(shell.descriptor.width / 70, 3.1), 5.2);
  const height = Math.min(Math.max(shell.descriptor.height / 82, 1.85), 3.4);
  const depth = Math.min(Math.max(width * shell.profile.depthFactor * 0.9, 0.22), 0.4);
  const screenScale = shell.profile.screenInset;
  const backScale = Math.min(Math.max(screenScale - 0.02, 0.8), 0.92);

  shell.body.scale.set(width, height, depth);
  shell.screen.scale.set(width * screenScale, height * (screenScale - 0.04), 1);
  shell.screen.position.set(0, 0, depth * 0.53);
  shell.backPanel.scale.set(width * backScale, height * (backScale - 0.04), 1);
  shell.backPanel.position.set(0, 0, -depth * 0.53);
  shell.glow.scale.set(width * 1.12, height * 1.14, 1);
  shell.glow.position.set(0, 0, 0);
  shell.shadow.scale.set(width * 0.94, height * 0.42, 1);
  shell.shadow.position.set(0, -height * 0.55, 0);
  shell.shadow.rotation.x = -Math.PI / 2;
}

export function getFieldPositionForTile(tile: WorkspaceSceneTileDescriptor) {
  const baseZ = tile.normalizedY * 18;
  const distanceOffset = getTileDistanceOffset(tile.distance3D);
  const fieldZ = Math.min(Math.max(baseZ + distanceOffset * 0.9, -22), 18);
  const laneScale = THREE.MathUtils.mapLinear(fieldZ, -22, 18, 0.82, 1.08);
  const fieldX = Math.min(Math.max(tile.normalizedX * 28 * laneScale, -34), 34);
  const sizeLift = THREE.MathUtils.clamp((tile.width - 220) / 120, 0, 1) * 0.8;
  const hover = (
    tile.distance3D === 'near'
      ? 10.2
      : tile.distance3D === 'far'
        ? 12.4
        : 11.3
  ) + sizeLift + (tile.isPinned ? 0.35 : 0);

  return {
    x: fieldX,
    y: fieldZ,
    depth: 6.2 + (tile.distance3D === 'near' ? 1.9 : tile.distance3D === 'far' ? -0.9 : 0),
    hover,
  };
}
