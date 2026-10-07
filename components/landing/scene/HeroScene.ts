import * as THREE from "three";
import { backOut, blobShadow, buildCloud, buildCoin, buildParcel, buildStall, buildTree, clamp01, disposeScene, GROUND, MiniCritter, seg, shadedBox, smooth, softDisc, textTexture } from "./lowpoly";
import { Mascot } from "./mascot";

/**
 * The hero: the market at work, framed like a shot from the pitch video.
 *
 * In front, the orange agent runs the errand the headline names: he scans the stalls, the right
 * one lights up, his coin flies over and the parcel flies back. Behind him the other agents file
 * from stall to stall doing the same, under the Rialto sign, bunting, trees and drifting clouds.
 *
 * The crowd is a function of time alone: the queue moves one stall at a time (walk, then pause to
 * buy), so the agents can never run into each other.
 */

/** one stall per headline need, in the same order as NEEDS in HeroMarket */
const STALLS = [
  { label: "SPRITES", color: 0x5ce1e6, price: "$0.005" },
  { label: "VOICE", color: 0xffd23f, price: "$0.002" },
  { label: "3D", color: 0x9945ff, price: "$0.030" },
  { label: "DATA", color: 0xff8fb3, price: "$0.001" },
  { label: "TRANSLATE", color: 0x14f195, price: "$0.004" },
];
const BUYER_COLORS = [0x5ce1e6, 0xff8fb3, 0xffd23f, 0x14f195, 0xb98cff, 0xfffaf0];
const FLAG_COLORS = [0xc6ff3d, 0x5ce1e6, 0xffd23f, 0xff8fb3, 0x9945ff, 0xfffaf0];
/** seconds per move of the crowd: walk to the next stall, then stand and buy */
const PERIOD = 2.5;
const WALK = 1.4;
const BUYER_SCALE = 0.5;
const STALL_SCALE = 1.1;
/** where the orange agent stands */
const HOME_Z = 3.1;
/** the errand, in seconds since the headline changed (see ERRAND_SECONDS in HeroMarket) */
const T = { scout: [0.15, 1.0], pick: 0.6, pay: [1.0, 1.55], coin: [1.45, 1.95], parcel: [2.05, 2.55], hop: [2.55, 3.15], drop: 0.25 } as const;

interface Stall {
  group: THREE.Group;
  board: THREE.MeshBasicMaterial;
  tag: THREE.Sprite;
  x: number;
  z: number;
}

