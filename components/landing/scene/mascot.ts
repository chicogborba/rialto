import * as THREE from "three";

/**
 * The agent: a boxy orange critter modelled after the Claude Code mascot — wide block body,
 * tall rectangular eyes (that squint into > < when happy), stub arms and a row of thin legs.
 *
 * Animated procedurally. Scroll decides WHAT he is doing; everything is then eased over time so
 * poses blend instead of snapping, with follow-through (the body leans into turns, legs step when
 * he rotates, and cycle when he walks) and a prop for each job: a magnifier to scout, a clipboard to vet, a coin to pay,
 * confetti when the work ships.
 */

export interface MascotState {
  time: number;
  /** seconds since last frame (large value = snap, used for reduced motion) */
  dt: number;
  /** pointer x in -1..1: he looks at you when idle */
  mx: number;
  /** 0..1 scanning the market */
  scout: number;
  /** 0..1 pondering the candidates */
  think: number;
  /** 0..1 progress of the one-shot decision hop */
  hop: number;
  /** 0..1 paying */
  pay: number;
  /** 0..1 celebrating the delivery */
  party: number;
  /** 0..1 let down: worried brows, slumped (optional) */
  sad?: number;
  /** 0..1 walking on the spot: legs cycle and the body bobs (the scene moves the world past him) */
  walk?: number;
  /** radians added to where he faces, e.g. toward the stall he is buying from */
  turn?: number;
}

const ORANGE = 0xee7a35;
const INK = 0x17120f;
const PAPER = 0xedebe3;
const SIGNAL = 0xc6ff3d;
const BODY = { w: 1.9, h: 1.25, d: 0.85 };
const LEG = { w: 0.17, h: 0.46, d: 0.17 };
const LEG_X = [-0.72, -0.44, 0.44, 0.72];
const FACE = BODY.d / 2 + 0.03;
const CONFETTI = 46;

