import * as THREE from "three";
import { Mascot } from "./mascot";

/**
 * The pitch as one scroll-driven scene, in the video's low-poly style. A pure function of scroll
 * progress `p` (0..1); time only adds idle motion. The beat boundaries match story-beats.ts.
 *
 *   0.00  SCRATCH   he stacks a tower by hand; it falls over
 *   0.14  BLOCKED   three stalls appear and a gate slams on each: sign-up, card, key
 *   0.28  RIALTO    the gates fly off, the sign drops in, the whole market pops up
 *   0.42  FIND      he scans it; the ones that cannot do the job fade back
 *   0.56  COMPARE   three finalists get scored, one wins
 *   0.70  PAY       a coin flies to the winner
 *   0.84  DONE      the parcel flies back, confetti
 *
 * No lights and no post-processing: every box carries its own per-face shades.
 */

const GROUND = -1.085; // the mascot's feet
const GREY = new THREE.Color(0xcfc6b4);
const STALL_COLORS = [0x5ce1e6, 0xffd23f, 0x9945ff, 0x14f195, 0xff8fb3, 0xc6ff3d, 0x5ce1e6];
const TOWER_COLORS = [0x5ce1e6, 0xffd23f, 0xff4d4d, 0xc6ff3d, 0x9945ff, 0xffffff];
const GATES = ["SIGN UP", "CARD", "API KEY"];
const WOOD = 0xb98a5a;
const WOOD_DARK = 0x8d6540;
const TOWER_X = 2.3;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);
const backOut = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2));
const bounce = (t: number) => {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};
/** 1 inside [a, b], easing in and out over `edge` */
const within = (p: number, a: number, b: number, edge = 0.025) => seg(p, a, a + edge) * (1 - seg(p, b - edge, b));
const rnd = (i: number, n: number) => {
  const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** A sign: bold text on a flat colour, drawn once into a texture. */
function textTexture(text: string, fg: string, bg: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 160);
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let size = 104;
    ctx.font = `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
    const width = ctx.measureText(text).width;
    if (width > 440) size *= 440 / width;
    ctx.font = `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText(text, 256, 86);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface Tinted {
  material: THREE.MeshBasicMaterial;
  base: THREE.Color;
}
interface Stall {
  group: THREE.Group;
  tinted: Tinted[];
  x: number;
  z: number;
  /** 0, 1, 2 for the three finalists; -1 for the rest */
  finalist: number;
  winner: boolean;
  bars: THREE.Group | null;
  gate: THREE.Group | null;
  dim: number;
}
type V3 = [number, number, number];
const CAMERA: { p: number; pos: V3; look: V3 }[] = [
  { p: 0, pos: [1, 1.5, 8.8], look: [1.1, -0.1, 0] },
  { p: 0.13, pos: [1, 1.5, 8.8], look: [1.1, -0.1, 0] },
  // from a little to the side and above, so he does not hide the middle gate
  { p: 0.19, pos: [2.8, 2.6, 10.2], look: [0.2, 0.3, -1.6] },
  { p: 0.28, pos: [2.8, 2.6, 10.2], look: [0.2, 0.3, -1.6] },
  { p: 0.35, pos: [0, 2.7, 12], look: [0, 0.6, -2] },
  { p: 0.42, pos: [0, 2.7, 12], look: [0, 0.6, -2] },
  { p: 0.58, pos: [0, 1.9, 10], look: [0, 0.3, -1.8] },
  { p: 0.7, pos: [0, 1.9, 10], look: [0, 0.3, -1.8] },
  { p: 0.76, pos: [-2.4, 1.5, 9], look: [1, 0, -1.4] },
  { p: 0.84, pos: [-2.4, 1.5, 9], look: [1, 0, -1.4] },
  { p: 0.94, pos: [0, 0.9, 7.6], look: [0, -0.1, 0] },
];

export class MarketScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  private readonly mascot = new Mascot();
  private readonly stalls: Stall[] = [];
  private readonly tower: { mesh: THREE.Mesh; size: number; rest: number; land: number }[] = [];
  private readonly sign = new THREE.Group();
  private readonly pulse: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly ring: THREE.Mesh;
  private readonly coin: THREE.Mesh;
  private readonly parcel: THREE.Group;
  private readonly winner: Stall;
  private readonly look = new THREE.Vector3();
  private fit = 1;

  constructor(canvas: HTMLCanvasElement, mobile: boolean) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    this.renderer.setClearColor(0x000000, 0);
    this.scene.add(this.mascot.group);

    // ---- the tower he builds by hand
    let top = GROUND;
    TOWER_COLORS.forEach((hex, i) => {
      const size = 0.62 - i * 0.04;
      const mesh = this.box(size, size * 0.9, size, hex).mesh;
      this.tower.push({ mesh, size, rest: top + size * 0.45, land: 0.45 + i * 0.09 });
      top += size * 0.9;
      this.scene.add(mesh);
    });

    // ---- the market
    const count = mobile ? 5 : 7;
    const radius = mobile ? 4.1 : 5.6;
    const spread = ((mobile ? 52 : 62) * Math.PI) / 180;
    const finalists = mobile ? [0, 2, 4] : [1, 3, 5];
    for (let i = 0; i < count; i++) {
      const a = -spread + (2 * spread * i) / (count - 1);
      const stall = this.buildStall(STALL_COLORS[i % STALL_COLORS.length]);
      stall.x = Math.sin(a) * radius;
      stall.z = -Math.cos(a) * radius + 0.6;
      stall.finalist = finalists.indexOf(i);
      stall.winner = stall.finalist === 2;
      stall.group.rotation.y = -a;
      if (stall.finalist >= 0) {
        stall.bars = this.buildBars(stall.winner ? [0.95, 0.9, 1] : stall.finalist === 0 ? [0.5, 0.7, 0.85] : [0.8, 0.35, 0.6]);
        stall.bars.position.y = 2.75;
        stall.gate = this.buildGate(GATES[stall.finalist]);
        stall.group.add(stall.bars, stall.gate);
      }
      this.stalls.push(stall);
      this.scene.add(stall.group);
    }
    this.winner = this.stalls.find((s) => s.winner) ?? this.stalls[0];

    // ---- the Rialto sign behind the market
    const board = this.box(4.4, 1.3, 0.16, 0xc6ff3d).mesh;
    board.position.y = 3.75;
    const name = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.25), new THREE.MeshBasicMaterial({ map: textTexture("RIALTO", "#17120f", "#c6ff3d") }));
    name.position.set(0, 3.75, 0.09);
    this.sign.add(board, name);
    for (const x of [-1.7, 1.7]) {
      const post = this.box(0.14, 3.2, 0.14, WOOD_DARK).mesh;
      post.position.set(x, 1.6, -0.02);
      this.sign.add(post);
    }
    this.sign.position.set(0, GROUND, -radius - 0.5);
    this.scene.add(this.sign);

    this.pulse = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 56), new THREE.MeshBasicMaterial({ color: 0xc6ff3d, transparent: true, side: THREE.DoubleSide }));
    this.pulse.rotation.x = -Math.PI / 2;
    this.pulse.position.y = GROUND + 0.02;
    this.scene.add(this.pulse);

    this.ring = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), new THREE.MeshBasicMaterial({ color: 0xc6ff3d }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.set(this.winner.x, GROUND + 0.01, this.winner.z);
    this.scene.add(this.ring);

    this.coin = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.07, 14), [
      new THREE.MeshBasicMaterial({ color: 0xd9a400 }),
      new THREE.MeshBasicMaterial({ color: 0xffd23f }),
      new THREE.MeshBasicMaterial({ color: 0xffd23f }),
    ]);
    this.scene.add(this.coin);

    this.parcel = new THREE.Group();
    this.parcel.add(this.box(0.7, 0.52, 0.52, 0xd9a868).mesh, this.box(0.14, 0.54, 0.54, 0xc6ff3d).mesh);
    this.scene.add(this.parcel);
  }

  /** Box with per-face shades: fakes lighting without any lights in the scene. */
  private box(w: number, h: number, d: number, hex: number): { mesh: THREE.Mesh; tinted: Tinted[] } {
    const tinted = [0.86, 0.72, 1.06, 0.55, 0.96, 0.64].map((k) => {
      const base = new THREE.Color(hex).multiplyScalar(k);
      return { base, material: new THREE.MeshBasicMaterial({ color: base.clone() }) };
    });
    return { mesh: new THREE.Mesh(new THREE.BoxGeometry(w, h, d), tinted.map((t) => t.material)), tinted };
  }

  private buildStall(color: number): Stall {
    const group = new THREE.Group();
    const tinted: Tinted[] = [];
    const add = (w: number, h: number, d: number, hex: number, x: number, y: number, z: number, parent: THREE.Object3D = group) => {
      const b = this.box(w, h, d, hex);
      b.mesh.position.set(x, y, z);
      parent.add(b.mesh);
      tinted.push(...b.tinted);
    };
    add(1.7, 0.74, 0.86, WOOD, 0, 0.37, 0);
    add(1.84, 0.1, 1.0, WOOD_DARK, 0, 0.79, 0);
    add(0.1, 1.2, 0.1, WOOD_DARK, -0.78, 1.4, -0.32);
    add(0.1, 1.2, 0.1, WOOD_DARK, 0.78, 1.4, -0.32);
    const awning = new THREE.Group();
    awning.position.set(0, 2.05, 0.05);
    awning.rotation.x = 0.32;
    for (let i = 0; i < 5; i++) add(0.38, 0.08, 1.2, i % 2 ? 0xfffaf0 : color, -0.76 + i * 0.38, 0, 0, awning);
    group.add(awning);
    group.position.y = GROUND;
    return { group, tinted, x: 0, z: 0, finalist: -1, winner: false, bars: null, gate: null, dim: 0 };
  }

  /** The red gate that slams down in front of a stall. */
  private buildGate(text: string): THREE.Group {
    const gate = new THREE.Group();
    gate.add(this.box(2.05, 1.5, 0.18, 0xff4d4d).mesh);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 0.55), new THREE.MeshBasicMaterial({ map: textTexture(text, "#17120f", "#fffdf7") }));
    label.position.set(0, 0.1, 0.1);
    gate.add(label);
    gate.position.set(0, 0.8, 0.85);
    gate.visible = false;
    return gate;
  }

  /** Three little score bars (price, speed, trust) that grow above a finalist. */
  private buildBars(values: number[]): THREE.Group {
    const group = new THREE.Group();
    const colors = [0x17120f, 0x5ce1e6, 0xffd23f];
    values.forEach((v, i) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 0.2), new THREE.MeshBasicMaterial({ color: colors[i] }));
      bar.geometry.translate(0, 0.5, 0);
      bar.position.x = (i - 1) * 0.3;
      bar.userData.value = v;
      group.add(bar);
    });
    return group;
  }

  resize(w: number, h: number): void {
    this.camera.aspect = Math.max(1, w) / Math.max(1, h);
    // pull back on narrow canvases so the whole market stays in frame
    this.fit = Math.max(1, 1.45 / this.camera.aspect);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  render(p: number, time: number, dt: number): void {
    const sin = Math.sin;

    // ---- camera
    let k = 0;
    while (k < CAMERA.length - 2 && p > CAMERA[k + 1].p) k++;
    const a = CAMERA[k];
    const b = CAMERA[k + 1];
    const t = smooth(seg(p, a.p, b.p));
    this.camera.position.set(a.pos[0] + (b.pos[0] - a.pos[0]) * t, a.pos[1] + (b.pos[1] - a.pos[1]) * t, (a.pos[2] + (b.pos[2] - a.pos[2]) * t) * this.fit);
    this.look.set(a.look[0] + (b.look[0] - a.look[0]) * t, a.look[1] + (b.look[1] - a.look[1]) * t, a.look[2] + (b.look[2] - a.look[2]) * t);
    this.camera.lookAt(this.look);

    // ---- the agent
    this.mascot.update({
      time,
      dt,
      mx: p < 0.14 ? 0.9 : 0,
      sad: within(p, 0.1, 0.29, 0.015),
      scout: within(p, 0.43, 0.56),
      think: within(p, 0.57, 0.69),
      // one hop when Rialto shows up, one when he picks the winner
      hop: p < 0.45 ? seg(p, 0.29, 0.34) : seg(p, 0.655, 0.7),
      pay: within(p, 0.71, 0.83),
      party: seg(p, 0.92, 0.96),
    });

    // ---- SCRATCH: the tower goes up cube by cube, then over
    const fall = seg(p, 0.095, 0.135);
    const cleared = seg(p, 0.145, 0.165);
    const placedCount = this.tower.filter((_, i) => p > 0.012 + i * 0.013).length;
    this.tower.forEach((c, i) => {
      const placed = seg(p, 0.012 + i * 0.013, 0.026 + i * 0.013);
      c.mesh.visible = placed > 0 && cleared < 1;
      if (!c.mesh.visible) return;
      const down = clamp01(fall / c.land);
      const sway = fall > 0 ? 0 : sin(time * 3.2) * 0.012 * Math.pow(placedCount, 1.3) * (c.rest - GROUND);
      const dir = rnd(i, 1) - 0.3;
      c.mesh.position.set(
        TOWER_X + (rnd(i, 2) - 0.5) * 0.1 + sway + dir * (1 + i * 0.45) * down,
        c.rest + (1 - bounce(placed)) * 2.6 + (GROUND + c.size * 0.45 - c.rest) * down * down,
        0.3 + (rnd(i, 3) - 0.4) * (0.8 + i * 0.3) * down,
      );
      c.mesh.rotation.set(down * (1.5 + rnd(i, 4) * 3), rnd(i, 5) * 0.5 + down * 2, down * (rnd(i, 6) - 0.5) * 4);
      c.mesh.scale.setScalar(Math.max(0.0001, 1 - cleared));
    });

    // ---- stalls: the three he wants first, the rest when Rialto arrives
    const lifted = seg(p, 0.285, 0.31);
    const scored = seg(p, 0.585, 0.66);
    const decided = seg(p, 0.66, 0.7);
    let other = 0;
    this.stalls.forEach((s, i) => {
      const isFinalist = s.finalist >= 0;
      const start = isFinalist ? 0.15 + s.finalist * 0.008 : 0.3 + other++ * 0.014;
      const born = backOut(seg(p, start, start + 0.04));
      const dim = isFinalist ? (s.winner ? 0 : decided * 0.75) : seg(p, 0.5, 0.55);
      const scan = sin(seg(p, 0.44 + i * 0.012, 0.47 + i * 0.012) * Math.PI) * 0.3;
      const eager = isFinalist ? sin(seg(p, 0.565, 0.6) * Math.PI) * 0.35 : 0;
      const cheer = s.winner ? sin(seg(p, 0.655, 0.7) * Math.PI) * 0.6 + sin(seg(p, 0.8, 0.83) * Math.PI) * 0.35 : 0;
      s.group.position.set(s.x, GROUND + scan + eager + cheer, s.z);
      s.group.scale.setScalar(Math.max(0.0001, born * (1 - dim * 0.16)));
      if (Math.abs(dim - s.dim) > 0.004) {
        s.dim = dim;
        for (const tint of s.tinted) tint.material.color.copy(tint.base).lerp(GREY, dim * 0.85);
      }
      if (s.gate) {
        // BLOCKED: each gate slams down in turn; RIALTO: they all fly off
        const at = 0.185 + s.finalist * 0.026;
        s.gate.visible = p > at && lifted < 1;
        s.gate.position.y = 0.8 + (1 - bounce(seg(p, at, at + 0.022))) * 7 + lifted * lifted * 9;
      }
      if (s.bars) {
        const show = within(p, 0.58, s.winner ? 0.76 : 0.7, 0.02);
        s.bars.visible = show > 0.01;
        s.bars.children.forEach((bar, j) => bar.scale.set(show, Math.max(0.0001, smooth(clamp01(scored * 1.6 - j * 0.25)) * (bar.userData.value as number) * 1.1), show));
      }
    });

    // ---- RIALTO: a pulse runs out from him and the sign drops in
    const wave = seg(p, 0.285, 0.36);
    this.pulse.visible = wave > 0 && wave < 1;
    this.pulse.scale.setScalar(1 + wave * 9);
    this.pulse.material.opacity = 1 - wave;
    this.sign.visible = p > 0.3;
    this.sign.position.y = GROUND + (1 - bounce(seg(p, 0.3, 0.34))) * 9;

    this.ring.scale.setScalar(Math.max(0.0001, backOut(decided)));

    // ---- PAY: money out
    const pay = seg(p, 0.74, 0.81);
    this.coin.visible = pay > 0 && pay < 1;
    this.coin.position.set(1.1 + (this.winner.x - 1.1) * pay, 0.6 + (GROUND + 1.3 - 0.6) * pay + sin(pay * Math.PI) * 2.6, this.winner.z * pay);
    this.coin.rotation.set(time * 9, time * 3, Math.PI / 2);

    // ---- DONE: goods back
    const back = seg(p, 0.85, 0.92);
    this.parcel.visible = back > 0 && back < 1;
    this.parcel.position.set(this.winner.x + (0.2 - this.winner.x) * back, GROUND + 1.3 + (0.2 - GROUND - 1.3) * back + sin(back * Math.PI) * 2.8, this.winner.z + (1.3 - this.winner.z) * back);
    this.parcel.rotation.set(back * 5, back * 7, 0);
    this.parcel.scale.setScalar(1 - seg(back, 0.9, 1));

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (m instanceof THREE.MeshBasicMaterial) m.map?.dispose();
          m.dispose();
        });
      }
    });
    this.renderer.dispose();
  }
}
