import * as THREE from 'three';
import type { WorkspaceSceneTheme } from '../model/types';
import { WORKSPACE_SCENE_THEMES, WORKSPACE_WIDGET_ACCENTS } from './sceneConfig';
import type { WorkspaceSceneTileDescriptor } from './sceneTypes';

export const _scratchColor = new THREE.Color();

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function lerpColor(target: THREE.Color, next: string, alpha: number) {
  target.lerp(_scratchColor.set(next), alpha);
}

export function seedFromId(id: string) {
  return id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) * 0.013;
}

/**
 * Unified terrain motion — shared base with 9 octaves (flight) or 13 (surface).
 * Surface mode adds 4 extra octaves and slightly higher amplitudes on 3 shared
 * terms for richer close-up detail on the 152-seg geometry.
 */
export function terrainMotion(x: number, y: number, time: number, surface = false) {
  const spatialPhase = Math.sin(x * 0.031 + y * 0.024) * 1.4 + Math.cos(x * 0.022 - y * 0.028) * 1.1;
  const zoneAmp = 0.80 + Math.sin(x * 0.016 + y * 0.013 + 1.8) * Math.cos(y * 0.019 - x * 0.011 + 0.6) * 0.26;

  let z =
    // ── Primary swell (phase-shuffled per zone) ──────────────────────────────
    Math.sin(time * 0.78 + x * 0.073 + spatialPhase * 0.29) * 1.82 * zoneAmp
    + Math.cos(time * 0.46 + y * 0.074 + spatialPhase * 0.24) * 1.74 * zoneAmp
    // ── Large-scale slow undulation ──────────────────────────────────────────
    + Math.sin(time * 0.09 + x * 0.010 + y * 0.013) * 1.32
    + Math.cos(time * 0.07 - x * 0.012 + y * 0.009) * 1.08
    // ── Mid-range varied octaves ─────────────────────────────────────────────
    + Math.sin(time * 1.34 + x * 0.168) * 0.16
    + Math.cos(time * 0.62 + (x - y) * 0.048) * 0.24
    // ── Amplitude-split octaves (surface carries more energy) ────────────────
    + Math.sin(time * 0.31 + (x + y) * 0.042) * (surface ? 0.70 : 0.62)
    // ── Non-axis-aligned rolling ─────────────────────────────────────────────
    + Math.cos(time * 0.19 + (x - y * 0.46) * 0.028) * (surface ? 0.48 : 0.46)
    // ── Irrational-ratio frequency ───────────────────────────────────────────
    + Math.sin(time * 0.44 + x * 0.056 + y * 0.038) * (surface ? 0.41 : 0.34);

  if (surface) {
    z +=
      Math.cos(time * 0.54 + x * 0.029 + y * 0.038) * 0.53
      + Math.sin(time * 0.97 + (x * 0.78 - y * 0.62) * 0.057) * 0.34
      + Math.cos(time * 0.29 + x * 0.041 - y * 0.052) * 0.35
      + Math.sin(time * 1.58 + (x * 0.9 + y * 1.1) * 0.072) * 0.09;
  }

  return z;
}

export function getNeonEdgeStrength(themeName: WorkspaceSceneTheme) {
  switch (themeName) {
    case 'night':
      return 1;
    case 'default':
      return 0.82;
    case 'dusk':
      return 0.42;
    case 'morning':
      return 0.26;
    case 'overcast':
      return 0.2;
    default:
      return 0.3;
  }
}

