export const c01 = (n: number) => Math.min(1, Math.max(0, n));
/** 0..1 progress of `f` between frames a and b, clamped */
export const prog = (f: number, a: number, b: number) => c01((f - a) / (b - a));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const eOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const eIn = (t: number) => t * t * t;
export const eInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const back = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2));
export const bounce = (t: number) => {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};
/** scale-in with overshoot starting at frame `at` */
export const pop = (f: number, at: number, dur = 14) => back(prog(f, at, at + dur));
/** a single parabolic hop of height h */
export const arc = (f: number, at: number, dur: number, h = 1) => Math.sin(prog(f, at, at + dur) * Math.PI) * h;
/** deterministic pseudo-random 0..1 */
export const rnd = (i: number, n = 0) => {
  const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
export type V3 = [number, number, number];
export const mix3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** camera-style keyframes: eased blend between [frame, value] stops */
export const keys3 = (f: number, stops: [number, V3][]): V3 => {
  if (f <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (f <= stops[i][0]) return mix3(stops[i - 1][1], stops[i][1], eInOut(prog(f, stops[i - 1][0], stops[i][0])));
  }
  return stops[stops.length - 1][1];
};
