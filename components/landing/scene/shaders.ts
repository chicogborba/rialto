/** GLSL for the landing scene. Kept in one place so the scene class stays readable. */

export const FLOOR_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/** Infinite rail-yard grid: anti-aliased lines, pulses travelling along the tracks, radial fade. */
export const FLOOR_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform vec2 uFocus;
uniform float uEnergy;
varying vec3 vWorld;
void main() {
  vec2 g = vWorld.xz / 2.0;
  vec2 fw = max(fwidth(g), vec2(1e-4));
  vec2 f = abs(fract(g - 0.5) - 0.5) / fw;
  float line = clamp(1.0 - min(f.x, f.y), 0.0, 1.0);
  // kill the solid fill where cells get smaller than a pixel (horizon)
  line *= 1.0 - smoothstep(0.25, 0.7, max(fw.x, fw.y));
  float d = length(vWorld.xz - uFocus);
  float fade = exp(-d * d * 0.0035);
  float pulseZ = smoothstep(0.92, 1.0, sin(g.y * 0.9 + uTime * 1.6) * 0.5 + 0.5);
  float pulseX = smoothstep(0.95, 1.0, sin(g.x * 0.7 - uTime * 1.1) * 0.5 + 0.5);
  float ripple = smoothstep(0.9, 1.0, sin(d * 0.9 - uTime * 2.2) * 0.5 + 0.5) * uEnergy;
  float glow = 0.14 + 0.8 * max(max(pulseZ, pulseX) * 0.6, ripple);
  vec3 col = uColor * glow * line * fade;
  gl_FragColor = vec4(col, line * fade);
}`;

export const CORE_VERT = /* glsl */ `
uniform float uTime;
uniform float uAmp;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vPos;
void main() {
  float n = sin(position.x * 3.1 + uTime * 1.3) * sin(position.y * 3.7 + uTime) * sin(position.z * 2.9 - uTime * 0.8);
  vec3 p = position + normal * n * uAmp;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  vPos = p;
  gl_Position = projectionMatrix * mv;
}`;

/** Dark body, hot fresnel rim, scanning bands. */
export const CORE_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uBoost;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vPos;
void main() {
  float fres = pow(clamp(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 0.0, 1.0), 2.2);
  float bands = smoothstep(0.46, 0.5, fract(vPos.y * 5.0 - uTime * 0.5)) * 0.18;
  vec3 col = uColor * min(0.03 + fres * (1.15 + uBoost * 0.5) + bands * (0.45 + uBoost * 0.4), 1.0);
  gl_FragColor = vec4(col, 1.0);
}`;

export const TRACK_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** Tube that draws itself (uDraw) and carries flowing dashes in either direction (uDir). */
export const TRACK_FRAG = /* glsl */ `
uniform float uTime;
uniform float uDraw;
uniform float uFlow;
uniform float uDir;
uniform float uAlpha;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  if (vUv.x > uDraw) discard;
  float dash = smoothstep(0.55, 0.95, fract(vUv.x * 7.0 - uTime * 1.4 * uDir));
  vec3 col = uColor * min(0.3 + dash * uFlow, 1.0);
  gl_FragColor = vec4(col, uAlpha);
}`;

/** Full-screen flowing topographic field (raw WebGL1, used by ShaderBackdrop). */
export const TOPO_FRAG = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uA;
uniform vec3 uB;
uniform vec2 uMouse;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + 7.3; a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes.y;
  vec2 m = uMouse * 0.25;
  vec2 q = vec2(fbm(uv * 1.5 + uTime * 0.05 + m), fbm(uv * 1.5 - uTime * 0.04 + 3.1 - m));
  float f = fbm(uv * 1.9 + q * 2.4 + uTime * 0.03);
  float l = 1.0 - smoothstep(0.0, 0.07, abs(fract(f * 11.0) - 0.5));
  vec3 col = mix(uA, uB, l * 0.9);
  col = mix(col, uB, smoothstep(0.55, 0.95, f) * 0.25);
  gl_FragColor = vec4(col, 1.0);
}`;