export function createCircularTerrainGeometry(radius: number, widthSegments: number, heightSegments: number) {
  const sourceX: number[] = [];
  const sourceY: number[] = [];
  const nextPositions: number[] = [];
  const nextUvs: number[] = [];
  const indices: number[] = [];
  const vertexMap = new Map<number, number>();
  const size = radius * 2;
  const gridWidth = widthSegments + 1;

  for (let iy = 0; iy <= heightSegments; iy += 1) {
    const y = (iy / heightSegments - 0.5) * size;
    for (let ix = 0; ix <= widthSegments; ix += 1) {
      const x = (ix / widthSegments - 0.5) * size;
      sourceX.push(x);
      sourceY.push(y);
    }
  }

  const ensureVertex = (sourceIndex: number) => {
    const existing = vertexMap.get(sourceIndex);
    if (existing !== undefined) {
      return existing;
    }

    const x = sourceX[sourceIndex];
    const y = sourceY[sourceIndex];
    const nextIndex = nextPositions.length / 3;
    nextPositions.push(x, y, 0);
    nextUvs.push(x / size + 0.5, y / size + 0.5);
    vertexMap.set(sourceIndex, nextIndex);
    return nextIndex;
  };

  const appendTriangle = (a: number, b: number, c: number) => {
    const centroidX = (sourceX[a] + sourceX[b] + sourceX[c]) / 3;
    const centroidY = (sourceY[a] + sourceY[b] + sourceY[c]) / 3;

    if (Math.hypot(centroidX, centroidY) > radius * 0.995) {
      return;
    }

    indices.push(ensureVertex(a), ensureVertex(b), ensureVertex(c));
  };

  for (let iy = 0; iy < heightSegments; iy += 1) {
    for (let ix = 0; ix < widthSegments; ix += 1) {
      const a = iy * gridWidth + ix;
      const b = a + 1;
      const c = a + gridWidth;
      const d = c + 1;

      appendTriangle(a, c, b);
      appendTriangle(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(nextPositions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(nextUvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

export function createSkyMaterial(theme: typeof WORKSPACE_SCENE_THEMES.default) {
  return new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(theme.skyTop) },
      bottomColor: { value: new THREE.Color(theme.skyBottom) },
      horizonColor: { value: new THREE.Color(theme.horizon) },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform vec3 horizonColor;
      uniform float time;
      varying vec3 vWorldPosition;

      void main() {
        float h = normalize(vWorldPosition).y;
        float horizonBand = smoothstep(-0.08, 0.16, h);
        float upperBand = smoothstep(0.08, 0.82, h);
        float glow = pow(1.0 - clamp(abs(h * 1.1), 0.0, 1.0), 3.0);

        vec3 midColor = mix(bottomColor, topColor, 0.38);
        vec3 color = mix(horizonColor, bottomColor, horizonBand);
        color = mix(color, midColor, upperBand * 0.7);
        color = mix(color, topColor, smoothstep(0.45, 0.96, h));
        color += horizonColor * glow * 0.035;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
}

export function createHazeMaterial(theme: typeof WORKSPACE_SCENE_THEMES.default) {
  return new THREE.ShaderMaterial({
    uniforms: {
      baseColor: { value: new THREE.Color(theme.fog) },
      glowColor: { value: new THREE.Color(theme.horizon) },
      opacity: { value: 0.24 },
      time: { value: 0 },
      storminess: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 baseColor;
      uniform vec3 glowColor;
      uniform float opacity;
      uniform float time;
      uniform float storminess;
      varying vec2 vUv;

      void main() {
        float driftA = sin(vUv.x * 9.0 + time * 0.08) * 0.5 + 0.5;
        float driftB = cos(vUv.x * 15.0 - time * 0.06) * 0.5 + 0.5;
        float vertical = smoothstep(0.02, 0.92, vUv.y);
        float horizontal = 1.0 - smoothstep(0.0, 0.5, abs(vUv.x - 0.5));
        float cloud = mix(driftA, driftB, 0.46);
        float alpha = vertical * horizontal * opacity * mix(0.78, 1.55, storminess) * (0.72 + cloud * 0.42);
        vec3 color = mix(baseColor, glowColor, vUv.y * (0.4 + storminess * 0.22) + cloud * 0.08);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
}

export function createMistMaterial(theme: typeof WORKSPACE_SCENE_THEMES.default) {
  return new THREE.ShaderMaterial({
    uniforms: {
      baseColor: { value: new THREE.Color(theme.fog) },
      highlightColor: { value: new THREE.Color(theme.horizon) },
      opacity: { value: 0.06 },
      time: { value: 0 },
      storminess: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 baseColor;
      uniform vec3 highlightColor;
      uniform float opacity;
      uniform float time;
      uniform float storminess;
      varying vec2 vUv;

      void main() {
        float layerA = sin(vUv.x * 8.0 + time * 0.07) * 0.5 + 0.5;
        float layerB = cos(vUv.x * 12.5 - time * 0.05) * 0.5 + 0.5;
        float layerC = sin((vUv.x + vUv.y) * 10.0 + time * 0.03) * 0.5 + 0.5;
        float body = smoothstep(0.0, 0.86, vUv.y);
        float cloud = (layerA * 0.38 + layerB * 0.34 + layerC * 0.28) * body;
        float lane = 1.0 - smoothstep(0.36, 1.0, abs(vUv.x - 0.5));
        float alpha = cloud * opacity * lane * mix(0.85, 1.85, storminess);
        vec3 color = mix(baseColor, highlightColor, vUv.y * 0.26 + layerA * 0.06 + storminess * 0.08);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
}

export function createBoundaryFogMaterial(theme: typeof WORKSPACE_SCENE_THEMES.default, innerRadius: number, outerRadius: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      baseColor: { value: new THREE.Color(theme.fog) },
      glowColor: { value: new THREE.Color(theme.horizon) },
      opacity: { value: 0.32 },
      uInnerRadius: { value: innerRadius },
      uOuterRadius: { value: outerRadius },
    },
    vertexShader: `
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 baseColor;
      uniform vec3 glowColor;
      uniform float opacity;
      uniform float uInnerRadius;
      uniform float uOuterRadius;
      varying vec3 vLocalPos;

      void main() {
        float r = length(vLocalPos.xy);
        // Fade in from inner edge, fade out well before outer edge to avoid visible arc
        float innerFade = smoothstep(uInnerRadius, uInnerRadius * 1.10, r);
        float outerFade = 1.0 - smoothstep(uOuterRadius * 0.88, uOuterRadius * 0.98, r);
        float alpha = innerFade * outerFade * opacity;
        float t = (r - uInnerRadius) / (uOuterRadius - uInnerRadius);
        vec3 color = mix(baseColor, glowColor, smoothstep(0.3, 0.7, t) * 0.65);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
}

export function createTerrainFogMaterial(
  theme: typeof WORKSPACE_SCENE_THEMES.default,
  interactionPoints: THREE.Vector3[],
  interactionWeights: number[],
) {
  return new THREE.ShaderMaterial({
    uniforms: {
      baseColor: { value: new THREE.Color(theme.fog) },
      highlightColor: { value: new THREE.Color(theme.horizon) },
      opacity: { value: 0.12 },
      time: { value: 0 },
      storminess: { value: 0 },
      interactionPoints: { value: interactionPoints },
      interactionWeights: { value: interactionWeights },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vLocalPosition;
      void main() {
        vUv = uv;
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 baseColor;
      uniform vec3 highlightColor;
      uniform float opacity;
      uniform float time;
      uniform float storminess;
      uniform vec3 interactionPoints[3];
      uniform float interactionWeights[3];
      varying vec2 vUv;
      varying vec3 vLocalPosition;

      float fogNoise(vec2 p) {
        float layerA = sin(p.x * 0.031 + time * 0.17) * 0.5 + 0.5;
        float layerB = cos(p.y * 0.027 - time * 0.12) * 0.5 + 0.5;
        float layerC = sin((p.x + p.y) * 0.016 + time * 0.08) * 0.5 + 0.5;
        float layerD = cos(length(p) * 0.019 - time * 0.05) * 0.5 + 0.5;
        return (layerA * 0.28 + layerB * 0.24 + layerC * 0.24 + layerD * 0.24);
      }

      void main() {
        float radial = distance(vUv, vec2(0.5));
        // Fade must reach 0 at the UV boundary (radial=0.5) to avoid a visible circle arc
        float edgeFade = 1.0 - smoothstep(0.22, 0.50, radial);
        vec2 drifted = vLocalPosition.xy + vec2(time * 3.4, -time * 2.1);
        float bodyNoise = fogNoise(drifted);
        float detailNoise = fogNoise(drifted.yx * 1.22 + 26.0);
        float lowNoise = fogNoise(drifted * 0.58 - 40.0);
        float fogBody = mix(bodyNoise, detailNoise, 0.42) * 0.72 + lowNoise * 0.28;
        float horizonLift = smoothstep(0.24, 0.78, radial);
        float depthBoost = mix(0.9, 1.85, storminess);
        float alpha = fogBody * edgeFade * opacity * depthBoost * (0.64 + horizonLift * 0.92);

        float clearance = 0.0;
        for (int i = 0; i < 3; i++) {
          float dist = distance(vLocalPosition.xy, interactionPoints[i].xy);
          float spread = 1.0 - smoothstep(10.0, mix(44.0, 54.0, storminess), dist);
          clearance = max(clearance, spread * interactionWeights[i]);
        }

        alpha *= 1.0 - clearance * 0.92;
        if (alpha < 0.01) discard;

        vec3 color = mix(baseColor, highlightColor, horizonLift * 0.24 + fogBody * (0.08 + storminess * 0.06));
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });
}

export function createSoftDotTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.needsUpdate = true;
    return fallback;
  }

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.32, 'rgba(255,255,255,0.92)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.24)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function createShellTexture(tile: WorkspaceSceneTileDescriptor) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 640;
  paintShellTexture(canvas, tile);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function paintShellTexture(canvas: HTMLCanvasElement, tile: WorkspaceSceneTileDescriptor) {
  const accent = WORKSPACE_WIDGET_ACCENTS[tile.kind];
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const backgroundGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  backgroundGradient.addColorStop(0, accent.screen);
  backgroundGradient.addColorStop(1, '#04070c');
  ctx.fillStyle = backgroundGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const halo = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.28, 20, canvas.width * 0.5, canvas.height * 0.28, canvas.width * 0.6);
  halo.addColorStop(0, 'rgba(255,255,255,0.16)');
  halo.addColorStop(0.3, 'rgba(255,255,255,0.06)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 4;
  roundedRect(ctx, 26, 24, canvas.width - 52, canvas.height - 48, 42);
  ctx.stroke();

  const topBarGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  topBarGradient.addColorStop(0, `${accent.accent}44`);
  topBarGradient.addColorStop(1, 'rgba(255,255,255,0.04)');
  ctx.fillStyle = topBarGradient;
  roundedRect(ctx, 46, 40, canvas.width - 92, 110, 32);
  ctx.fill();

  ctx.fillStyle = `${accent.accent}66`;
  ctx.beginPath();
  ctx.arc(108, 96, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 54px "Segoe UI", sans-serif';
  ctx.fillText(tile.title, 162, 108);

  ctx.fillStyle = 'rgba(255,255,255,0.36)';
  ctx.font = '500 24px "Segoe UI", sans-serif';
  ctx.fillText(tile.kind.toUpperCase(), 164, 140);

  const chips = ['LIVE', tile.distance3D.toUpperCase(), tile.status.toUpperCase()];
  chips.forEach((label, index) => {
    const chipX = 54 + index * 176;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundedRect(ctx, chipX, 182, 148, 52, 24);
    ctx.fill();
    ctx.fillStyle = `${accent.accent}cc`;
    ctx.font = '700 22px "Segoe UI", sans-serif';
    ctx.fillText(label, chipX + 24, 216);
  });

  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  roundedRect(ctx, 46, 266, canvas.width - 92, canvas.height - 314, 30);
  ctx.fill();

  [72, 344, 616].forEach((x) => {
    for (let row = 0; row < 3; row += 1) {
      const y = 304 + row * 88;
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      roundedRect(ctx, x, y, 210, 56, 18);
      ctx.fill();
      ctx.fillStyle = row === 0 ? accent.accent : 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + 18, y + 18, row === 0 ? 124 : 156 - row * 22, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 18, y + 34, 92 + row * 20, 8);
    }
  });

  const gridGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gridGradient.addColorStop(0, 'rgba(255,255,255,0.04)');
  gridGradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = gridGradient;
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}
