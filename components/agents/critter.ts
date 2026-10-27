import * as THREE from "three";
import type { Look } from "@/lib/agent/look";

/**
 * Every agent gets its own critter: the landing's boxy mascot in the look its owner picked (or one
 * rolled from its id), built from boxes in three.js.
 *
 * Flat-shaded like the landing (each box face a different shade, no lights), so a critter drops into
 * any scene and renders the same in a snapshot or a live canvas.
 */

export type { Look } from "@/lib/agent/look";

const SIZES: Record<Look["body"], { w: number; h: number; d: number; leg: number }> = {
  classic: { w: 1.9, h: 1.25, d: 0.85, leg: 0.46 },
  chunky: { w: 2.15, h: 1.15, d: 1.0, leg: 0.36 },
  tall: { w: 1.55, h: 1.6, d: 0.85, leg: 0.5 },
  tiny: { w: 1.5, h: 1.0, d: 0.8, leg: 0.4 },
};

const INK = 0x17120f;
const WHITE = 0xfffdf7;
const GOLD = 0xffc83d;

/** The look in a few words, for the card and for screen readers. */
export function describeLook(look: Look): string {
  const bits = [look.hat !== "none" ? look.hat : null, look.glasses !== "none" ? (look.glasses === "monocle" || look.glasses === "visor" ? look.glasses : `${look.glasses} glasses`) : null, look.extra !== "none" ? look.extra : null].filter(Boolean);
  return `${look.color.name} ${look.body === "classic" ? "" : `${look.body} `}critter${bits.length ? ` with ${bits.join(", ")}` : ""}`;
}

/** CSS colour of the critter, for tinting the card behind it. */
export const cssHex = (hex: number): string => `#${hex.toString(16).padStart(6, "0")}`;

const shade = (hex: number, k: number) => new THREE.Color(hex).multiplyScalar(k);
const flat = (color: THREE.ColorRepresentation) => new THREE.MeshBasicMaterial({ color });
const box = (w: number, h: number, d: number, color: THREE.ColorRepresentation) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flat(color));
function shadedBox(w: number, h: number, d: number, hex: number): THREE.Mesh {
  // face order: +x, -x, +y, -y, +z, -z
  const mats = [0.84, 0.72, 1.1, 0.5, 1, 0.62].map((k) => flat(shade(hex, k)));
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
}
function cyl(rTop: number, rBottom: number, h: number, hex: number, seg = 18): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), [flat(shade(hex, 0.85)), flat(shade(hex, 1.1)), flat(shade(hex, 0.5))]);
}

/** Parts the animation moves. */
export interface Critter {
  group: THREE.Group;
  body: THREE.Group;
  eyes: THREE.Object3D[];
  legs: THREE.Mesh[];
  arms: THREE.Group[];
  spinner: THREE.Object3D | null;
  /** height of the body's centre above the ground */
  rest: number;
}

