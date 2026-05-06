import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import './Launch.css';

// ─────────────────────────────────────────────────────────────────────────────
// WebGL shaders
// ─────────────────────────────────────────────────────────────────────────────

const VERT_SRC = `
  attribute vec2 aPos;
  void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/**
 * The fragment shader draws the curtain surface.
 * It mirrors the JS buildShutterPath wave math so the
 * GPU-rendered edge perfectly matches the logical state.
 *
 * Pixels ABOVE the wave edge are discarded → alpha=0 → workspace shows through.
 * Pixels BELOW are drawn with: dark-navy gradient + procedural grain +
 *   specular band + side-ambient + edge-glow highlight.
 */
const FRAG_SRC = `
  precision highp float;

  uniform vec2  uRes;
  uniform float uTime;
  uniform float uY;
  uniform float uAmp;
  uniform float uCrest;
  uniform float uSkew;
  uniform float uFold;

  /* ---- fast hash / value noise ---- */
  float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i),              hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    /* screen-space coords, Y=0 at TOP (matches CSS / JS) */
    float sx = gl_FragCoord.x;
    float sy = uRes.y - gl_FragCoord.y;

    float px = sx / uRes.x;                          /* 0..1 horizontal */
    float edgeDist = abs(px - 0.5) * 2.0;

    /* ---- wave (mirrors buildShutterPath) ---- */
    float wave      = sin(px * 3.14159 * 3.0 + uCrest) * uAmp * (0.35 + edgeDist * 0.7);
    float secondary = cos(px * 3.14159 * 5.0 - uCrest * 0.7) * uAmp * 0.18;

    float skewOffset = mix(
      (0.58 - px) * uSkew * 0.42,
      -(px - 0.58) * uSkew * 1.55,
      step(0.58, px)
    );

    float fz = clamp(1.0 - abs(px - 0.38) / 0.18, 0.0, 1.0);
    float foldOffset = -uFold * fz
      + uFold * 0.28 * clamp(1.0 - abs(px - 0.48) / 0.12, 0.0, 1.0);

    float edgeY = uY + wave + secondary + skewOffset + foldOffset;

    /* ---- clip: above edge = transparent ---- */
    if (sy > edgeY) discard;

    vec2 uv = vec2(sx / uRes.x, sy / uRes.y);

    /* ---- surface gradient (dark navy palette) ---- */
    vec3 c0 = vec3(0.102, 0.158, 0.252);   /* top:    ~#1a2840 — workspace-navy */
    vec3 c1 = vec3(0.068, 0.112, 0.190);   /* mid:    ~#111d30 */
    vec3 c2 = vec3(0.044, 0.072, 0.128);   /* bottom: ~#0b1220 — close to workspace bg */
    float t = uv.y;
    vec3 color = mix(mix(c0, c1, smoothstep(0.0, 0.45, t)),
                     mix(c1, c2, smoothstep(0.0, 1.0, (t - 0.45) / 0.55)),
                     step(0.45, t));

    /* ---- animated film grain (different offset each frame) ---- */
    vec2 gp = uv * 370.0
      + vec2(floor(uTime * 23.0) * 1.27, floor(uTime * 18.0) * 0.93);
    float grain = vnoise(gp) * 0.026 - 0.013;
    color += grain;

    /* ---- very subtle horizontal shimmer ---- */
    color += sin(uv.x * 46.2 + uTime * 0.74) * 0.0030;

    /* ---- specular highlight band ---- */
    float spec = exp(-pow((uv.y - 0.28) * 8.5, 2.0)) * 0.046;
    color += spec * vec3(0.48, 0.62, 0.92);

    /* ---- side-edge ambient (rim light) ---- */
    float side = exp(-uv.x * 5.6) * 0.052 + exp(-(1.0 - uv.x) * 8.8) * 0.024;
    color += side * vec3(0.42, 0.58, 0.82);

    /* ---- wavy-edge glow (brightens the curtain right at its lower boundary) ---- */
    float de = edgeY - sy;          /* 0 at edge, grows deeper inside curtain */
    float glow = smoothstep(18.0, 0.0, de);
    color += glow * vec3(0.38, 0.58, 0.86) * 0.48;

    /* ---- thin shadow just inside the edge (adds depth) ---- */
    float shd = smoothstep(0.0, 22.0, de) * (1.0 - smoothstep(22.0, 48.0, de)) * 0.10;
    color -= shd;

    /* ---- vignette ---- */
    float vx = uv.x * (1.0 - uv.x) * 4.0;
    float vy = smoothstep(0.0, 0.08, uv.y);
    color *= mix(0.76, 1.03, pow(clamp(vx, 0.0, 1.0), 0.22) * vy);

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// WebGL helpers
// ─────────────────────────────────────────────────────────────────────────────