const shade = (hex: number, k: number) => new THREE.Color(hex).multiplyScalar(k);
const flat = (color: THREE.ColorRepresentation) => new THREE.MeshBasicMaterial({ color });
const box = (w: number, h: number, d: number, color: THREE.ColorRepresentation) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flat(color));
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const backOut = (t: number) => (t <= 0 ? 0 : 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2));
/** frame-rate independent exponential ease toward a target */
const ease = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const rnd = (i: number, n: number) => {
  const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Box with per-face shades: fakes lighting without any lights in the scene. */
function shadedBox(w: number, h: number, d: number, hex: number): THREE.Mesh {
  // face order: +x, -x, +y, -y, +z, -z
  const mats = [0.84, 0.72, 1.1, 0.5, 1, 0.62].map((k) => flat(shade(hex, k)));
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
}

interface Eye {
  open: THREE.Mesh;
  /** slanted brow shown when he is sad */
  brow: THREE.Mesh;
  /** the > or < chevron shown when he is happy */
  squint: THREE.Group;
  side: number;
}

export class Mascot {
  readonly group = new THREE.Group();
  /** current hop height, so labels can follow him */
  height = 0;
  /** invisible box used for click picking; moves with the mascot */
  readonly hitBox = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 1.6), new THREE.MeshBasicMaterial({ visible: false }));

  private readonly body = new THREE.Group();
  private readonly eyes: Eye[] = [];
  private readonly arms: THREE.Group[] = [];
  private readonly legs: THREE.Mesh[] = [];
  private readonly shadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private readonly magnifier = new THREE.Group();
  private readonly clipboard = new THREE.Group();
  private readonly marks: THREE.Mesh[] = [];
  private readonly coin: THREE.Mesh;
  private readonly confetti: THREE.InstancedMesh;
  private readonly m4 = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();
  private readonly v3 = new THREE.Vector3();
  private readonly one = new THREE.Vector3();

  // eased copies of the scroll-driven state + follow-through
  private scout = 0;
  private think = 0;
  private pay = 0;
  private party = 0;
  private sad = 0;
  private walk = 0;
  private yaw = 0;
  private yawVel = 0;
  private lean = 0;
  private pokeActive = false;
  private pokeT = 0;
  private pokeVariant = 0;

  constructor() {
    this.body.add(shadedBox(BODY.w, BODY.h, BODY.d, ORANGE));

    for (const side of [-1, 1]) {
      const open = box(0.17, 0.4, 0.06, INK);
      open.position.set(side * 0.47, 0.13, FACE);
      const squint = new THREE.Group();
      for (const k of [-1, 1]) {
        const bar = box(0.34, 0.09, 0.06, INK);
        bar.rotation.z = k * side * 0.5;
        bar.position.y = k * 0.085;
        squint.add(bar);
      }
      squint.position.set(side * 0.47, 0.13, FACE);
      squint.visible = false;
      const brow = box(0.36, 0.07, 0.06, INK);
      brow.rotation.z = -side * 0.42;
      brow.visible = false;
      this.eyes.push({ open, brow, squint, side });
      this.body.add(open, brow, squint);

      // stub arm, hinged where it meets the body
      const pivot = new THREE.Group();
      pivot.position.set(side * (BODY.w / 2), 0.02, -0.08);
      const arm = shadedBox(0.3, 0.4, 0.5, ORANGE);
      arm.position.x = side * 0.15;
      pivot.add(arm);
      this.arms.push(pivot);
      this.body.add(pivot);
    }

    // two rows of thin legs with a gap in the middle (they stay planted while the body squashes)
    for (const z of [0.3, -0.3]) {
      for (const x of LEG_X) {
        const leg = shadedBox(LEG.w, LEG.h, LEG.d, ORANGE);
        leg.position.set(x, -(BODY.h / 2 + LEG.h / 2) + 0.02, z);
        this.legs.push(leg);
        this.group.add(leg);
      }
    }

    // ---- prop: magnifier (scouting)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 8, 24), flat(INK));
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), new THREE.MeshBasicMaterial({ color: 0x5ce1e6, transparent: true, opacity: 0.35 }));
    const handle = box(0.08, 0.34, 0.08, INK);
    handle.position.set(0.2, -0.36, 0);
    handle.rotation.z = 0.5;
    this.magnifier.add(rim, lens, handle);
    this.body.add(this.magnifier);

    // ---- prop: clipboard with a checklist (vetting)
    const board = box(0.78, 1.0, 0.05, 0x6b4a2f);
    const sheet = box(0.66, 0.84, 0.02, PAPER);
    sheet.position.set(0, -0.03, 0.035);
    const clip = box(0.3, 0.12, 0.07, 0x8c8e84);
    clip.position.set(0, 0.47, 0.03);
    this.clipboard.add(board, sheet, clip);
    for (let i = 0; i < 5; i++) {
      const y = 0.26 - i * 0.15;
      const line = box(0.34, 0.035, 0.01, 0x8c8e84);
      line.position.set(0.1, y, 0.05);
      // tick box: fills in as he works down the list (two fail, the rest pass)
      const mark = box(0.1, 0.1, 0.012, i === 1 || i === 4 ? 0xff3b3b : SIGNAL);
      mark.position.set(-0.22, y, 0.05);
      this.marks.push(mark);
      this.clipboard.add(line, mark);
    }
    this.body.add(this.clipboard);

    // ---- prop: coin (paying)
    this.coin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), [flat(0xd9a400), flat(0xffd23f), flat(0xffd23f)]);
    this.body.add(this.coin);

    // ---- confetti (party)
    this.confetti = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.11, 0.02), new THREE.MeshBasicMaterial(), CONFETTI);
    const palette = [SIGNAL, 0xff5b1f, 0x5ce1e6, PAPER, 0xffd23f];
    const c = new THREE.Color();
    for (let i = 0; i < CONFETTI; i++) this.confetti.setColorAt(i, c.setHex(palette[i % palette.length]));
    this.confetti.frustumCulled = false;
    this.group.add(this.confetti);

    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1.2, 28), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = -(BODY.h / 2 + LEG.h) + 0.03;
    this.group.add(this.body, this.shadow);
    this.hitBox.position.y = -0.1;
    this.group.add(this.hitBox);
  }

  /**
   * React to a click. 0 = hop + spin, 1 = ticklish shake, 2 = squash and pop, 3 = dizzy (after rage-clicking).
   */
  poke(variant: number): void {
    this.pokeActive = true;
    this.pokeT = 0;
    this.pokeVariant = variant;
  }

  update(s: MascotState): void {
    const t = s.time;
    const dt = s.dt;
    const sin = Math.sin;

    // ---- ease into each activity so poses blend
    this.scout = ease(this.scout, s.scout, 7, dt);
    this.think = ease(this.think, s.think, 7, dt);
    this.pay = ease(this.pay, s.pay, 8, dt);
    this.party = ease(this.party, s.party, 6, dt);
    this.sad = ease(this.sad, s.sad ?? 0, 7, dt);
    this.walk = ease(this.walk, s.walk ?? 0, 9, dt);
    const { scout, think, pay, party, sad, walk } = this;
    const busy = Math.max(scout, think, pay, party, sad, walk, s.hop > 0 && s.hop < 1 ? 1 : 0);
    const idle = 1 - busy;

    // ---- hops: one big one on the decision, a string of small ones at the party
    const decision = sin(clamp01(s.hop) * Math.PI) * 1.2;
    const partyHop = Math.abs(sin(t * 6.5)) * 0.55 * party;

    // ---- poke reaction (click): overrides whatever he was doing for a moment
    let pokeP = -1;
    let pokeHop = 0;
    let pokeSpin = 0;
    let pokeShake = 0;
    let pokeSquash = 0;
    if (this.pokeActive) {
      this.pokeT += Math.min(dt, 0.05);
      const dur = this.pokeVariant === 3 ? 2.2 : 1.2;
      if (this.pokeT >= dur) this.pokeActive = false;
      else pokeP = this.pokeT / dur;
    }
    if (pokeP >= 0) {
      const pt = this.pokeT;
      switch (this.pokeVariant) {
        case 0: // eyes shut, hop, full spin
          pokeHop = sin(clamp01(pokeP / 0.7) * Math.PI) * 1.0;
          pokeSpin = clamp01(pokeP / 0.85) ** 2 * (3 - 2 * clamp01(pokeP / 0.85)) * Math.PI * 2;
          break;
        case 1: // ticklish: little bounces and a shiver
          pokeHop = Math.abs(sin(pt * 18)) * 0.28 * (1 - pokeP);
          pokeShake = sin(pt * 46) * 0.3 * (1 - pokeP);
          break;
        case 2: // squash, then pop
          pokeSquash = pokeP < 0.25 ? clamp01(pokeP / 0.25) ** 2 : Math.max(0, 1 - (pokeP - 0.25) * 6);
          pokeHop = pokeP > 0.25 ? sin(clamp01((pokeP - 0.25) / 0.5) * Math.PI) * 1.5 : 0;
          break;
        default: // dizzy: spins, wobbles, never quite lands
          pokeSpin = pokeP * Math.PI * 8;
          pokeShake = sin(pt * 7) * 0.22 * (1 - pokeP);
          pokeHop = Math.abs(sin(pt * 3.5)) * 0.2 * (1 - pokeP);
      }
    }
    const hop = decision + partyHop + pokeHop;
    this.height = hop;
    const landing = Math.max(0, 0.14 - hop) * (s.hop > 0 && s.hop < 1 ? 1 : party);

    // ---- where he is looking: you (idle), the market (scout), the clipboard with glances up (think)
    const glance = think * Math.max(0, sin(t * 0.9)) ** 6; // quick look up at the candidates
    const targetYaw =
      s.mx * 0.5 * idle +
      sin(t * 1.9) * 0.6 * scout +
      (-0.28 + glance * 0.35) * think +
      sin(t * 0.6) * 0.08 * idle +
      (s.turn ?? 0) +
      party * party * (3 - 2 * party) * Math.PI * 2;
    const prevYaw = this.yaw;
    this.yaw = ease(this.yaw, targetYaw, 6, dt);
    this.yawVel = ease(this.yawVel, dt > 0 ? (this.yaw - prevYaw) / Math.max(dt, 1e-3) : 0, 10, dt);
    // follow-through: he banks into turns
    this.lean = ease(this.lean, THREE.MathUtils.clamp(-this.yawVel * 0.12, -0.25, 0.25), 8, dt);

    // ---- body
    const breathe = sin(t * 2.1) * 0.018;
    const sway = sin(t * 1.1) * 0.05 * idle; // weight shifting foot to foot
    const stride = t * 9;
    this.body.position.set(sway, sin(t * 2.1) * 0.035 + Math.abs(sin(stride)) * 0.08 * walk + hop - landing * 0.5 - sad * 0.05, 0);
    this.body.scale.set(
      1 - breathe + landing * 0.7 - hop * 0.04 + pokeSquash * 0.25,
      1 + breathe - landing + hop * 0.08 - pokeSquash * 0.35 - sad * 0.1,
      1 - breathe + landing * 0.7 + pokeSquash * 0.25,
    );
    this.body.rotation.y = this.yaw + pokeSpin;
    this.body.rotation.z = pokeShake + this.lean + sway * 0.6 + sin(t * 1.3) * 0.07 * think + sin(t * 31) * 0.015 * pay + sin(stride) * 0.045 * walk;
    this.body.rotation.x = -0.14 * scout + 0.16 * think * (1 - glance) - 0.2 * pay + 0.13 * sad + sin(t * 2.1) * 0.02;

    // ---- eyes
    const blink = t % 3.4 < 0.13 || (t + 1.7) % 7.3 < 0.11;
    const happy = party > 0.4 || decision > 0.1 || pokeP >= 0;
    for (const eye of this.eyes) {
      const x = eye.side * 0.47 + s.mx * 0.06 * idle + sin(t * 1.9) * 0.06 * scout - 0.07 * think * (1 - glance);
      const y = 0.13 + scout * 0.06 - think * 0.09 * (1 - glance) + glance * 0.05 - sad * 0.05;
      eye.open.visible = !happy;
      eye.squint.visible = happy;
      eye.open.position.set(x, y, FACE);
      eye.squint.position.set(x, y, FACE);
      eye.brow.visible = sad > 0.3 && !happy;
      eye.brow.position.set(x, y + 0.29, FACE);
      // one eye narrows while he reads (a skeptical look); both narrow as he pays
      eye.open.scale.y = blink ? 0.1 : 1 - (eye.side > 0 ? think * 0.4 * (1 - glance) : 0) - pay * 0.25 - sad * 0.28;
    }

    // ---- arms
    const [left, right] = this.arms;
    const up = Math.max(decision > 0.05 ? 1 : 0, party, pokeP >= 0 && this.pokeVariant !== 1 ? 1 : 0);
    const flap = sin(t * 2.1) * 0.08;
    // a little wave hello every so often when he has nothing to do
    const wave = idle * (t % 7 < 1.3 ? sin(((t % 7) / 1.3) * Math.PI) : 0);
    left.rotation.z = flap - up * (0.75 + sin(t * 11) * 0.25) - this.lean * 0.8;
    left.rotation.y = think * 0.9 + sin(t * 8 + 1.5) * 0.15 * pay; // reaches forward to hold the clipboard
    right.rotation.z = -flap + up * (0.75 + sin(t * 11 + 1) * 0.25) + wave * (0.9 + sin(t * 14) * 0.3) - this.lean * 0.8 + scout * 0.5;
    right.rotation.y = -think * (0.8 + sin(t * 17) * 0.12) - scout * 0.7 - sin(t * 8) * 0.5 * pay; // scribbling / holding the glass / tossing

    // ---- prop: magnifier held up to his right eye while scouting
    const mag = backOut(clamp01(scout * 1.4));
    this.magnifier.visible = scout > 0.02;
    this.magnifier.scale.setScalar(Math.max(0.0001, mag));
    this.magnifier.position.set(0.5 + sin(t * 1.9) * 0.05, 0.17 - (1 - mag) * 0.8, FACE + 0.3);
    this.magnifier.rotation.z = sin(t * 1.9) * 0.12;

    // ---- prop: clipboard, pulled up from below; the checklist fills in as he thinks
    const clipIn = backOut(clamp01(think * 1.3));
    this.clipboard.visible = think > 0.02;
    this.clipboard.scale.setScalar(Math.max(0.0001, 0.86 * clipIn));
    this.clipboard.position.set(-0.52, -0.22 - (1 - clipIn) * 1.1 + sin(t * 2.1) * 0.015, FACE + 0.38);
    this.clipboard.rotation.set(-0.5 + glance * 0.25, 0.35, 0.08 + sin(t * 1.3) * 0.03);
    this.marks.forEach((mark, i) => {
      const k = clamp01(s.think * (this.marks.length + 1.5) - i - 0.6);
      mark.scale.setScalar(Math.max(0.0001, backOut(k)));
    });

    // ---- prop: coin flipping above his right arm before he pays
    const coinIn = backOut(clamp01(pay * 1.5));
    this.coin.visible = pay > 0.02;
    this.coin.scale.setScalar(Math.max(0.0001, coinIn));
    this.coin.position.set(1.15, 0.45 + Math.abs(sin(t * 5)) * 0.6, 0.15);
    this.coin.rotation.set(t * 11, 0, Math.PI / 2);

    // ---- legs: shuffle, step when turning, tap while thinking, kick at the party, tuck mid-air
    const baseY = -(BODY.h / 2 + LEG.h / 2) + 0.02;
    const stepping = Math.min(1, Math.abs(this.yawVel) * 0.5);
    this.legs.forEach((leg, i) => {
      const shuffle = Math.max(0, sin(t * 3.2 + i * 1.3)) * 0.035 * idle;
      const step = Math.max(0, sin(t * 14 + (i % 2) * Math.PI)) * 0.12 * stepping;
      const tap = i === 3 ? Math.max(0, sin(t * 10)) * 0.15 * think : 0;
      const kick = party * Math.max(0, sin(t * 13 + i)) * 0.08;
      const pace = Math.max(0, sin(stride * 2 + (i % 2) * Math.PI + (i > 3 ? 1.2 : 0))) * 0.17 * walk;
      leg.position.y = baseY + shuffle + step + tap + kick + pace + hop * 0.92;
      leg.position.x = LEG_X[i % 4] + sway * 0.25;
      leg.scale.y = 1 - Math.min(0.35, hop * 0.4);
    });

    // ---- confetti raining while he celebrates
    this.confetti.visible = party > 0.02;
    if (this.confetti.visible) {
      for (let i = 0; i < CONFETTI; i++) {
        const fall = (t * (0.35 + rnd(i, 1) * 0.4) + rnd(i, 2)) % 1;
        this.v3.set((rnd(i, 3) - 0.5) * 5 + sin(t * 2 + i) * 0.2, 3.6 - fall * 4.6, (rnd(i, 4) - 0.5) * 3);
        this.quat.setFromEuler(this.euler.set(t * (2 + rnd(i, 5) * 4), t * (1 + rnd(i, 6) * 3), i));
        this.m4.compose(this.v3, this.quat, this.one.setScalar(party * (0.7 + rnd(i, 7) * 0.8)));
        this.confetti.setMatrixAt(i, this.m4);
      }
      this.confetti.instanceMatrix.needsUpdate = true;
    }

    this.shadow.scale.setScalar(1 - Math.min(0.5, hop * 0.35));
    this.shadow.material.opacity = 0.45 - Math.min(0.3, hop * 0.2);
    this.shadow.position.x = sway;
  }
}