export function buildCritter(look: Look): Critter {
  const S = SIZES[look.body];
  const c = look.color.hex;
  const group = new THREE.Group();
  const body = new THREE.Group();
  const rest = S.leg + S.h / 2 - 0.02;
  body.position.y = rest;
  group.add(body);
  body.add(shadedBox(S.w, S.h, S.d, c));
  const face = S.d / 2 + 0.03;
  const top = S.h / 2;
  const eyeY = look.body === "tall" ? 0.28 : 0.13;
  const eyeX = Math.min(0.47, S.w * 0.25);

  // ---- eyes
  const eyes: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(side * eyeX, eyeY, face);
    if (look.eyes === "tall") g.add(box(0.17, 0.4, 0.06, INK));
    else if (look.eyes === "round") {
      const e = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 16), flat(INK));
      e.rotation.x = Math.PI / 2;
      g.add(e);
    } else if (look.eyes === "wide") g.add(box(0.36, 0.14, 0.06, INK));
    else if (look.eyes === "sleepy") {
      g.add(box(0.3, 0.16, 0.06, INK));
      const lid = box(0.34, 0.1, 0.07, shade(c, 0.8));
      lid.position.y = 0.09;
      g.add(lid);
    } else {
      const white = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 18), flat(WHITE));
      white.rotation.x = Math.PI / 2;
      const pupil = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 14), flat(INK));
      pupil.rotation.x = Math.PI / 2;
      pupil.position.set(side * 0.04, -0.04, 0.02);
      g.add(white, pupil);
    }
    eyes.push(g);
    body.add(g);
  }

  // ---- arms, hinged where they meet the body
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * (S.w / 2), 0.02, -0.08);
    const arm = shadedBox(0.3, 0.4, 0.5, c);
    arm.position.x = side * 0.15;
    pivot.add(arm);
    arms.push(pivot);
    body.add(pivot);
  }

  // ---- two rows of thin legs
  const legs: THREE.Mesh[] = [];
  const legX = [-0.38, -0.15, 0.15, 0.38].map((k) => k * S.w);
  for (const z of [S.d * 0.35, -S.d * 0.35]) {
    for (const x of legX) {
      const leg = shadedBox(0.17, S.leg, 0.17, c);
      leg.position.set(x, S.leg / 2, z);
      legs.push(leg);
      group.add(leg);
    }
  }

  // ---- glasses
  const gy = eyeY;
  const gz = face + 0.05;
  const accent = look.accent.hex === 0xf6efe0 ? INK : look.accent.hex;
  const lens = (r: number, color: number, opacity = 1) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.03, 18), new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity }));
    m.rotation.x = Math.PI / 2;
    return m;
  };
  const ring = (r: number, color: number) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 6, 20), flat(color));
    return m;
  };
  if (look.glasses === "square" || look.glasses === "shades" || look.glasses === "3D") {
    const frame = look.glasses === "3D" ? WHITE : INK;
    for (const side of [-1, 1]) {
      const rim = box(0.44, 0.36, 0.04, frame);
      rim.position.set(side * eyeX, gy, gz);
      const tint = look.glasses === "shades" ? INK : look.glasses === "3D" ? (side < 0 ? 0xe5533d : 0x26b3a8) : 0xbfe9ff;
      const glass = box(0.36, 0.28, 0.05, tint);
      glass.position.set(side * eyeX, gy, gz + 0.005);
      if (look.glasses === "square") (glass.material as THREE.MeshBasicMaterial).setValues({ transparent: true, opacity: 0.35 });
      body.add(rim, glass);
    }
    const bridge = box(eyeX * 2 - 0.44, 0.06, 0.04, frame);
    bridge.position.set(0, gy + 0.08, gz);
    body.add(bridge);
  } else if (look.glasses === "round") {
    for (const side of [-1, 1]) {
      const r = ring(0.21, accent);
      r.position.set(side * eyeX, gy, gz);
      const l = lens(0.19, 0xbfe9ff, 0.3);
      l.position.set(side * eyeX, gy, gz);
      body.add(r, l);
    }
    const bridge = box(eyeX * 2 - 0.42, 0.05, 0.04, accent);
    bridge.position.set(0, gy + 0.04, gz);
    body.add(bridge);
  } else if (look.glasses === "monocle") {
    const r = ring(0.22, GOLD);
    r.position.set(eyeX, gy, gz);
    const chain = box(0.03, 0.5, 0.03, GOLD);
    chain.position.set(eyeX + 0.2, gy - 0.32, gz);
    chain.rotation.z = 0.25;
    const l = lens(0.2, 0xbfe9ff, 0.3);
    l.position.set(eyeX, gy, gz);
    body.add(r, l, chain);
  } else if (look.glasses === "visor") {
    const v = box(eyeX * 2 + 0.5, 0.26, 0.06, 0xc6ff3d);
    (v.material as THREE.MeshBasicMaterial).setValues({ transparent: true, opacity: 0.75 });
    v.position.set(0, gy, gz);
    const band = box(eyeX * 2 + 0.6, 0.08, 0.05, INK);
    band.position.set(0, gy + 0.16, gz);
    body.add(v, band);
  }

  // ---- extra
  if (look.extra === "blush") {
    for (const side of [-1, 1]) {
      const b = box(0.2, 0.08, 0.04, 0xff7aa2);
      b.position.set(side * (eyeX + 0.12), eyeY - 0.3, face);
      body.add(b);
    }
  } else if (look.extra === "mustache") {
    for (const side of [-1, 1]) {
      const m = box(0.3, 0.09, 0.06, INK);
      m.position.set(side * 0.15, eyeY - 0.32, face + 0.01);
      m.rotation.z = side * 0.25;
      body.add(m);
    }
  } else if (look.extra === "bow tie") {
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.26, 4), flat(accent));
      wing.rotation.z = side * Math.PI / 2;
      wing.position.set(side * 0.13, -top + 0.16, face + 0.02);
      body.add(wing);
    }
    const knot = box(0.1, 0.1, 0.08, shade(accent, 0.8));
    knot.position.set(0, -top + 0.16, face + 0.04);
    body.add(knot);
  } else if (look.extra === "scarf") {
    const s = shadedBox(S.w + 0.06, 0.18, S.d + 0.06, accent);
    s.position.y = -top + 0.2;
    const tail = shadedBox(0.18, 0.42, 0.06, accent);
    tail.position.set(S.w * 0.22, -top + 0.02, face + 0.02);
    tail.rotation.z = 0.12;
    body.add(s, tail);
  } else if (look.extra === "backpack") {
    const p = shadedBox(S.w * 0.6, S.h * 0.7, 0.36, accent);
    p.position.set(0, -0.05, -S.d / 2 - 0.16);
    body.add(p);
  }

  // ---- hat (sits on top of the body)
  let spinner: THREE.Object3D | null = null;
  const hat = new THREE.Group();
  hat.position.y = top;
  body.add(hat);
  const hatC = look.accent.hex;
  if (look.hat === "cap") {
    const crown = shadedBox(S.w * 0.62, 0.3, S.d * 0.8, hatC);
    crown.position.y = 0.15;
    const brim = shadedBox(S.w * 0.5, 0.06, 0.45, shade(hatC, 0.85).getHex());
    brim.position.set(0, 0.04, S.d * 0.4 + 0.2);
    hat.add(crown, brim);
  } else if (look.hat === "top hat") {
    const brim = cyl(0.62, 0.62, 0.06, INK, 20);
    brim.position.y = 0.03;
    const tube = cyl(0.4, 0.4, 0.75, INK, 20);
    tube.position.y = 0.42;
    const band = cyl(0.41, 0.41, 0.12, look.accent.hex === 0x2a2420 ? 0xe5533d : look.accent.hex, 20);
    band.position.y = 0.12;
    hat.add(brim, tube, band);
    hat.rotation.z = -0.08;
  } else if (look.hat === "beanie") {
    const dome = shadedBox(S.w * 0.8, 0.36, S.d + 0.04, hatC);
    dome.position.y = 0.18;
    const cuff = shadedBox(S.w * 0.84, 0.12, S.d + 0.08, shade(hatC, 0.85).getHex());
    cuff.position.y = 0.04;
    const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), flat(WHITE));
    pom.position.y = 0.46;
    hat.add(dome, cuff, pom);
  } else if (look.hat === "crown") {
    const base = shadedBox(S.w * 0.55, 0.2, S.d * 0.6, GOLD);
    base.position.y = 0.1;
    hat.add(base);
    for (const x of [-1, 0, 1]) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), flat(shade(GOLD, x === 0 ? 1.1 : 0.9)));
      spike.position.set(x * S.w * 0.2, 0.34, 0);
      hat.add(spike);
    }
    const gem = box(0.1, 0.1, 0.04, 0xe5533d);
    gem.position.set(0, 0.1, S.d * 0.3 + 0.02);
    hat.add(gem);
  } else if (look.hat === "party hat") {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.8, 12), flat(hatC));
    cone.position.y = 0.4;
    cone.rotation.z = 0.15;
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), flat(0xffd23f));
    ball.position.set(-0.06, 0.82, 0);
    hat.add(cone, ball);
  } else if (look.hat === "cowboy hat") {
    const brim = cyl(0.95, 0.95, 0.06, 0x9a6a4a, 20);
    brim.position.y = 0.04;
    brim.scale.z = 0.75;
    const crown = cyl(0.36, 0.44, 0.42, 0x9a6a4a, 16);
    crown.position.y = 0.26;
    const band = cyl(0.45, 0.45, 0.08, INK, 16);
    band.position.y = 0.1;
    hat.add(brim, crown, band);
  } else if (look.hat === "propeller") {
    const cap = shadedBox(S.w * 0.6, 0.24, S.d * 0.8, hatC);
    cap.position.y = 0.12;
    const stem = box(0.05, 0.22, 0.05, INK);
    stem.position.y = 0.34;
    const blades = new THREE.Group();
    blades.position.y = 0.46;
    for (const [k, col] of [
      [0, 0xe5533d],
      [1, 0x3f6fd8],
    ] as const) {
      const b = box(0.7, 0.03, 0.14, col);
      b.rotation.y = k * Math.PI / 2;
      blades.add(b);
    }
    spinner = blades;
    hat.add(cap, stem, blades);
  } else if (look.hat === "headphones") {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(S.w / 2 + 0.05, 0.06, 6, 24, Math.PI), flat(INK));
    arc.position.y = -0.2;
    hat.add(arc);
    for (const side of [-1, 1]) {
      const cup = shadedBox(0.2, 0.42, 0.42, accent);
      cup.position.set(side * (S.w / 2 + 0.08), -0.32, 0);
      hat.add(cup);
    }
  } else if (look.hat === "antenna") {
    const stem = box(0.05, 0.5, 0.05, INK);
    stem.position.y = 0.25;
    const tip = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), flat(0xc6ff3d));
    tip.position.y = 0.55;
    hat.add(stem, tip);
    spinner = tip;
  }

  return { group, body, eyes, legs, arms, spinner, rest };
}

/** Soft dark ellipse under the critter. */
export function groundShadow(look: Look): THREE.Mesh {
  const S = SIZES[look.body];
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.14, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.scale.set(S.w * 0.72, S.d * 1.1, 1);
  m.position.y = 0.005;
  return m;
}

/** Releases the GPU memory of everything under `root`. */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose();
  });
}
