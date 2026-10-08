import * as THREE from "three";
import { backOut, blobShadow, buildCloud, buildCoin, buildParcel, buildStall, buildTree, clamp01, disposeScene, faceted, GROUND, rnd, seg, smooth, softDisc } from "./lowpoly";
import { Mascot } from "./mascot";
import { NEEDS, WALK_SECONDS } from "./needs";

/**
 * The hero, and the whole product in one loop: the critter walks to a market stall, tosses a coin,
 * gets his parcel and walks on to the next one. The stalls are far apart, so there is only ever one
 * on screen, among a few trees and drifting clouds.
 *
 * He walks on the spot and the world slides past him. Each stall sells what the headline is asking
 * for at that moment; he still watches the pointer and can be poked.
 */

/** where a stall stands while he buys from it; he stands at x = 0 */
const STALL = { x: 2.75, z: -0.55, turn: -0.3, scale: 0.95 };
/** how far the world slides between two stalls: more than the widest screen shows */
const GAP = 18;
/** the trees repeat every two stalls, further apart than the camera sees at their depth */
const RING = GAP * 2;
const T16 = Math.tan(THREE.MathUtils.degToRad(16));

/**
 * x, z, scale, colour: all behind the path he walks. The ring comes to rest in two positions (it is
 * two stalls long), and in neither does a tree stand behind the stall or its name board.
 */
const TREES: [number, number, number, number][] = [
  [-3.4, -4.2, 1.25, 0x7fc96b],
  [-0.4, -9.4, 1.45, 0x6dbb86],
  [-8.6, -6.8, 1.5, 0x7fc96b],
  [-6.2, -10, 1.35, 0x6dbb86],
  [9.6, -6.4, 1.6, 0x6dbb86],
  [12.4, -4.6, 1.2, 0x7fc96b],
  [15.8, -8.6, 1.7, 0x7fc96b],
  [17.6, -5, 1.3, 0x6dbb86],
];
/** tufts of grass along the path: small things passing close by are what make the walk read as walking */
const TUFTS = 14;
/** x, z, scale: the height is set every frame so they sit along the top of the canvas */
const CLOUDS: [number, number, number][] = [
  [-14, -16, 1.4],
  [-3, -20, 1.8],
  [10, -17, 1.5],
];

const wrap = (x: number, span: number) => ((((x + span / 2) % span) + span) % span) - span / 2;
/** a point on a hop from `a` to `b`, `lift` high in the middle */
const arc = (out: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, k: number, lift: number) => out.lerpVectors(a, b, k).setY(a.y + (b.y - a.y) * k + Math.sin(k * Math.PI) * lift);

