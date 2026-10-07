import * as THREE from "three";
import { backOut, buildCoin, buildStall, clamp01, disposeScene, GROUND, MiniCritter, seg, shadedBox, smooth, textTexture } from "./lowpoly";
import { Mascot } from "./mascot";

/**
 * The hero: a small market at work. Stalls stand in an arc under the Rialto sign; little agents
 * file past them, pay each one a coin and walk off with a stack of parcels, while the orange
 * critter stands in the middle and watches you.
 *
 * Everything is a function of time: the queue moves one stall at a time (walk, then pause to buy),
 * so the agents can never run into each other.
 */

const LABELS = ["SPRITES", "VOICE", "3D", "SEARCH", "DATA", "VISION", "TRANSLATE"];
const STALL_COLORS = [0x5ce1e6, 0xffd23f, 0x9945ff, 0x14f195, 0xff8fb3, 0xc6ff3d, 0x5ce1e6];
const BUYER_COLORS = [0x5ce1e6, 0xff8fb3, 0xffd23f, 0x14f195, 0xb98cff, 0xfffaf0];
/** seconds per move: walk to the next stall, then stand and buy */
const PERIOD = 2.5;
const WALK = 1.4;
const BUYER_SCALE = 0.5;

export class HeroScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 90);
  private readonly mascot = new Mascot();
  private readonly stalls: { group: THREE.Group; x: number; z: number }[] = [];
  private readonly buyers: MiniCritter[] = [];
  private readonly coins: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly count: number;
  private readonly radius: number;
  private readonly spread: number;
  private hovered = -1;
  private fit = 1;

  constructor(canvas: HTMLCanvasElement, mobile: boolean) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    this.renderer.setClearColor(0x000000, 0);
    this.count = mobile ? 5 : 7;
    this.radius = mobile ? 4.4 : 5.6;
    this.spread = ((mobile ? 54 : 62) * Math.PI) / 180;

    // the square the market stands on, and the pad under the critter
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(this.radius + 2.4, 64), new THREE.MeshBasicMaterial({ color: 0xe6d6b4 }));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, GROUND - 0.02, -0.6);
    const pad = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.6, 48), new THREE.MeshBasicMaterial({ color: 0xc6ff3d }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, GROUND, 1);
    this.scene.add(plaza, pad);

    for (let i = 0; i < this.count; i++) {
      const a = this.angle(i);
      const group = buildStall(STALL_COLORS[i % STALL_COLORS.length], LABELS[i % LABELS.length]);
      const x = Math.sin(a) * this.radius;
      const z = -Math.cos(a) * this.radius + 0.6;
      group.rotation.y = -a;
      this.stalls.push({ group, x, z });
      this.coins.push(buildCoin());
      this.scene.add(group, this.coins[i]);
    }

    // the Rialto sign behind the market
    const sign = new THREE.Group();
    const board = shadedBox(4.4, 1.3, 0.16, 0xc6ff3d);
    board.position.y = 3.95;
    const name = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.25), new THREE.MeshBasicMaterial({ map: textTexture("RIALTO", "#17120f", "#c6ff3d") }));
    name.position.set(0, 3.95, 0.09);
    sign.add(board, name);
    for (const x of [-1.7, 1.7]) {
      const post = shadedBox(0.14, 3.4, 0.14, 0x8d6540);
      post.position.set(x, 1.7, -0.02);
      sign.add(post);
    }
    sign.position.set(0, GROUND, -this.radius - 0.5);
    this.scene.add(sign);

    this.mascot.group.position.set(0, 0, 1);
    this.scene.add(this.mascot.group);

    // enough agents to fill the arc plus the ones walking in and out
    for (let j = 0; j < this.count + 4; j++) {
      const buyer = new MiniCritter([BUYER_COLORS[j % BUYER_COLORS.length]], 3);
      this.buyers.push(buyer);
      this.scene.add(buyer.group);
    }
  }

  private angle(slot: number): number {
    return -this.spread + (2 * this.spread * slot) / (this.count - 1);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = Math.max(1, w) / Math.max(1, h);
    // pull back on narrow canvases so the whole arc stays in frame
    this.fit = Math.max(1, 1.5 / this.camera.aspect);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  render(time: number, dt: number, mx: number, my: number): void {
    const sin = Math.sin;
    this.camera.position.set(mx * 0.9, 3.7 - my * 0.35, 12.4 * this.fit);
    this.camera.lookAt(0, 0.55, -1.4);
    this.mascot.update({ time, dt, mx, scout: 0, think: 0, hop: 0, pay: 0, party: 0 });

    const n = this.buyers.length;
    const period = Math.floor(time / PERIOD);
    const local = time % PERIOD;
    const step = smooth(Math.min(1, local / WALK));
    const paused = local >= WALK;
    const u = paused ? (local - WALK) / (PERIOD - WALK) : 0;
    const lane = this.radius - 2.15;
    /** when, during the pause, the coin for stall k lands */
    const landing = (k: number) => 0.4 + k * 0.035;

    for (const coin of this.coins) coin.visible = false;
    this.buyers.forEach((buyer, j) => {
      const from = ((j + period) % n) - 2; // the slot it leaves this period; it pauses at from + 1
      const slot = from + step;
      const at = from + 1;
      const a = this.angle(slot);
      const x = sin(a) * lane;
      const z = -Math.cos(a) * lane + 0.6;
      const shown = smooth(clamp01((slot + 1.7) / 0.8)) * smooth(clamp01((this.count + 0.7 - slot) / 0.8));
      buyer.group.visible = shown > 0.01;
      if (!buyer.group.visible) return;
      const scale = BUYER_SCALE * shown;
      buyer.group.scale.setScalar(scale);
      buyer.group.position.set(x, GROUND * (1 - scale), z);
      // walks along the arc, turns to the stall while it buys, then turns back
      const turn = paused ? smooth(clamp01(u * 5)) * (1 - smooth(clamp01((u - 0.82) * 6))) : 0;
      buyer.group.rotation.y = Math.PI / 2 - a + (Math.PI / 2) * turn;

      const buying = paused && at >= 0 && at < this.count;
      const paid = buying && u > landing(at);
      const joy = paid ? sin(clamp01((u - landing(at)) / 0.3) * Math.PI) * 0.4 : 0;
      buyer.update(time + j * 0.7, paused ? 0 : 1, joy);
      // one parcel per stall it has bought from so far (the stack stops at three)
      buyer.setParcels(Math.max(0, Math.min(3, at + (paid ? 1 : 0))), paid && at < 3 ? backOut(clamp01((u - landing(at)) / 0.2)) : 1);

      if (buying) {
        const coin = this.coins[at];
        const c = seg(u, 0.1 + at * 0.035, landing(at));
        const stall = this.stalls[at];
        coin.visible = c > 0 && c < 1;
        coin.position.set(x + (stall.x - x) * c, GROUND + 0.9 + (GROUND + 1.0 - (GROUND + 0.9)) * c + sin(c * Math.PI) * 1.5, z + (stall.z - z) * c);
        coin.rotation.set(time * 9, time * 3, Math.PI / 2);
      }
    });

    // stalls give a hop when their coin lands, and when you point at them
    this.stalls.forEach((stall, k) => {
      const sale = paused ? sin(seg(u, landing(k), landing(k) + 0.28) * Math.PI) * 0.22 : 0;
      const pointed = this.hovered === k ? Math.abs(sin(time * 7)) * 0.2 : 0;
      stall.group.position.set(stall.x, GROUND + sale + pointed, stall.z);
    });

    this.renderer.render(this.scene, this.camera);
  }

  private aim(clientX: number, clientY: number): void {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  /** true when the screen point is over the critter */
  pick(clientX: number, clientY: number): boolean {
    this.aim(clientX, clientY);
    return this.raycaster.intersectObject(this.mascot.hitBox).length > 0;
  }

  /** remembers which stall is under the pointer; returns true when the pointer is over something */
  hover(clientX: number, clientY: number): boolean {
    this.aim(clientX, clientY);
    this.hovered = this.stalls.findIndex((stall) => this.raycaster.intersectObject(stall.group, true).length > 0);
    return this.hovered >= 0 || this.raycaster.intersectObject(this.mascot.hitBox).length > 0;
  }

  poke(variant: number): void {
    this.mascot.poke(variant);
  }

  dispose(): void {
    disposeScene(this.scene, this.renderer);
  }
}
