"use client";

/**
 * Tiny synthesized sound effects for the mascot (Web Audio, no assets).
 * Audio only starts from a user gesture (a click on the critter), which satisfies autoplay rules.
 * Mute preference is remembered; every storage access is guarded.
 */

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let muted = false;
const KEY = "sy-muted";

try {
  muted = window.localStorage.getItem(KEY) === "1";
} catch {
  /* storage blocked: default to sound on */
}

function context(): Ctx | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    window.localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
}

interface Tone {
  type: OscillatorType;
  /** [start Hz, end Hz] */
  freq: [number, number];
  at: number;
  dur: number;
  gain: number;
  /** vibrato depth in Hz and rate in Hz */
  vibrato?: [number, number];
}

function play(c: Ctx, tones: Tone[]): void {
  const t0 = c.currentTime + 0.01;
  for (const tone of tones) {
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = tone.type;
    const start = t0 + tone.at;
    const end = start + tone.dur;
    osc.frequency.setValueAtTime(tone.freq[0], start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, tone.freq[1]), end);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(tone.gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);
    if (tone.vibrato) {
      const lfo = c.createOscillator();
      const depth = c.createGain();
      lfo.frequency.value = tone.vibrato[1];
      depth.gain.value = tone.vibrato[0];
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(start);
      lfo.stop(end);
    }
    osc.connect(amp).connect(c.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

/** variant matches Mascot.poke(): 0 boing, 1 giggle, 2 squish-pop, 3 dizzy */
export function pokeSound(variant: number): void {
  if (muted) return;
  const c = context();
  if (!c) return;
  switch (variant) {
    case 0: // boing: springy upward sweep with a wobble
      play(c, [
        { type: "sine", freq: [180, 620], at: 0, dur: 0.22, gain: 0.35 },
        { type: "triangle", freq: [620, 240], at: 0.2, dur: 0.3, gain: 0.25, vibrato: [40, 22] },
      ]);
      break;
    case 1: // ticklish: a rapid chirpy "hehehe"
      for (let i = 0; i < 5; i++) play(c, [{ type: "square", freq: [880 + i * 40, 1100 + i * 40], at: i * 0.075, dur: 0.05, gain: 0.12 }]);
      break;
    case 2: // squish then pop
      play(c, [
        { type: "sawtooth", freq: [320, 90], at: 0, dur: 0.18, gain: 0.2 },
        { type: "sine", freq: [260, 1200], at: 0.26, dur: 0.09, gain: 0.35 },
      ]);
      break;
    default: // dizzy: a drunken slide whistle with heavy vibrato
      play(c, [
        { type: "sine", freq: [900, 200], at: 0, dur: 0.9, gain: 0.3, vibrato: [90, 9] },
        { type: "triangle", freq: [200, 700], at: 0.9, dur: 0.6, gain: 0.22, vibrato: [60, 7] },
      ]);
  }
}
