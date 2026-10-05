import * as THREE from "three";
import { CORE_FRAG, CORE_VERT, FLOOR_FRAG, FLOOR_VERT, TRACK_FRAG, TRACK_VERT } from "./shaders";

/**
 * The landing's 3D story: an agent core hires one specialist out of five.
 * A pure function of scroll progress `p` (0..1); time only drives ambient motion.
 *
 *   0.00  hero        core alone
 *   0.13  scout       specialists drop in, tracks draw
 *   0.31  vet         two fail policy (red, sink); the rest get scored
 *   0.49  hire        winner lights up, others dim
 *   0.65  pay         orange packets core → winner
 *   0.84  delivered   cyan packets winner → core, shockwave
 *
 * Deliberately no post-processing: one forward pass, capped DPR.
 */

export interface YardNodeSpec {
  rejected: boolean;
  winner: boolean;
  /** 0..1 */
  score: number;
}
export type LabelState = "idle" | "rejected" | "winner" | "dim";
export interface LabelFrame {
  x: number;
  y: number;
  opacity: number;
  fill: number;
  state: LabelState;
}
export interface YardOptions {
  mobile: boolean;
  reduced: boolean;
}

const HEX = { ink: 0x0b0c0a, signal: 0xc6ff3d, pay: 0xff5b1f, data: 0x5ce1e6, fail: 0xff3b3b, paper: 0xedebe3, steel: 0x8c8e84 };
const CORE_POS = new THREE.Vector3(0, 0, 4);
const PACKETS_PER_TRACK = 4;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOutBack = (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

interface CamKey {
  p: number;
  pos: [number, number, number];
  look: [number, number, number];
}
interface YardNode {
  spec: YardNodeSpec;
  group: THREE.Group;
  home: THREE.Vector3;
  body: THREE.MeshBasicMaterial;
  edges: THREE.LineBasicMaterial;
  curve: THREE.QuadraticBezierCurve3;
  track: THREE.ShaderMaterial;
  packets: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[];
  order: number;
  rejectOrder: number;
}

export class YardScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(46, 1, 0.1, 160);
  private readonly nodes: YardNode[] = [];
  private readonly core = new THREE.Group();
  private readonly coreMat: THREE.ShaderMaterial;
  private readonly shellMat: THREE.LineBasicMaterial;
  private readonly rings: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly floorMat: THREE.ShaderMaterial;
  private readonly shock: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly keys: CamKey[];
  private readonly camPos = new THREE.Vector3();
  private readonly camLook = new THREE.Vector3();
  private readonly tA = new THREE.Vector3();
  private readonly tB = new THREE.Vector3();
  private readonly tC = new THREE.Color();
  private readonly c = {
    signal: new THREE.Color(HEX.signal), pay: new THREE.Color(HEX.pay), data: new THREE.Color(HEX.data),
    fail: new THREE.Color(HEX.fail), paper: new THREE.Color(HEX.paper), steel: new THREE.Color(HEX.steel),
  };
  private readonly frames: LabelFrame[];
  private width = 1;
  private height = 1;
  private fit = 1;
  private first = true;

  constructor(canvas: HTMLCanvasElement, specs: YardNodeSpec[], private readonly opts: YardOptions) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.mobile ? 1.25 : 1.5));
    this.renderer.setClearColor(HEX.ink, 1);

    // ---- floor
    this.floorMat = new THREE.ShaderMaterial({
      vertexShader: FLOOR_VERT,
      fragmentShader: FLOOR_FRAG,
      uniforms: {
        uTime: { value: 0 }, uColor: { value: new THREE.Color(HEX.signal) },
        uFocus: { value: new THREE.Vector2(CORE_POS.x, CORE_POS.z) }, uEnergy: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.6;
    this.scene.add(floor);

    // ---- core (the agent)
    this.coreMat = new THREE.ShaderMaterial({
      vertexShader: CORE_VERT,
      fragmentShader: CORE_FRAG,
      uniforms: { uTime: { value: 0 }, uAmp: { value: 0.06 }, uColor: { value: new THREE.Color(HEX.signal) }, uBoost: { value: 0 } },
    });
    this.core.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1, opts.mobile ? 4 : 5), this.coreMat));
    this.shellMat = new THREE.LineBasicMaterial({ color: HEX.signal, transparent: true, opacity: 0.45 });
    this.core.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.55, 1)), this.shellMat));
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.0 + i * 0.35, 0.014, 6, 96), new THREE.MeshBasicMaterial({ color: HEX.signal }));
      ring.rotation.x = Math.PI / 2 + (i ? 0.5 : -0.35);
      this.rings.push(ring);
      this.core.add(ring);
    }
    this.core.position.copy(CORE_POS);
    this.scene.add(this.core);

    // ---- shockwave
    this.shock = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1, 80),
      new THREE.MeshBasicMaterial({ color: HEX.signal, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.shock.rotation.x = -Math.PI / 2;
    this.shock.position.set(CORE_POS.x, -1.5, CORE_POS.z);
    this.scene.add(this.shock);

    // ---- specialists
    const radius = opts.mobile ? 5.2 : 8.2;
    const spread = ((opts.mobile ? 48 : 62) * Math.PI) / 180;
    const slots = this.slotOrder(specs);
    const boxGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const edgeGeo = new THREE.EdgesGeometry(boxGeo);
    const packetGeo = new THREE.SphereGeometry(0.1, 10, 8);
    let rejectCount = 0;

    specs.forEach((spec, i) => {
      const slot = slots[i];
      const a = specs.length > 1 ? -spread + (2 * spread * slot) / (specs.length - 1) : 0;
      const home = new THREE.Vector3(CORE_POS.x + Math.sin(a) * radius, 0.35 + (slot % 2) * 0.5, CORE_POS.z - Math.cos(a) * radius);
      const body = new THREE.MeshBasicMaterial({ color: HEX.ink, transparent: true });
      const edges = new THREE.LineBasicMaterial({ color: HEX.steel, transparent: true });
      const group = new THREE.Group();
      group.add(new THREE.Mesh(boxGeo, body), new THREE.LineSegments(edgeGeo, edges));
      this.scene.add(group);

      const curve = new THREE.QuadraticBezierCurve3(CORE_POS.clone(), CORE_POS.clone().lerp(home, 0.5).setY(2.6), home.clone());
      const track = new THREE.ShaderMaterial({
        vertexShader: TRACK_VERT,
        fragmentShader: TRACK_FRAG,
        uniforms: {
          uTime: { value: 0 }, uDraw: { value: 0 }, uFlow: { value: 0.5 }, uDir: { value: 1 }, uAlpha: { value: 1 },
          uColor: { value: new THREE.Color(HEX.steel) },
        },
        transparent: true,
        depthWrite: false,
      });
      this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.03, 6), track));

      const packets = Array.from({ length: PACKETS_PER_TRACK }, () => {
        const m = new THREE.Mesh(packetGeo, new THREE.MeshBasicMaterial({ color: HEX.paper }));
        m.visible = false;
        this.scene.add(m);
        return m;
      });
      this.nodes.push({ spec, group, home, body, edges, curve, track, packets, order: i, rejectOrder: spec.rejected ? rejectCount++ : -1 });
    });

    const lookHero: [number, number, number] = opts.mobile ? [0, 3.4, 3] : [-3.4, 1.1, 3];
    this.keys = [
      { p: 0.0, pos: [0, 2.0, 11.5], look: lookHero },
      { p: 0.1, pos: [0, 2.4, 12], look: lookHero },
      { p: 0.22, pos: [0, 8.5, 17.5], look: [0, 0.2, -0.8] },
      { p: 0.46, pos: [0, 7.4, 16.5], look: [0, 0.2, -0.8] },
      { p: 0.6, pos: [0, 4.0, 10.5], look: [0, 0.9, -2.2] },
      { p: 0.74, pos: [5.2, 2.4, 8.6], look: [0, 0.9, -0.2] },
      { p: 0.9, pos: [0, 4.6, 13], look: [0, 0.3, 2.4] },
      { p: 1.0, pos: [0, 6.5, 15.5], look: [0, 0.3, 2] },
    ];
    this.frames = specs.map(() => ({ x: 0, y: 0, opacity: 0, fill: 0, state: "idle" as LabelState }));
  }

  /** Winner in the centre, rejected at the edges. */
  private slotOrder(specs: YardNodeSpec[]): number[] {
    const n = specs.length;
    const centre = Math.floor(n / 2);
    const free = Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre));
    const rank = specs.map((s, i) => ({ i, w: s.winner ? 0 : s.rejected ? 2 : 1 })).sort((a, b) => a.w - b.w || a.i - b.i);
    const out = new Array<number>(n).fill(0);
    rank.forEach((r, k) => {
      out[r.i] = free[k];
    });
    return out;
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const aspect = this.width / this.height;
    this.fit = Math.max(1, 1.05 / aspect);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false);
  }

  private cameraTarget(p: number): void {
    const k = this.keys;
    let i = 0;
    while (i < k.length - 2 && p > k[i + 1].p) i++;
    const a = k[i];
    const b = k[i + 1];
    const t = smooth(seg(p, a.p, b.p));
    this.tB.set(a.look[0] + (b.look[0] - a.look[0]) * t, a.look[1] + (b.look[1] - a.look[1]) * t, a.look[2] + (b.look[2] - a.look[2]) * t);
    this.tA.set(a.pos[0] + (b.pos[0] - a.pos[0]) * t, a.pos[1] + (b.pos[1] - a.pos[1]) * t, a.pos[2] + (b.pos[2] - a.pos[2]) * t);
    this.tA.sub(this.tB).multiplyScalar(this.fit).add(this.tB);
  }

  /** Render one frame. `mx,my` are pointer offsets in -1..1. Returns per-node label frames (reused array). */
  render(p: number, time: number, dt: number, mx: number, my: number): LabelFrame[] {
    const t = this.opts.reduced ? 0 : time;
    const discover = seg(p, 0.13, 0.29);
    const vet = seg(p, 0.31, 0.47);
    const hire = smooth(seg(p, 0.49, 0.6));
    const pay = seg(p, 0.65, 0.8);
    const deliver = seg(p, 0.84, 0.97);
    const payMix = smooth(seg(p, 0.62, 0.67)) * (1 - smooth(seg(p, 0.81, 0.86)));
    const deliverMix = smooth(seg(p, 0.83, 0.88));
    const { signal, pay: payC, data, fail, paper, steel } = this.c;

    // ---- core
    const coreColor = this.tC.copy(signal).lerp(payC, payMix);
    (this.coreMat.uniforms.uColor.value as THREE.Color).copy(coreColor);
    this.coreMat.uniforms.uTime.value = t;
    this.coreMat.uniforms.uAmp.value = 0.06 + vet * (1 - hire) * 0.1 + Math.sin(deliver * Math.PI) * 0.18;
    this.coreMat.uniforms.uBoost.value = Math.sin(deliver * Math.PI) * 0.8 + payMix * 0.25;
    this.shellMat.color.copy(coreColor);
    this.core.rotation.y = t * 0.25;
    this.core.position.y = CORE_POS.y + Math.sin(t * 0.9) * 0.08;
    this.rings.forEach((ring, i) => {
      ring.rotation.z = t * (i ? -0.5 : 0.7);
      ring.material.color.copy(coreColor);
    });

    // ---- floor + shockwave
    this.floorMat.uniforms.uTime.value = t;
    (this.floorMat.uniforms.uColor.value as THREE.Color).copy(coreColor).lerp(data, deliverMix * 0.35);
    this.floorMat.uniforms.uEnergy.value = Math.max(vet * (1 - hire), payMix, Math.sin(deliver * Math.PI));
    this.shock.scale.setScalar(1 + deliver * 22);
    this.shock.material.opacity = deliver > 0 && deliver < 1 ? (1 - deliver) * 0.8 : 0;

    // ---- specialists
    for (const n of this.nodes) {
      const appear = seg(discover, n.order * 0.14, n.order * 0.14 + 0.42);
      const pop = appear <= 0 ? 0 : easeOutBack(appear);
      const rej = n.spec.rejected ? smooth(seg(vet, 0.08 + n.rejectOrder * 0.22, 0.4 + n.rejectOrder * 0.22)) : 0;
      const win = n.spec.winner ? hire : 0;
      const dim = !n.spec.winner && !n.spec.rejected ? hire : 0;

      const col = this.tC.copy(steel).lerp(paper, appear).lerp(fail, rej).lerp(signal, win);
      n.edges.color.copy(col);
      n.body.color.copy(col).multiplyScalar(0.16 + win * 0.3);
      const alpha = clamp01(appear * 2) * (1 - rej * 0.7) * (1 - dim * 0.7);
      n.edges.opacity = alpha;
      n.body.opacity = alpha;
      n.group.position.set(n.home.x, n.home.y + (1 - appear) * 7 - rej * 1.1 + win * 0.6 + Math.sin(t * 1.1 + n.order) * 0.07, n.home.z);
      n.group.scale.setScalar(Math.max(0.0001, pop * (1 + win * 0.7) * (1 - rej * 0.3)));
      n.group.rotation.set(t * 0.3 + n.order, t * 0.45 + n.order * 1.7, rej * 0.5);

      const u = n.track.uniforms;
      u.uTime.value = t;
      u.uDraw.value = appear * (1 - rej);
      u.uAlpha.value = 1 - dim * 0.8;
      const trackColor = u.uColor.value as THREE.Color;
      trackColor.copy(steel).lerp(fail, rej).lerp(signal, win);
      if (n.spec.winner) trackColor.lerp(payC, payMix).lerp(data, deliverMix);
      u.uFlow.value = n.spec.winner ? 0.5 + (payMix + deliverMix) * 0.5 : 0.4 * (1 - dim);
      u.uDir.value = n.spec.winner && deliverMix > 0.5 ? -1 : 1;

      const scanning = !n.spec.rejected && vet > 0.45 && vet < 1 && hire === 0;
      const paying = n.spec.winner && pay > 0 && deliver <= 0;
      const returning = n.spec.winner && deliver > 0 && deliver < 1;
      const active = scanning || paying || returning;
      n.packets.forEach((m, k) => {
        m.visible = active && (!scanning || k === 0);
        if (!m.visible) return;
        let u01 = this.opts.reduced ? (k + 0.5) / PACKETS_PER_TRACK : (t * (scanning ? 0.5 : 0.6) + k / PACKETS_PER_TRACK) % 1;
        if (returning) u01 = 1 - u01;
        n.curve.getPoint(u01, m.position);
        m.material.color.copy(returning ? data : paying ? payC : paper);
        m.scale.setScalar(scanning ? 0.9 : 1.6);
      });
    }

    // ---- camera
    this.cameraTarget(p);
    const k = this.first || this.opts.reduced ? 1 : 1 - Math.exp(-dt * 3.5);
    this.first = false;
    this.camPos.lerp(this.tA, k);
    this.camLook.lerp(this.tB, k);
    this.camera.position.set(this.camPos.x + mx * 0.9, this.camPos.y - my * 0.5, this.camPos.z);
    this.camera.lookAt(this.camLook);
    this.renderer.render(this.scene, this.camera);

    // ---- labels
    this.nodes.forEach((n, i) => {
      const f = this.frames[i];
      const appear = seg(discover, n.order * 0.14 + 0.25, n.order * 0.14 + 0.5);
      this.tA.copy(n.group.position).y += 0.95 * n.group.scale.x;
      this.tA.project(this.camera);
      f.x = (this.tA.x * 0.5 + 0.5) * this.width;
      f.y = (-this.tA.y * 0.5 + 0.5) * this.height;
      const rejected = n.spec.rejected && vet > 0.1 + n.rejectOrder * 0.22;
      f.state = rejected ? "rejected" : n.spec.winner && hire > 0.3 ? "winner" : hire > 0.3 && !n.spec.rejected ? "dim" : "idle";
      f.opacity = this.tA.z > 1 ? 0 : appear * (f.state === "dim" ? 0.35 : f.state === "rejected" ? 0.75 : 1);
      f.fill = n.spec.rejected ? 0 : smooth(seg(vet, 0.45, 0.95)) * n.spec.score;
    });
    return this.frames;
  }

  dispose(): void {
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        o.geometry.dispose();
        const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
    this.renderer.dispose();
  }
}
