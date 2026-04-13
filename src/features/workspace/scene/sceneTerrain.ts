import * as THREE from 'three';
import type { ImpactWave } from './sceneTypes';

export function trimExpiredWavesInPlace(waves: ImpactWave[], time: number, maxAge: number) {
  let writeIndex = 0;

  for (let readIndex = 0; readIndex < waves.length; readIndex += 1) {
    if (time - waves[readIndex].startedAt <= maxAge) {
      waves[writeIndex] = waves[readIndex];
      writeIndex += 1;
    }
  }

  waves.length = writeIndex;
}

export function buildPeakBeaconField(baseX: Float32Array, baseY: Float32Array, radius: number) {
  const indices: number[] = [];
  const seeds: number[] = [];

  for (let index = 0; index < baseX.length; index += 1) {
    const x = baseX[index];
    const y = baseY[index];
    const radial = Math.hypot(x, y);
    if (radial < radius * 0.12 || radial > radius * 0.92) {
      continue;
    }

    const hash = Math.abs(Math.round(x * 1.37) * 31 + Math.round(y * 0.91) * 17 + index * 13);
    if (hash % 61 !== 0) {
      continue;
    }

    indices.push(index);
    seeds.push((hash % 360) * (Math.PI / 180));
  }

  return {
    indices: Uint32Array.from(indices),
    positions: new Float32Array(indices.length * 3),
    intensity: new Float32Array(indices.length),
    seeds: Float32Array.from(seeds),
  };
}

export function createPeakBeaconMaterial(color: string) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      attribute float aIntensity;
      attribute float aSeed;
      varying float vAlpha;

      void main() {
        float pulse = 0.62 + sin(uTime * 1.9 + aSeed) * 0.22 + cos(uTime * 0.7 + aSeed * 1.7) * 0.1;
        float blink = smoothstep(0.2, 0.95, sin(uTime * 0.42 + aSeed * 0.73) * 0.5 + 0.5);
        vAlpha = aIntensity * mix(0.42, 1.0, blink) * pulse;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float depthScale = clamp(220.0 / max(1.0, -mvPosition.z), 0.0, 1.0);
        gl_PointSize = mix(0.72, 3.2, aIntensity) * mix(0.52, 1.0, depthScale);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;

      void main() {
        vec2 center = gl_PointCoord - 0.5;
        float dist = length(center) * 2.0;
        float core = 1.0 - smoothstep(0.0, 0.58, dist);
        float halo = 1.0 - smoothstep(0.12, 1.0, dist);
        float alpha = (core * 0.64 + halo * 0.22) * uOpacity * vAlpha;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
