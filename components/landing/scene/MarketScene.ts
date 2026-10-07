import * as THREE from "three";
import { Mascot } from "./mascot";

/**
 * "How it works" as one scroll-driven scene, in the pitch video's low-poly style.
 * A pure function of scroll progress `p` (0..1); time only adds idle motion.
 *
 *   0.00 - 0.25  FIND     the market pops up around the agent while he scans it
 *   0.25 - 0.50  COMPARE  most stalls fade back, three finalists get scored, one wins
 *   0.50 - 0.75  PAY      a coin flies to the winner
 *   0.75 - 1.00  DONE     the parcel flies back, confetti
 *
 * No lights and no post-processing: every box carries its own per-face shades.
 */

const GROUND = -1.085; // the mascot's feet
const GREY = new THREE.Color(0xcfc6b4);
const STALL_COLORS = [0x5ce1e6, 0xffd23f, 0x9945ff, 0x14f195, 0xff8fb3, 0xc6ff3d, 0x5ce1e6];
const WOOD = 0xb98a5a;
const WOOD_DARK = 0x8d6540;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);
const backOut = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2));
/** 1 inside [a, b], easing in and out over `edge` */
const within = (p: number, a: number, b: number, edge = 0.035) => seg(p, a, a + edge) * (1 - seg(p, b - edge, b));

interface Tinted {
  material: THREE.MeshBasicMaterial;
  base: THREE.Color;
}
interface Stall {
  group: THREE.Group;
  tinted: Tinted[];
  x: number;
  z: number;
  candidate: boolean;
  winner: boolean;
  bars: THREE.Group | null;
  dim: number;
}
type V3 = [number, number, number];
const CAMERA: { p: number; pos: V3; look: V3 }[] = [
  { p: 0, pos: [0, 2.6, 11.5], look: [0, 0.1, -1.6] },
  { p: 0.3, pos: [0, 1.9, 10], look: [0, 0.3, -1.8] },
  { p: 0.5, pos: [0, 1.9, 10], look: [0, 0.3, -1.8] },
  { p: 0.62, pos: [-2.4, 1.5, 9], look: [1, 0, -1.4] },
  { p: 0.76, pos: [-2.4, 1.5, 9], look: [1, 0, -1.4] },
  { p: 0.92, pos: [0, 0.9, 7.6], look: [0, -0.1, 0] },
];

export class MarketScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  private readonly mascot = new Mascot();
  private readonly stalls: Stall[] = [];
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

    const count = mobile ? 5 : 7;
    const radius = mobile ? 4.1 : 5.6;
    const spread = ((mobile ? 52 : 62) * Math.PI) / 180;
    const finalists = mobile ? [0, 2, 4] : [1, 3, 5];
    for (let i = 0; i < count; i++) {
      const a = -spread + (2 * spread * i) / (count - 1);
      const stall = this.buildStall(STALL_COLORS[i % STALL_COLORS.length]);
      stall.x = Math.sin(a) * radius;
      stall.z = -Math.cos(a) * radius + 0.6;
      stall.candidate = finalists.includes(i);
      stall.winner = i === finalists[2];
      stall.group.rotation.y = -a;
      if (stall.candidate) {
        stall.bars = this.buildBars(stall.winner ? [0.95, 0.9, 1] : i === finalists[0] ? [0.5, 0.7, 0.85] : [0.8, 0.35, 0.6]);
        stall.bars.position.y = 2.75;
        stall.group.add(stall.bars);
      }
      this.stalls.push(stall);
      this.scene.add(stall.group);
    }
    this.winner = this.stalls.find((s) => s.winner) ?? this.stalls[0];

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
    return { group, tinted, x: 0, z: 0, candidate: false, winner: false, bars: null, dim: 0 };
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
      mx: 0,
      scout: within(p, 0.02, 0.25),
      think: within(p, 0.27, 0.47),
      hop: seg(p, 0.455, 0.505),
      pay: within(p, 0.52, 0.72),
      party: seg(p, 0.88, 0.93),
    });

    // ---- stalls: pop in one by one, losers fade back, finalists get scored
    const scored = seg(p, 0.3, 0.44);
    const decided = seg(p, 0.44, 0.5);
    this.stalls.forEach((s, i) => {
      const born = backOut(seg(p, 0.02 + i * 0.022, 0.1 + i * 0.022));
      const dim = s.candidate ? (s.winner ? 0 : decided * 0.75) : seg(p, 0.26, 0.32);
      const hop = s.candidate ? sin(seg(p, 0.27, 0.31) * Math.PI) * 0.35 : 0;
      const cheer = s.winner ? sin(seg(p, 0.455, 0.505) * Math.PI) * 0.6 + sin(seg(p, 0.655, 0.7) * Math.PI) * 0.35 : 0;
      s.group.position.set(s.x, GROUND + hop + cheer, s.z);
      s.group.scale.setScalar(Math.max(0.0001, born * (1 - dim * 0.16)));
      if (Math.abs(dim - s.dim) > 0.004) {
        s.dim = dim;
        for (const tint of s.tinted) tint.material.color.copy(tint.base).lerp(GREY, dim * 0.85);
      }
      if (s.bars) {
        const show = within(p, 0.29, s.winner ? 0.56 : 0.5, 0.02);
        s.bars.visible = show > 0.01;
        s.bars.children.forEach((bar, j) => bar.scale.set(show, Math.max(0.0001, smooth(clamp01(scored * 1.6 - j * 0.25)) * (bar.userData.value as number) * 1.1), show));
      }
    });
    this.ring.scale.setScalar(Math.max(0.0001, backOut(decided)));

    // ---- money out
    const pay = seg(p, 0.56, 0.68);
    this.coin.visible = pay > 0 && pay < 1;
    this.coin.position.set(1.1 + (this.winner.x - 1.1) * pay, 0.6 + (GROUND + 1.3 - 0.6) * pay + sin(pay * Math.PI) * 2.6, this.winner.z * pay);
    this.coin.rotation.set(time * 9, time * 3, Math.PI / 2);

    // ---- goods back
    const back = seg(p, 0.77, 0.88);
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
        mats.forEach((m) => m.dispose());
      }
    });
    this.renderer.dispose();
  }
}