export class HeroScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 140);
  private readonly mascot = new Mascot();
  private readonly stalls: { group: THREE.Group; shadow: THREE.Mesh }[] = [];
  private readonly parcels: THREE.Group[] = [];
  private readonly coin = buildCoin();
  private readonly drift: { object: THREE.Object3D; x: number }[] = [];
  private readonly clouds: { group: THREE.Group; x: number }[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly hand = new THREE.Vector3(1.2, 0.55, 0.2);
  private readonly counter = new THREE.Vector3(STALL.x - 0.25, GROUND + 1.05, STALL.z + 0.25);
  private readonly head = new THREE.Vector3(0, 0.9, 0);
  private readonly at = new THREE.Vector3();
  /** camera distance */
  private fit = 9.6;

  constructor(canvas: HTMLCanvasElement, mobile: boolean) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    this.renderer.setClearColor(0x000000, 0);

    // ground with no edge: a patch of sand that fades into the page
    const ground = softDisc(15, "#e2d0a8", 0.4);
    ground.position.set(1.2, GROUND - 0.03, -1.5);
    this.scene.add(ground);

    for (const [x, z, s, hex] of TREES) {
      const tree = buildTree(hex);
      tree.position.set(x, GROUND, z);
      tree.scale.setScalar(s);
      const shadow = blobShadow(1.1 * s, 0.8 * s);
      shadow.position.set(x, GROUND - 0.01, z);
      this.scene.add(tree, shadow);
      this.drift.push({ object: tree, x }, { object: shadow, x });
    }
    for (let i = 0; i < TUFTS; i++) {
      const tuft = faceted(new THREE.ConeGeometry(0.11, 0.3, 4), () => (i % 3 ? 0x8fcf7a : 0x6dbb86));
      const x = (i / TUFTS - 0.5) * RING + rnd(i, 1) * 1.6;
      // either side of the path, never on it
      tuft.position.set(x, GROUND + 0.14, i % 2 ? 1.5 + rnd(i, 2) * 1.6 : -1.6 - rnd(i, 3) * 1.4);
      tuft.scale.setScalar(0.8 + rnd(i, 4) * 0.7);
      this.scene.add(tuft);
      this.drift.push({ object: tuft, x });
    }
    for (const [x, z, s] of CLOUDS) {
      const group = buildCloud();
      group.position.set(x, 6, z);
      group.scale.setScalar(s);
      this.clouds.push({ group, x });
      this.scene.add(group);
    }

    for (const need of NEEDS) {
      const group = buildStall(need.color, need.sign);
      group.position.set(STALL.x, GROUND, STALL.z);
      group.rotation.y = STALL.turn;
      group.scale.setScalar(STALL.scale);
      const shadow = blobShadow(1.5, 1.0, 0.2);
      shadow.position.set(STALL.x, GROUND - 0.005, STALL.z + 0.1);
      group.visible = shadow.visible = false;
      this.stalls.push({ group, shadow });
      const parcel = buildParcel(need.color);
      parcel.visible = false;
      this.parcels.push(parcel);
      this.scene.add(group, shadow, parcel);
    }
    this.coin.visible = false;
    this.scene.add(this.coin, this.mascot.group);
  }

  /**
   * `wide` is the desktop layout, where the canvas fills the hero and the headline owns its left
   * side: the critter and his stall are then framed in the right-hand part of the width.
   */
  resize(w: number, h: number, wide = false): void {
    const width = Math.max(1, w);
    const height = Math.max(1, h);
    this.camera.aspect = width / height;
    // what must stay in frame, in world units: his left arm to the stall's far edge
    const left = -1.25;
    const right = STALL.x + 1.1;
    const [from, to] = wide ? [0.6, 0.975] : [0.05, 0.97];
    // pull back until that span fits its share of the width
    this.fit = Math.max(9.6, (right - left) / (2 * (to - from)) / (T16 * this.camera.aspect));
    const half = this.fit * T16 * this.camera.aspect;
    const shift = (from + to) / 2 - (left + right) / 2 / (2 * half) - 0.5;
    this.camera.setViewOffset(width, height, -shift * width, 0, width, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  /**
   * `step` counts the stalls he has left behind (it picks the one he is at or heading for) and `q`
   * is the seconds since he set off for it.
   */
  render(time: number, dt: number, mx: number, my: number, step = 0, q = 99): void {
    const k = this.fit / 9.6;
    this.camera.position.set(mx * 0.6, (1.5 - my * 0.25) * k, this.fit);
    this.camera.lookAt(0, 0.3, 0);

    // ---- the walk: the world slides left under him
    const p = smooth(seg(q, 0, WALK_SECONDS));
    const walk = q < WALK_SECONDS ? Math.min(1, q / 0.12, (WALK_SECONDS - q) / 0.3) : 0;
    const slid = (step + p) * GAP;
    for (const { object, x } of this.drift) object.position.x = wrap(x - slid, RING);
    const here = step % NEEDS.length;
    const before = (step + NEEDS.length - 1) % NEEDS.length;
    this.stalls.forEach(({ group, shadow }, i) => {
      const x = i === here ? STALL.x + GAP * (1 - p) : STALL.x - GAP * p;
      group.visible = shadow.visible = i === here || (i === before && step > 0 && p < 1);
      group.position.x = shadow.position.x = x;
    });

    // ---- the purchase: flip a coin, toss it over, the parcel comes back, a happy hop
    const b = q - WALK_SECONDS;
    const toss = seg(b, 0.65, 1.1);
    const back = seg(b, 1.2, 1.7);
    const hop = b > 1.7 && b < 2.35 ? seg(b, 1.7, 2.35) * 0.999 : 0;
    this.mascot.update({ time, dt, mx, scout: 0, think: 0, hop, pay: b > 0.05 && b < 0.65 ? 1 : 0, party: 0, walk, turn: walk * 0.55 + (b > 0 && b < 1.7 ? 0.32 : 0) });

    this.coin.visible = toss > 0 && toss < 1;
    if (this.coin.visible) {
      this.coin.position.copy(arc(this.at, this.hand, this.counter, toss, 1.1));
      this.coin.rotation.set(time * 14, 0, Math.PI / 2);
    }
    // the stall's sign bumps when the coin lands
    const bump = Math.sin(seg(b, 1.1, 1.4) * Math.PI) * 0.06;
    this.stalls[here].group.scale.set(STALL.scale * (1 + bump), STALL.scale * (1 - bump), STALL.scale * (1 + bump));

    // what he carries: the last parcel while he walks on, then the new one once it lands
    const bob = Math.abs(Math.sin(time * 9)) * 0.08 * walk + this.mascot.height;
    this.parcels.forEach((parcel, i) => {
      let scale = 0;
      if (i === here && back > 0) {
        scale = backOut(clamp01(back * 1.6));
        parcel.position.copy(arc(this.at, this.counter, this.head, smooth(back), 1.3));
        if (back >= 1) parcel.position.y += bob;
        parcel.rotation.set(0, 0.25 + (1 - back) * 4, 0);
      } else if (i === before && step > 0 && b < 0.4) {
        // used up by the time he reaches for the next coin
        scale = 1 - seg(b, 0.1, 0.4);
        parcel.position.copy(this.head).setY(this.head.y + bob);
        parcel.rotation.set(0, 0.25, 0);
      }
      parcel.visible = scale > 0.001;
      parcel.scale.setScalar(Math.max(0.0001, scale));
    });

    // clouds drift along the top of the frame, wherever that is for this canvas
    const up = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2) - Math.atan2(this.camera.position.y - 0.3, this.camera.position.z));
    this.clouds.forEach(({ group, x }, i) => {
      group.position.x = wrap(x + time * (0.22 + i * 0.05) - slid * 0.25, 60);
      group.position.y = this.camera.position.y + (this.camera.position.z - group.position.z) * up - group.scale.y * (1.5 + (i % 2) * 0.9);
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

  /** same as `pick`: the critter is the only thing here to poke */
  hover(clientX: number, clientY: number): boolean {
    return this.pick(clientX, clientY);
  }

  poke(variant: number): void {
    this.mascot.poke(variant);
  }

  dispose(): void {
    disposeScene(this.scene, this.renderer);
  }
}
