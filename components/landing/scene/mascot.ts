import * as THREE from "three";

/**
 * The agent: an original boxy orange critter (not an official mascot asset), built from a dozen
 * boxes and animated entirely procedurally — blink, breathe, look around, tap a foot while thinking,
 * hop on the decision, toss the payment, party when the job ships.
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

const ORANGE = 0xd97757;
const shade = (hex: number, k: number) => new THREE.Color(hex).multiplyScalar(k);
const flat = (color: THREE.ColorRepresentation) => new THREE.MeshBasicMaterial({ color });

/** Box with per-face shades: fakes lighting without any lights in the scene. */
function shadedBox(w: number, h: number, d: number, hex: number): THREE.Mesh {
  // face order: +x, -x, +y, -y, +z, -z
  const mats = [0.82, 0.7, 1.12, 0.5, 1, 0.6].map((k) => flat(shade(hex, k)));
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
}

export class Mascot {
  readonly group = new THREE.Group();
  /** current hop height, so labels can follow him */
  height = 0;

  private readonly body = new THREE.Group();
  private readonly eyes: THREE.Mesh[] = [];
  private readonly mouth: THREE.Mesh;
  private readonly arms: THREE.Group[] = [];
  private readonly legs: THREE.Mesh[] = [];
  private readonly antenna = new THREE.Group();
  private readonly bulb: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  private readonly shadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;

  constructor() {
    this.body.add(shadedBox(1.7, 1.15, 1.2, ORANGE));

    // face
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.36, 0.06), flat(0x1a120e));
      eye.position.set(s * 0.38, 0.1, 0.61);
      this.eyes.push(eye);
      this.body.add(eye);
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.04), flat(0xf2a08a));
      cheek.position.set(s * 0.62, -0.18, 0.61);
      this.body.add(cheek);
    }
    this.mouth = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.05), flat(0x1a120e));
    this.mouth.position.set(0, -0.22, 0.61);
    this.body.add(this.mouth);

    // arms: pivot at the shoulder so they swing
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.87, 0.05, 0);
      const arm = shadedBox(0.5, 0.22, 0.24, ORANGE);
      arm.position.x = s * 0.25;
      pivot.add(arm);
      this.arms.push(pivot);
      this.body.add(pivot);
    }

    // antenna with a lime bulb
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.06), flat(0x2a1a14));
    stalk.position.y = 0.21;
    this.bulb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), flat(0xc6ff3d));
    this.bulb.position.y = 0.5;
    this.antenna.add(stalk, this.bulb);
    this.antenna.position.set(0.35, 0.57, 0);
    this.body.add(this.antenna);

    // four stubby legs (they stay on the ground while the body squashes)
    for (const [x, z] of [[-0.55, 0.36], [0.55, 0.36], [-0.55, -0.36], [0.55, -0.36]] as const) {
      const leg = shadedBox(0.26, 0.4, 0.26, 0xb85f42);
      leg.position.set(x, -0.74, z);
      this.legs.push(leg);
      this.group.add(leg);
    }

    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 28), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = -0.93;
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
    const squash = Math.max(0, 0.12 - hop) * (s.hop > 0 || s.party > 0 ? 1 : 0); // a little squash at take-off / landing

    // ---- body
    const breathe = sin(t * 2.1) * 0.018;
    this.body.position.y = sin(t * 2.1) * 0.04 + hop;
    this.body.scale.set(1 - breathe + squash * 0.6 - hop * 0.04, 1 + breathe - squash + hop * 0.08, 1 - breathe + squash * 0.6);
    const lookAround = sin(t * 2.3) * 0.55 * s.scout;
    const spin = s.party * s.party * (3 - 2 * s.party) * Math.PI * 2;
    this.body.rotation.y = s.mx * 0.45 * (1 - s.scout) + lookAround + spin;
    this.body.rotation.z = sin(t * 1.4) * 0.16 * s.think + sin(t * 31) * 0.02 * s.pay;
    this.body.rotation.x = -0.12 * s.scout - 0.22 * s.pay + sin(t * 2.1) * 0.02;

    // ---- face
    const blink = t % 3.4 < 0.13 || (t + 1.7) % 7.3 < 0.11;
    const happy = Math.max(s.party, decision > 0.1 ? 1 : 0);
    for (const eye of this.eyes) {
      eye.scale.y = blink ? 0.12 : happy > 0.5 ? 0.45 : 1 + s.think * 0.15;
      eye.position.x = Math.sign(eye.position.x) * 0.38 + s.mx * 0.05 * (1 - s.scout) + sin(t * 2.3) * 0.05 * s.scout;
      eye.position.y = 0.1 + s.scout * 0.06 + (happy > 0.5 ? 0.05 : 0);
    }
    this.mouth.scale.set(1 + happy * 1.6 - s.think * 0.5, 1 + happy * 1.4 + s.think * 1.2, 1);

    // ---- arms: wave hello, scratch the chin, throw both up, toss the money
    const [left, right] = this.arms;
    const up = Math.max(decision > 0.05 ? 1 : 0, s.party);
    left.rotation.z = -0.25 + sin(t * 2.1) * 0.06 - up * (1.1 + sin(t * 11) * 0.25);
    right.rotation.z = 0.25 - sin(t * 2.1) * 0.06 + up * (1.1 + sin(t * 11 + 1) * 0.25) + s.think * 0.9;
    right.rotation.y = -sin(t * 8) * 0.7 * s.pay;
    left.rotation.y = 0;

    // ---- antenna: springy, bulb pulses with what he is doing
    this.antenna.rotation.z = sin(t * 3.1) * 0.18 - lookAround * 0.4 + party * 0.5;
    const pulse = 0.75 + 0.25 * sin(t * (4 + s.think * 6 + s.pay * 10));
    this.bulb.material.color.setHex(s.pay > 0.5 ? 0xff5b1f : 0xc6ff3d).multiplyScalar(pulse);
    this.bulb.scale.setScalar(1 + (1 - pulse) * 0.5);

    // ---- legs: idle shuffle, impatient tapping while thinking, tucked in mid-air
    this.legs.forEach((leg, i) => {
      const shuffle = Math.max(0, sin(t * 3.2 + i * 1.6)) * 0.035;
      const tap = i === 1 ? Math.max(0, sin(t * 10)) * 0.14 * s.think : 0;
      leg.position.y = -0.74 + shuffle + tap + hop * 0.92;
      leg.scale.y = 1 - Math.min(0.35, hop * 0.4);
    });

    this.shadow.scale.setScalar(1 - Math.min(0.5, hop * 0.35));
    this.shadow.material.opacity = 0.45 - Math.min(0.3, hop * 0.2);
  }
}
