"use client";

import { useEffect, useRef, type CSSProperties } from "react";

export type HeroShaderProps = {
  /** Ordered 4-stop hex palette; defaults to MorPlan's Swiss/Campus tokens. */
  colors?: readonly [string, string, string, string];
  /** Animation speed multiplier; automatically forced to 0 under reduced motion or offscreen. */
  speed?: number;
  /** Spatial scale of the simplex noise contours. */
  scale?: number;
  /** Number of architectural contour steps per color transition. */
  stepsPerColor?: number;
  /** Edge softness between contour bands (0..1). */
  softness?: number;
  className?: string;
  style?: CSSProperties;
};

const DEFAULT_COLORS: readonly [string, string, string, string] = ["#f4f3f9", "#e6e4ee", "#fbe9f6", "#ffffff"];

const VERTEX_SHADER = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// 2D Simplex Noise (Ashima Arts, public domain / MIT) with architectural stepped contour bands.
const FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_scale;
uniform float u_steps;
uniform float u_softness;
uniform vec3 u_colors[4];

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,
    0.366025403784439,
    -0.577350269189626,
    0.024390243902439
  );
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

vec3 samplePalette(float t) {
  float x = clamp(t, 0.0, 1.0) * 3.0;
  vec3 ab = mix(u_colors[0], u_colors[1], clamp(x, 0.0, 1.0));
  vec3 bc = mix(ab, u_colors[2], clamp(x - 1.0, 0.0, 1.0));
  return mix(bc, u_colors[3], clamp(x - 2.0, 0.0, 1.0));
}

void main() {
  float minDim = max(min(u_resolution.x, u_resolution.y), 1.0);
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / minDim;
  vec2 p = uv * (1.6 / max(u_scale, 0.1));

  float drift = u_time * 0.18;
  float n1 = snoise(p + vec2(drift * 0.65, -drift * 0.4));
  float n2 = snoise(p * 1.75 + vec2(-drift * 0.45, drift * 0.55) + 4.2);
  float n = clamp((n1 * 0.68 + n2 * 0.32) * 0.5 + 0.5, 0.0, 1.0);

  float totalSteps = max(u_steps * 3.0, 1.0);
  float scaled = n * totalSteps;
  float band = floor(scaled);
  float edge = clamp(u_softness, 0.02, 0.98) * 0.5;
  float smoothBand = band + smoothstep(0.5 - edge, 0.5 + edge, fract(scaled));

  vec3 col = samplePalette(smoothBand / totalSteps);
  gl_FragColor = vec4(col, 1.0);
}
`;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return [0.9569, 0.9529, 0.9765];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Zero-dependency WebGL fragment shader background for MorPlan's landing hero.
 * Layers calm stepped Simplex contours in canvas/hairline/soft-magenta tokens over
 * `--color-canvas`, pausing offscreen and under `prefers-reduced-motion`.
 */
export function HeroShader({
  colors = DEFAULT_COLORS,
  speed = 0.2,
  scale = 0.75,
  stepsPerColor = 3,
  softness = 0.25,
  className = "",
  style,
}: HeroShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const c0 = colors[0];
  const c1 = colors[1];
  const c2 = colors[2];
  const c3 = colors[3];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
    if (!gl) {
      canvas.dataset.shaderState = "fallback";
      return;
    }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = vs && fs ? gl.createProgram() : null;
    if (!vs || !fs || !program) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      if (program) gl.deleteProgram(program);
      canvas.dataset.shaderState = "fallback";
      return;
    }

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteProgram(program);
      canvas.dataset.shaderState = "fallback";
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, "a_pos");
    const uRes = gl.getUniformLocation(program, "u_resolution");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uScale = gl.getUniformLocation(program, "u_scale");
    const uSteps = gl.getUniformLocation(program, "u_steps");
    const uSoft = gl.getUniformLocation(program, "u_softness");
    const uColors = gl.getUniformLocation(program, "u_colors");

    gl.useProgram(program);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const flatColors = new Float32Array([...hexToRgb(c0), ...hexToRgb(c1), ...hexToRgb(c2), ...hexToRgb(c3)]);
    if (uColors) gl.uniform3fv(uColors, flatColors);
    if (uScale) gl.uniform1f(uScale, scale);
    if (uSteps) gl.uniform1f(uSteps, stepsPerColor);
    if (uSoft) gl.uniform1f(uSoft, softness);

    let raf = 0;
    let lastTs = 0;
    let elapsed = 0;
    let isVisible = true;
    let contextLost = false;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = mq.matches;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(Math.round(rect.width * dpr), 1);
      const h = Math.max(Math.round(rect.height * dpr), 1);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
    };

    const draw = () => {
      if (contextLost) return;
      if (uTime) gl.uniform1f(uTime, elapsed);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const shouldAnimate = () => !contextLost && isVisible && !reducedMotion && !document.hidden && speed > 0;

    const tick = (now: number) => {
      if (!shouldAnimate()) {
        raf = 0;
        lastTs = 0;
        return;
      }
      if (lastTs !== 0) {
        elapsed += Math.min((now - lastTs) / 1000, 0.1) * speed;
      }
      lastTs = now;
      draw();
      raf = requestAnimationFrame(tick);
    };

    const syncLoop = () => {
      if (shouldAnimate()) {
        canvas.dataset.shaderState = "active";
        if (!raf) raf = requestAnimationFrame(tick);
      } else {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
        lastTs = 0;
        canvas.dataset.shaderState = contextLost ? "lost" : "paused";
        draw();
      }
    };

    resize();
    syncLoop();

    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        isVisible = entries.some((e) => e.isIntersecting);
        syncLoop();
      },
      { threshold: 0.01 },
    );
    io.observe(canvas);

    const onMotion = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
      syncLoop();
    };
    mq.addEventListener("change", onMotion);

    const onVis = () => syncLoop();
    document.addEventListener("visibilitychange", onVis);

    const onLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      syncLoop();
    };
    const onRestored = () => {
      contextLost = false;
      resize();
      syncLoop();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      if (buffer) gl.deleteBuffer(buffer);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteProgram(program);
    };
  }, [c0, c1, c2, c3, speed, scale, stepsPerColor, softness]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none block h-full w-full bg-canvas ${className}`}
      style={style}
    />
  );
}
