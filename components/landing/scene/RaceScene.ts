import * as THREE from "three";
import { checkerTexture, disposeScene, faceted, GROUND, MiniCritter, rnd, shadedBox, textTexture } from "./lowpoly";
import { LAP } from "./race-timing";
import { drawSolanaMark } from "./solana-mark";

/**
 * The Solana race, in the same low-poly world as the rest of the page. Four lanes, in real time:
 * Rialto's orange critter pays over Solana and sprints a lap every 0.6 s, while a card, a bank and
 * a globe (the wire) jog down their lanes in dark tones, on a dimmed stretch of track, and give up
 * short of the line, because at days per lap they never finish. Colour belongs to the winner alone;
 * the logo is the only purple here.
 */

const LANE = 2;
/** lane 0 is nearest the camera */
const laneZ = (k: number) => (1.5 - k) * LANE;
const ORANGE = 0xee7a35;
const LIME = 0xc6ff3d;
const INK = 0x17120f;

function legs(parent: THREE.Group, xs: number[], hex: number): THREE.Mesh[] {
  return xs.map((x) => {
    const leg = shadedBox(0.14, 0.42, 0.14, hex);
    leg.position.set(x, 0.21, 0);
    parent.add(leg);
    return leg;
  });
}
/** pale eyes: the only light thing on the slow ones */
function eyes(parent: THREE.Object3D, y: number, z: number, gap = 0.3): void {
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.24, 0.04), new THREE.MeshBasicMaterial({ color: 0xd9cfba }));
    eye.position.set(side * gap, y, z);
    parent.add(eye);
  }
}

interface Walker {
  group: THREE.Group;
  body: THREE.Object3D;
  legs: THREE.Mesh[];
  /** where the body rests, before the walking bob */
  rest: number;
  pace: number;
  /** track units per second: a jog, hopeless next to Solana */
  speed: number;
  spin?: THREE.Object3D;
}

/** A credit card with legs. */
function buildCard(): Walker {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.add(shadedBox(1.5, 0.95, 0.14, 0x4a4742));
  const stripe = shadedBox(1.52, 0.17, 0.16, 0x25221f);
  stripe.position.y = 0.22;
  const chip = shadedBox(0.26, 0.2, 0.16, 0x7d766a);
  chip.position.set(-0.45, -0.1, 0.01);
  body.add(stripe, chip);
  eyes(body, -0.08, 0.09, 0.22);
  body.position.y = 0.42 + 0.475;
  group.add(body);
  return { group, body, legs: legs(group, [-0.4, 0.4], 0x35322e), rest: body.position.y, pace: 2.2, speed: 0.55 };
}

/** A bank with legs: steps, columns, roof. */
function buildBank(): Walker {
  const group = new THREE.Group();
  const body = new THREE.Group();
  const stone = 0x5a554e;
  const base = shadedBox(1.56, 0.14, 1.0, stone);
  base.position.y = 0.07;
  const hall = shadedBox(1.3, 0.74, 0.62, 0x3b3833);
  hall.position.set(0, 0.5, -0.12);
  const beam = shadedBox(1.6, 0.14, 1.02, stone);
  beam.position.y = 0.94;
  body.add(base, hall, beam);
  for (const x of [-0.6, -0.2, 0.2, 0.6]) {
    const column = shadedBox(0.15, 0.74, 0.15, 0x7d766a);
    column.position.set(x, 0.5, 0.36);
    body.add(column);
  }
  const roof = faceted(new THREE.ConeGeometry(1.12, 0.5, 4), () => stone);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 1.26;
  body.add(roof);
  eyes(body, 0.94, 0.52, 0.3);
  body.position.y = 0.42;
  group.add(body);
  return { group, body, legs: legs(group, [-0.42, 0.42], 0x35322e), rest: body.position.y, pace: 1.6, speed: 0.28 };
}

/** A globe with legs, for the international wire. */
function buildGlobe(): Walker {
  const group = new THREE.Group();
  const body = new THREE.Group();
  const globe = faceted(new THREE.IcosahedronGeometry(0.66, 1), (face) => (rnd(face, 7) > 0.62 ? 0x6a655c : 0x45423d));
  body.add(globe);
  body.position.y = 0.42 + 0.62;
  group.add(body);
  return { group, body, legs: legs(group, [-0.26, 0.26], 0x35322e), rest: body.position.y, pace: 1.9, speed: 0.4, spin: globe };
}

