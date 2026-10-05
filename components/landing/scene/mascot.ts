import * as THREE from "three";

/**
 * The agent: a boxy orange critter modelled after the Claude Code mascot — wide block body,
 * tall rectangular eyes (that squint into > < when happy), stub arms and a row of thin legs.
 * Built from boxes and animated entirely procedurally: blink, breathe, look around, tap a foot
 * while thinking, hop on the decision, lean in to pay, party when the job ships.
 */

export interface MascotState {
  time: number;
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
}

const ORANGE = 0xee7a35;
const INK = 0x17120f;
const BODY = { w: 1.9, h: 1.25, d: 0.85 };
const LEG = { w: 0.17, h: 0.46, d: 0.17 };
const LEG_X = [-0.72, -0.44, 0.44, 0.72];

const shade = (hex: number, k: number) => new THREE.Color(hex).multiplyScalar(k);
const flat = (color: THREE.ColorRepresentation) => new THREE.MeshBasicMaterial({ color });

/** Box with per-face shades: fakes lighting without any lights in the scene. */
function shadedBox(w: number, h: number, d: number, hex: number): THREE.Mesh {
  // face order: +x, -x, +y, -y, +z, -z
  const mats = [0.84, 0.72, 1.1, 0.5, 1, 0.62].map((k) => flat(shade(hex, k)));
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
}

interface Eye {
  open: THREE.Mesh;
  /** the > or < chevron shown when he is happy */
  squint: THREE.Group;
  side: number;
}

export class Mascot {
  readonly group = new THREE.Group();
  /** current hop height, so labels can follow him */
  height = 0;

  private readonly body = new THREE.Group();
  private readonly eyes: Eye[] = [];
  private readonly arms: THREE.Group[] = [];
  private readonly legs: THREE.Mesh[] = [];
  private readonly shadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;

  constructor() {
    this.body.add(shadedBox(BODY.w, BODY.h, BODY.d, ORANGE));
    const face = BODY.d / 2 + 0.03;

    for (const side of [-1, 1]) {
      // open eye: a tall black rectangle
      const open = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.4, 0.06), flat(INK));
      open.position.set(side * 0.47, 0.13, face);
      // happy eye: a chevron pointing at the nose ( > on his right, < on his left )
      const squint = new THREE.Group();
      for (const k of [-1, 1]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.06), flat(INK));
        bar.rotation.z = k * side * 0.5;
        bar.position.y = k * 0.085;
        squint.add(bar);
      }
      squint.position.set(side * 0.47, 0.13, face);
      squint.visible = false;
      this.eyes.push({ open, squint, side });
      this.body.add(open, squint);

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

    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1.2, 28), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = -(BODY.h / 2 + LEG.h) + 0.03;
    this.group.add(this.body, this.shadow);
  }

  update(s: MascotState): void {
    const t = s.time;
    const sin = Math.sin;

    // ---- hops: one big one on the decision, a string of small ones at the party
    const decision = sin(Math.min(1, Math.max(0, s.hop)) * Math.PI) * 1.2;
    const party = Math.abs(sin(t * 6.5)) * 0.55 * s.party;
    const hop = decision + party;
    this.height = hop;
    const squash = Math.max(0, 0.12 - hop) * (s.hop > 0 || s.party > 0 ? 1 : 0);

    // ---- body
    const breathe = sin(t * 2.1) * 0.018;
    this.body.position.y = sin(t * 2.1) * 0.035 + hop;
    this.body.scale.set(1 - breathe + squash * 0.6 - hop * 0.04, 1 + breathe - squash + hop * 0.08, 1 - breathe + squash * 0.6);
    const lookAround = sin(t * 2.3) * 0.55 * s.scout;
    const spin = s.party * s.party * (3 - 2 * s.party) * Math.PI * 2;
    this.body.rotation.y = s.mx * 0.45 * (1 - s.scout) + lookAround + spin;
    this.body.rotation.z = sin(t * 1.4) * 0.16 * s.think + sin(t * 31) * 0.02 * s.pay;
    this.body.rotation.x = -0.12 * s.scout - 0.2 * s.pay + sin(t * 2.1) * 0.02;

    // ---- eyes: blink, glance around, squint into > < when he is pleased
    const blink = t % 3.4 < 0.13 || (t + 1.7) % 7.3 < 0.11;
    const happy = s.party > 0.4 || decision > 0.1;
    for (const eye of this.eyes) {
      const x = eye.side * 0.47 + s.mx * 0.06 * (1 - s.scout) + sin(t * 2.3) * 0.06 * s.scout;
      const y = 0.13 + s.scout * 0.06 - s.think * 0.03;
      eye.open.visible = !happy;
      eye.squint.visible = happy;
      eye.open.position.set(x, y, eye.open.position.z);
      eye.squint.position.set(x, y, eye.squint.position.z);
      // while thinking, one eye narrows (a skeptical look)
      eye.open.scale.y = blink ? 0.1 : 1 - (eye.side > 0 ? s.think * 0.45 : 0) - s.pay * 0.25;
    }

    // ---- stub arms: flap gently, shoot up on a win, the right one jabs when paying
    const [left, right] = this.arms;
    const up = Math.max(decision > 0.05 ? 1 : 0, s.party);
    const flap = sin(t * 2.1) * 0.08;
    left.rotation.z = flap - up * (0.75 + sin(t * 11) * 0.25);
    right.rotation.z = -flap + up * (0.75 + sin(t * 11 + 1) * 0.25) + s.think * 0.45;
    right.rotation.y = -sin(t * 8) * 0.5 * s.pay;
    left.rotation.y = sin(t * 8 + 1.5) * 0.2 * s.pay;

    // ---- legs: idle shuffle, impatient tapping while thinking, tucked in mid-air
    const baseY = -(BODY.h / 2 + LEG.h / 2) + 0.02;
    this.legs.forEach((leg, i) => {
      const shuffle = Math.max(0, sin(t * 3.2 + i * 1.3)) * 0.035;
      const tap = i === 3 ? Math.max(0, sin(t * 10)) * 0.15 * s.think : 0;
      const kick = s.party * Math.max(0, sin(t * 13 + i)) * 0.08;
      leg.position.y = baseY + shuffle + tap + kick + hop * 0.92;
      leg.scale.y = 1 - Math.min(0.35, hop * 0.4);
    });

    this.shadow.scale.setScalar(1 - Math.min(0.5, hop * 0.35));
    this.shadow.material.opacity = 0.45 - Math.min(0.3, hop * 0.2);
  }
}