interface GLContext {
  gl: WebGLRenderingContext;
  uniforms: Record<string, WebGLUniformLocation | null>;
  render(state: ShutterState, time: number): void;
  resize(): void;
  destroy(): void;
}

function buildGLContext(canvas: HTMLCanvasElement): GLContext | null {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) ?? 'Shader error');
    }
    return s;
  };

  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT_SRC));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG_SRC));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) ?? 'Link error');
  }

  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );

  gl.useProgram(prog);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const n of ['uRes', 'uTime', 'uY', 'uAmp', 'uCrest', 'uSkew', 'uFold']) {
    uniforms[n] = gl.getUniformLocation(prog, n);
  }

  const resize = () => {
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();

  const render = (state: ShutterState, time: number) => {
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uniforms.uRes, w * dpr, h * dpr);
    gl.uniform1f(uniforms.uTime, time);
    gl.uniform1f(uniforms.uY, state.y * dpr);
    gl.uniform1f(uniforms.uAmp, state.amplitude * dpr);
    gl.uniform1f(uniforms.uCrest, state.crest);
    gl.uniform1f(uniforms.uSkew, state.skew * dpr);
    gl.uniform1f(uniforms.uFold, state.fold * dpr);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const destroy = () => {
    gl.deleteProgram(prog);
    gl.deleteBuffer(buf);
  };

  return { gl, uniforms, render, resize, destroy };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component types
// ─────────────────────────────────────────────────────────────────────────────

export type LaunchProps = {
  introSessionKey: string;
  onComplete: () => void;
};

type ShutterState = {
  y: number;
  amplitude: number;
  skew: number;
  fold: number;
  crest: number;
};

const ERP_WORDS = ['ENTERPRISE', 'RESOURCE', 'PLANNING'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Launch
// ─────────────────────────────────────────────────────────────────────────────

export function Launch({ introSessionKey, onComplete }: LaunchProps) {
  const glCanvasRef  = useRef<HTMLCanvasElement>(null);
  const grainRef     = useRef<HTMLCanvasElement>(null);
  const titleRef     = useRef<HTMLHeadingElement>(null);
  const subtitleRef  = useRef<HTMLDivElement>(null);
  const linesRef     = useRef<HTMLDivElement>(null);
  const started      = useRef(false);

  // ── film grain (CPU canvas, ~22fps) ────────────────────────────────────────
  useEffect(() => {
    const canvas = grainRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let timer = 0;
    let ox = 0, oy = 0;

    const frame = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.max(window.devicePixelRatio || 1, 1);
      const sw = Math.floor(w * dpr);
      const sh = Math.floor(h * dpr);
      if (canvas.width !== sw || canvas.height !== sh) {
        canvas.width = sw;
        canvas.height = sh;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      const id = ctx.createImageData(w, h);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * 18;
        d[i] = 195; d[i + 1] = 210; d[i + 2] = 232; d[i + 3] = v;
      }
      ctx.putImageData(id, 0, 0);
      canvas.style.transform = `translate3d(${ox}px,${oy}px,0)`;
      ox = ((ox + 1) % 3) - 1;
      oy = ((oy + 1) % 5) - 2;
      timer = window.setTimeout(() => { raf = requestAnimationFrame(frame); }, 46);
    };

    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, []);

  // ── WebGL + GSAP timeline ──────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (started.current) return;
    started.current = true;

    const glCanvas = glCanvasRef.current;
    const title    = titleRef.current;
    const subtitle = subtitleRef.current;
    const lines    = linesRef.current;
    if (!glCanvas || !title || !subtitle || !lines) return;

    const glCtx = buildGLContext(glCanvas);
    if (!glCtx) {
      // WebGL unavailable — fallback: skip straight to complete
      window.localStorage.setItem(introSessionKey, '1');
      onComplete();
      return;
    }

    const shutterState: ShutterState = {
      y:         window.innerHeight,
      amplitude: 0,
      skew:      0,
      fold:      0,
      crest:     0,
    };

    const start = performance.now();
    let glRaf = 0;
    const tick = () => {
      glCtx.render(shutterState, (performance.now() - start) / 1000);
      glRaf = requestAnimationFrame(tick);
    };
    glRaf = requestAnimationFrame(tick);

    const onResize = () => glCtx.resize();
    window.addEventListener('resize', onResize);

    // ── query animated sub-elements ─────────────────────────────────────────
    const wordInners = subtitle.querySelectorAll<HTMLElement>('.lw-inner');
    const lineEls    = lines.querySelectorAll<HTMLElement>('.lr');

    // ── initial GSAP states ──────────────────────────────────────────────────
    gsap.set(title, { opacity: 0, y: 20, scale: 0.980, filter: 'blur(16px)' });
    gsap.set(wordInners, { y: '112%' });
    gsap.set(lineEls,    { scaleX: 0, transformOrigin: '50% 50%' });
    gsap.set(subtitle,   { opacity: 1 });
    gsap.set(lines,      { opacity: 1 });

    /**
     * Animation timeline
     *
     * 0.00 → 0.95  KORT fades in
     * 0.95 → 1.60  KORT holds (0.65 s)
     * 1.60 → 2.08  KORT fades out
     * 2.20 → 2.84  ERP words slide in (staggered 0.18 s)
     * 2.20 → 2.54  Decorative lines expand
     * ~3.10        All ERP text visible
     * 3.10 → 4.00  Hold
     * 4.00 → 4.38  ERP + lines fade out
     * 4.44 → 5.16  Shutter phase 1 (rises to mid-screen, wave builds)
     * 5.16 → 6.12  Shutter phase 2 (exits screen with full wave drama)
     * 6.12         onComplete
     */
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl
      // ─── KORT ─────────────────────────────────────────────────────────────
      .to(title, {
        opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
        duration: 0.95,
      })
      .to(title, {
        opacity: 0, y: -16, scale: 1.016, filter: 'blur(18px)',
        duration: 0.48, ease: 'power2.in',
      }, '+=0.65')

      // ─── ERP cinematic word reveal ─────────────────────────────────────────
      .to(wordInners, {
        y: '0%',
        duration: 0.66,
        stagger: 0.17,
        ease: 'power4.out',
      }, '+=0.14')
      .to(lineEls, {
        scaleX: 1,
        duration: 0.54,
        stagger: 0.04,
        ease: 'power3.inOut',
      }, '<0.10')   // starts slightly after words begin

      // ─── Hold → fade out ──────────────────────────────────────────────────
      .to([subtitle, lines], {
        opacity: 0,
        duration: 0.38,
        ease: 'power2.in',
        stagger: 0,
      }, '+=0.90')

      // ─── Shutter phase 1: fast rise to mid-screen, wave kicks in ──────────
      .to(shutterState, {
        y:         window.innerHeight * 0.52,
        amplitude: 32,
        crest:     0.28,
        duration:  0.72,
        ease:      'power2.inOut',
      }, '+=0.06')

      // ─── Shutter phase 2: dramatic exit with wave, skew, fold ─────────────
      .to(shutterState, {
        y:         -window.innerHeight * 0.20,
        amplitude: 20,
        skew:      94,
        fold:      52,
        crest:     1.32,
        duration:  0.96,
        ease:      'power4.inOut',
      })

      // ─── Done ─────────────────────────────────────────────────────────────
      .add(() => {
        window.localStorage.setItem(introSessionKey, '1');
        onComplete();
      });

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(glRaf);
      glCtx.destroy();
      tl.kill();
      // Reset so a potential remount (e.g. HMR) can re-initialise cleanly
      started.current = false;
    };
  }, [introSessionKey, onComplete]);

  return (
    <div className="launch-root" aria-hidden="true">
      {/* Grain layer */}
      <canvas ref={grainRef} className="launch-grain" />

      {/* Text layer */}
      <div className="launch-copy">
        <h1 ref={titleRef} className="launch-title">KORT</h1>

        {/* ERP cinematic subtitle */}
        <div className="launch-subtitle-wrap">
          {/* Top decorative lines */}
          <div ref={linesRef} className="launch-lines" aria-hidden>
            <span className="lr launch-line-left" />
            <span className="lr launch-line-right" />
          </div>

          {/* Words */}
          <div ref={subtitleRef} className="launch-subtitle">
            {ERP_WORDS.map(w => (
              <span key={w} className="lw-outer">
                <span className="lw-inner">{w}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* WebGL curtain — transparent above wave edge, so workspace shows through */}
      <canvas ref={glCanvasRef} className="launch-curtain" />
    </div>
  );
}