/** The Solana lane's name: the logo mark, then the word, in ink. */
function solanaLabel(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const mark = drawSolanaMark(ctx, 12, 82, 58);
    ctx.fillStyle = "#17120f";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = '900 80px "Arial Black", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText("SOLANA", 12 + mark + 14, 86);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export class RaceScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 90);
  private readonly runner = new MiniCritter([ORANGE]);
  private readonly streaks: THREE.Mesh[] = [];
  private readonly dust: THREE.Mesh[] = [];
  private readonly walkers: Walker[] = [buildCard(), buildBank(), buildGlobe()];
  private readonly banner: THREE.Mesh;
  /** the start and finish lines sit at -half and +half; phones get a shorter track */
  private readonly half: number;
  /** how much ground beside the track the camera keeps in view (the lane names on the left) */
  private readonly margin: number;
  /** camera distance */
  private fit = 14;

  constructor(canvas: HTMLCanvasElement, mobile: boolean) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    this.renderer.setClearColor(0x000000, 0);
    this.half = mobile ? 3.6 : 5.6;
    this.margin = mobile ? 3.3 : 4.6;
    const START = -this.half;
    const FINISH = this.half;
    const LENGTH = this.half * 2 + 3.8;

    // ---- the track: a slab, four lanes, painted names, start line
    const slab = shadedBox(LENGTH, 0.16, LANE * 4 + 0.5, 0xeadcb8);
    slab.position.set(0, GROUND - 0.08, 0);
    // a thin ink edge all round, like the borders of every card on the page
    const edge = shadedBox(LENGTH + 0.34, 0.12, LANE * 4 + 0.84, INK);
    edge.position.set(0, GROUND - 0.16, 0);
    this.scene.add(edge, slab);
    for (let k = 0; k <= 4; k++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(LENGTH - 0.4, 0.02, 0.07), new THREE.MeshBasicMaterial({ color: 0xfffaf0 }));
      line.position.set(0, GROUND + 0.01, laneZ(0) + LANE / 2 - k * LANE);
      this.scene.add(line);
    }
    // the three slow lanes sit in the shade, so the eye goes to the one that moves
    const shade = new THREE.Mesh(new THREE.PlaneGeometry(LENGTH, LANE * 3 + 0.25), new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.16, depthWrite: false }));
    shade.rotation.x = -Math.PI / 2;
    shade.position.set(0, GROUND + 0.006, laneZ(2) - 0.125);
    this.scene.add(shade);
    const startLine = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, LANE * 4), new THREE.MeshBasicMaterial({ color: 0xfffaf0 }));
    startLine.position.set(START + 0.9, GROUND + 0.012, 0);
    this.scene.add(startLine);
    ["SOLANA", "CARD", "BANK", "WIRE"].forEach((name, k) => {
      const paint = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.47), new THREE.MeshBasicMaterial({ map: k === 0 ? solanaLabel() : textTexture(name, "#17120f", null, 512, 160), transparent: true, opacity: k === 0 ? 1 : 0.5, depthWrite: false }));
      paint.rotation.x = -Math.PI / 2;
      paint.position.set(START - 0.75, GROUND + 0.02, laneZ(k));
      this.scene.add(paint);
    });

    // ---- the finish: chequered strip on the ground and a banner over all four lanes
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.5, LANE * 4), new THREE.MeshBasicMaterial({ map: checkerTexture(2, 24) }));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(FINISH, GROUND + 0.015, 0);
    this.scene.add(strip);
    const flag = new THREE.MeshBasicMaterial({ map: checkerTexture(28, 4) });
    const dark = new THREE.MeshBasicMaterial({ color: INK });
    this.banner = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.8, LANE * 4 + 0.7), [flag, flag, dark, dark, dark, dark]);
    this.banner.position.set(FINISH, GROUND + 3.2, 0);
    this.scene.add(this.banner);
    for (const z of [-(LANE * 2 + 0.35), LANE * 2 + 0.35]) {
      const post = shadedBox(0.18, 3.6, 0.18, INK);
      post.position.set(FINISH, GROUND + 1.8, z);
      this.scene.add(post);
    }

    // ---- the winner: the orange critter, with lime speed lines and dust behind it
    this.runner.group.scale.setScalar(0.62);
    this.runner.group.rotation.y = 1.05;
    this.scene.add(this.runner.group);
    [LIME, LIME, LIME].forEach((hex, i) => {
      const streak = shadedBox(1, 0.12, 0.12, hex, 0.8 - i * 0.2);
      streak.geometry.translate(-0.5, 0, 0); // grows backwards from the runner
      streak.position.y = GROUND + 1.25 - i * 0.3;
      this.streaks.push(streak);
      this.scene.add(streak);
    });
    for (let i = 0; i < 6; i++) {
      const puff = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0xcdb98c, transparent: true }));
      this.dust.push(puff);
      this.scene.add(puff);
    }

    // ---- the rest, standing at the start
    this.walkers.forEach((walker, k) => {
      walker.group.position.set(START, GROUND, laneZ(k + 1));
      walker.group.rotation.y = 0.45;
      walker.group.scale.setScalar(0.74);
      this.scene.add(walker.group);
    });
  }

  resize(w: number, h: number): void {
    this.camera.aspect = Math.max(1, w) / Math.max(1, h);
    // far enough back that the whole track, lane names included, fits the width
    this.fit = Math.max(11, (this.half + this.margin) / 0.2867 / this.camera.aspect);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  /** `t` is seconds of racing so far. One lap takes `LAP` seconds. */
  render(t: number): void {
    const sin = Math.sin;
    const START = -this.half;
    const FINISH = this.half;
    this.camera.position.set(-2.6, 0.6 * this.fit, this.fit);
    this.camera.lookAt(-0.95, -0.9, 0);

    // Solana: across the track every LAP seconds, re-entering from the left
    const lap = (t / LAP) % 1;
    const x = START - 2 + lap * (FINISH - START + 3.4);
    this.runner.group.position.set(x, GROUND * (1 - 0.62), laneZ(0));
    this.runner.update(t, 1, 0, 2.2 / LAP);
    this.streaks.forEach((streak, i) => {
      streak.position.x = x - 0.5;
      streak.position.z = laneZ(0) + (i - 1) * 0.05;
      streak.scale.x = 2.2 + sin(t * 30 + i * 2) * 0.5 + i * 0.6;
    });
    this.dust.forEach((puff, i) => {
      const age = (t * 8 + i / this.dust.length) % 1;
      puff.position.set(x - 0.5 - age * 1.6 - i * 0.15, GROUND + 0.1 + age * 0.5, laneZ(0) + (rnd(i, 3) - 0.5) * 0.5);
      puff.scale.setScalar(0.4 + age);
      (puff.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - age);
    });
    // the banner flutters as he goes under it
    const through = Math.max(0, 1 - Math.abs(x - FINISH) / 1.4);
    this.banner.rotation.z = sin(t * 40) * 0.05 * through;

    // the rest: jogging down their lanes. They give up short of the finish and start over
    // (shrink out, pop back in at the start), so they never cross the line.
    const room = FINISH - START - 2.2;
    for (const walker of this.walkers) {
      const run = (t * walker.speed) % room;
      walker.group.position.x = START + run;
      const out = Math.min(1, (room - run) / 0.5);
      const pop = Math.min(1, run / 0.4);
      walker.group.scale.setScalar(0.74 * Math.max(0.0001, Math.min(out, pop)));
      const beat = t * walker.pace;
      walker.legs.forEach((leg, i) => {
        leg.position.y = 0.21 + Math.max(0, sin(beat * Math.PI * 2 + i * Math.PI)) * 0.1;
      });
      walker.body.position.y = walker.rest + Math.abs(sin(beat * Math.PI * 2)) * 0.04;
      if (walker.spin) walker.spin.rotation.y = t * 0.5;
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    disposeScene(this.scene, this.renderer);
  }
}