export class HeroScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
  private readonly mascot = new Mascot();
  private readonly stalls: Stall[] = [];
  private readonly buyers: { critter: MiniCritter; shadow: THREE.Mesh }[] = [];
  private readonly coins: THREE.Mesh[] = [];
  private readonly clouds: THREE.Group[] = [];
  private readonly flags: THREE.Mesh[] = [];
  private readonly errandCoin = buildCoin();
  private readonly errandParcel = buildParcel();
  private readonly marker = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly radius: number;
  private readonly spread: number;
  private hovered = -1;
  private fit = 1;

  constructor(canvas: HTMLCanvasElement, mobile: boolean) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    this.renderer.setClearColor(0x000000, 0);
    this.radius = mobile ? 4.7 : 5.2;
    this.spread = ((mobile ? 52 : 50) * Math.PI) / 180;
    const back = -this.radius - 0.5;

    // ground with no edge: a patch of sand that fades into the page, and the pad the agent stands on
    const ground = softDisc(15, "#e2d0a8", 0.42);
    ground.position.set(0, GROUND - 0.03, -0.5);
    const pad = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.66, 48), new THREE.MeshBasicMaterial({ color: 0xc6ff3d }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, GROUND, HOME_Z);
    this.scene.add(ground, pad);

    STALLS.forEach((def, i) => {
      const a = this.angle(i);
      const group = buildStall(def.color, def.label);
      group.scale.setScalar(STALL_SCALE);
      const x = Math.sin(a) * this.radius;
      const z = -Math.cos(a) * this.radius + 0.6;
      group.rotation.y = -a;
      const shadow = blobShadow(1.7, 1.2);
      shadow.position.set(x, GROUND - 0.01, z + 0.1);
      // the price that pops out of the stall when the agent pays it
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(def.price, "#17120f", "#c6ff3d", 320, 128), transparent: true, depthTest: false }));
      tag.scale.set(1.5, 0.6, 1);
      tag.visible = false;
      tag.renderOrder = 5;
      this.stalls.push({ group, board: (group.userData.board as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>).material, tag, x, z });
      this.coins.push(buildCoin());
      this.scene.add(shadow, group, tag, this.coins[i]);
    });

    // the Rialto sign behind the market
    const sign = new THREE.Group();
    const board = shadedBox(4.6, 1.36, 0.16, 0xc6ff3d);
    board.position.y = 5.05;
    const name = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.3), new THREE.MeshBasicMaterial({ map: textTexture("RIALTO", "#17120f", "#c6ff3d") }));
    name.position.set(0, 5.05, 0.09);
    sign.add(board, name);
    for (const x of [-1.8, 1.8]) {
      const post = shadedBox(0.14, 4.5, 0.14, 0x8d6540);
      post.position.set(x, 2.25, -0.02);
      sign.add(post);
    }
    sign.position.set(0, GROUND, back);
    this.scene.add(sign);

    // bunting from the sign out to a pole on each side
    for (const side of [-1, 1]) {
      const pole = shadedBox(0.14, 4.4, 0.14, 0x8d6540);
      const foot = new THREE.Vector3(side * (this.radius + 0.6), GROUND, -3.7);
      pole.position.set(foot.x, GROUND + 2.2, foot.z);
      const shadow = blobShadow(0.5, 0.4);
      shadow.position.set(foot.x, GROUND - 0.01, foot.z);
      this.scene.add(pole, shadow);
      this.string(new THREE.Vector3(side * 2.3, GROUND + 5.6, back), new THREE.Vector3(foot.x, GROUND + 4.3, foot.z), 11, side < 0 ? 0 : 3);
    }

    // trees and clouds, as in the video
    const trees: [number, number, number, number][] = [
      [-6.4, -9.8, 1.35, 0x7fc96b],
      [-3.4, -11.5, 1.1, 0x6dbb86],
      [5.2, -10.2, 1.3, 0x7fc96b],
      [8.8, -7.4, 1.6, 0x6dbb86],
      [11.6, -3.4, 1.25, 0x7fc96b],
    ];
    for (const [x, z, s, hex] of trees) {
      const tree = buildTree(hex);
      tree.position.set(x, GROUND, z);
      tree.scale.setScalar(s);
      const shadow = blobShadow(1.1 * s, 0.8 * s);
      shadow.position.set(x, GROUND - 0.01, z);
      this.scene.add(tree, shadow);
    }
    const clouds: [number, number, number, number][] = [
      [-15, 6, -16, 1.4],
      [-5, 6, -20, 1.8],
      [8, 6, -17, 1.5],
      [19, 6, -22, 2],
    ];
    for (const [x, y, z, s] of clouds) {
      const cloud = buildCloud();
      cloud.position.set(x, y, z);
      cloud.scale.setScalar(s);
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }

    this.mascot.group.position.set(0, 0, HOME_Z);
    this.scene.add(this.mascot.group);

    // enough agents to fill the arc plus the ones walking in and out
    for (let j = 0; j < STALLS.length + 4; j++) {
      const critter = new MiniCritter([BUYER_COLORS[j % BUYER_COLORS.length]], 3);
      const shadow = blobShadow(0.75, 0.42, 0.2);
      this.buyers.push({ critter, shadow });
      this.scene.add(critter.group, shadow);
    }

    // the errand: the agent's own coin and parcel, and the arrow over the stall he picked
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.4, 4), new THREE.MeshBasicMaterial({ color: 0x17120f }));
    arrow.rotation.x = Math.PI;
    this.marker.add(arrow);
    this.errandCoin.scale.setScalar(1.25);
    this.scene.add(this.marker, this.errandCoin, this.errandParcel);
  }

  /** a sagging line of little flags between two points */
  private string(from: THREE.Vector3, to: THREE.Vector3, count: number, offset: number): void {
    const at = (t: number) => new THREE.Vector3().lerpVectors(from, to, t).setY(from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 0.75);
    const points = Array.from({ length: 25 }, (_, i) => at(i / 24));
    this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x17120f })));
    const shape = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.2, 0, 0, 0.2, 0, 0, 0, -0.46, 0]), 3));
    const yaw = Math.atan2(-(to.z - from.z), to.x - from.x);
    for (let i = 0; i < count; i++) {
      const flag = new THREE.Mesh(shape, new THREE.MeshBasicMaterial({ color: FLAG_COLORS[(i + offset) % FLAG_COLORS.length], side: THREE.DoubleSide }));
      flag.position.copy(at((i + 0.5) / count));
      flag.rotation.y = yaw;
      this.flags.push(flag);
      this.scene.add(flag);
    }
  }

  private angle(slot: number): number {
    return -this.spread + (2 * this.spread * slot) / (STALLS.length - 1);
  }

  /** `shift` (0..0.5) moves the market that share of the width to the right, leaving room for the headline. */
  resize(w: number, h: number, shift = 0): void {
    const width = Math.max(1, w);
    const height = Math.max(1, h);
    this.camera.aspect = width / height;
    // pull back until the whole arc fits in the part of the canvas the market has to itself
    this.fit = Math.max(1, 1.26 / ((1 - shift * 2) * this.camera.aspect));
    if (shift > 0) this.camera.setViewOffset(width, height, -shift * width, 0, width, height);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  /** `focus` is the stall the headline names and `q` the seconds since it changed. */
  render(time: number, dt: number, mx: number, my: number, focus = 0, q = 99): void {
    const sin = Math.sin;
    this.camera.position.set(mx * 0.9, 3.5 - my * 0.35, 12.2 * this.fit);
    this.camera.lookAt(0, 0.6, -1.2);

    // ---- the errand
    const target = this.stalls[focus % this.stalls.length];
    const picked = q >= T.pick && q < T.hop[1];
    const coin = seg(q, T.coin[0], T.coin[1]);
    const parcel = seg(q, T.parcel[0], T.parcel[1]);
    this.mascot.update({
      time,
      dt,
      mx,
      scout: q >= T.scout[0] && q < T.scout[1] ? 1 : 0,
      think: 0,
      hop: q > T.hop[0] && q < T.hop[1] ? seg(q, T.hop[0], T.hop[1]) : 0,
      pay: q >= T.pay[0] && q < T.pay[1] ? 1 : 0,
      party: 0,
    });
    const hand = { x: 1.1, y: 0.55, z: HOME_Z };
    const counter = { x: target.x, y: GROUND + 1.25, z: target.z + 0.35 };
    this.errandCoin.visible = coin > 0 && coin < 1;
    this.errandCoin.position.set(hand.x + (counter.x - hand.x) * coin, hand.y + (counter.y - hand.y) * coin + sin(coin * Math.PI) * 2.6, hand.z + (counter.z - hand.z) * coin);
    this.errandCoin.rotation.set(time * 9, time * 3, Math.PI / 2);
    // the parcel flies back and rides on his head until the next errand starts
    const head = { x: 0, y: 0.94 + this.mascot.height, z: HOME_Z };
    const carried = q >= T.parcel[0] ? backOut(clamp01(parcel * 3)) : 1 - clamp01(q / T.drop);
    this.errandParcel.visible = carried > 0.01 && q < 90;
    this.errandParcel.scale.setScalar(Math.max(0.0001, carried * 1.3));
    const fly = q >= T.parcel[0] ? smooth(parcel) : 1;
    this.errandParcel.position.set(counter.x + (head.x - counter.x) * fly, counter.y + (head.y - counter.y) * fly + sin(fly * Math.PI) * 2.4, counter.z + (head.z - counter.z) * fly);
    this.errandParcel.rotation.y = (1 - fly) * 4;

    this.marker.visible = picked;
    if (picked) {
      const drop = backOut(clamp01((q - T.pick) / 0.3)) * (1 - smooth(clamp01((q - T.hop[1] + 0.3) / 0.3)));
      this.marker.position.set(target.x, GROUND + 3.95 + Math.abs(sin(time * 5)) * 0.2, target.z + 0.2);
      this.marker.scale.setScalar(Math.max(0.0001, drop));
      this.marker.rotation.y = time * 2.4;
    }

    // ---- the crowd
    const count = this.stalls.length;
    const n = this.buyers.length;
    const period = Math.floor(time / PERIOD);
    const local = time % PERIOD;
    const step = smooth(Math.min(1, local / WALK));
    const paused = local >= WALK;
    const u = paused ? (local - WALK) / (PERIOD - WALK) : 0;
    const lane = this.radius - 2.3;
    /** when, during the pause, the coin for stall k lands */
    const landing = (k: number) => 0.4 + k * 0.035;

    for (const c of this.coins) c.visible = false;
    this.buyers.forEach(({ critter, shadow }, j) => {
      const from = ((j + period) % n) - 2; // the slot it leaves this period; it pauses at from + 1
      const slot = from + step;
      const at = from + 1;
      const a = this.angle(slot);
      const x = sin(a) * lane;
      const z = -Math.cos(a) * lane + 0.6;
      const shown = smooth(clamp01((slot + 1.7) / 0.8)) * smooth(clamp01((count + 0.7 - slot) / 0.8));
      critter.group.visible = shadow.visible = shown > 0.01;
      if (!critter.group.visible) return;
      const scale = BUYER_SCALE * shown;
      critter.group.scale.setScalar(scale);
      critter.group.position.set(x, GROUND * (1 - scale), z);
      shadow.position.set(x, GROUND - 0.005, z);
      shadow.scale.set(0.75 * shown, 0.42 * shown, 1);
      // walks along the arc, turns to the stall while it buys, then turns back
      const turn = paused ? smooth(clamp01(u * 5)) * (1 - smooth(clamp01((u - 0.82) * 6))) : 0;
      critter.group.rotation.y = Math.PI / 2 - a + (Math.PI / 2) * turn;

      const buying = paused && at >= 0 && at < count;
      const paid = buying && u > landing(at);
      const joy = paid ? sin(clamp01((u - landing(at)) / 0.3) * Math.PI) * 0.4 : 0;
      critter.update(time + j * 0.7, paused ? 0 : 1, joy);
      // one parcel per stall it has bought from so far (the stack stops at three)
      critter.setParcels(Math.max(0, Math.min(3, at + (paid ? 1 : 0))), paid && at < 3 ? backOut(clamp01((u - landing(at)) / 0.2)) : 1);

      if (buying) {
        const c = this.coins[at];
        const k = seg(u, 0.1 + at * 0.035, landing(at));
        const stall = this.stalls[at];
        c.visible = k > 0 && k < 1;
        c.position.set(x + (stall.x - x) * k, GROUND + 0.9 + 0.2 * k + sin(k * Math.PI) * 1.5, z + (stall.z - z) * k);
        c.rotation.set(time * 9, time * 3, Math.PI / 2);
      }
    });

    // ---- stalls hop when a coin lands and when you point at them; the picked one lights up
    this.stalls.forEach((stall, k) => {
      const sale = paused ? sin(seg(u, landing(k), landing(k) + 0.28) * Math.PI) * 0.2 : 0;
      const pointed = this.hovered === k ? Math.abs(sin(time * 7)) * 0.2 : 0;
      const mine = stall === target;
      const paid = mine ? sin(seg(q, T.coin[1], T.coin[1] + 0.4) * Math.PI) * 0.45 : 0;
      stall.group.position.set(stall.x, GROUND + sale + pointed + paid, stall.z);
      stall.board.color.setHex(mine && picked ? 0xc6ff3d : 0xffffff);
      const rise = mine ? seg(q, T.coin[1], T.coin[1] + 1.1) : 0;
      stall.tag.visible = rise > 0 && rise < 1;
      if (stall.tag.visible) {
        const size = backOut(clamp01(rise * 5)) * (1 - smooth(clamp01((rise - 0.75) * 4)));
        stall.tag.position.set(stall.x, GROUND + 2.2 + rise * 1.5, stall.z + 0.9);
        stall.tag.scale.set(1.5 * size, 0.6 * size, 1);
      }
    });

    // clouds drift along the top of the frame, wherever that is for this canvas
    const up = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2) - Math.atan2(this.camera.position.y - 0.6, this.camera.position.z + 1.2));
    this.clouds.forEach((cloud, i) => {
      cloud.position.x = ((cloud.userData.x ??= cloud.position.x) + time * (0.22 + i * 0.05) + 26) % 52 - 26;
      cloud.position.y = this.camera.position.y + (this.camera.position.z - cloud.position.z) * up - cloud.scale.y * (1.5 + (i % 2) * 0.9);
    });
    this.flags.forEach((flag, i) => {
      flag.rotation.x = sin(time * 3.2 + i * 0.9) * 0.3;
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
