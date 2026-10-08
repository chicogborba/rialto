import * as THREE from "three";

/**
 * Building blocks for the page's low-poly world: shaded boxes, signs, trees, clouds and the small
 * critters. No lights anywhere: every face carries its own shade.
 */

/** where feet stand: the mascot's body is centred on y = 0 */
export const GROUND = -1.085;
const INK = 0x17120f;
// face order: +x, -x, +y, -y, +z, -z
const FACE_SHADES = [0.86, 0.72, 1.06, 0.55, 0.96, 0.64];

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
export const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const backOut = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2));
export const rnd = (i: number, n: number) => {
  const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Box with per-face shades: fakes lighting without any lights in the scene. */
export function shadedBox(w: number, h: number, d: number, hex: number, opacity = 1): THREE.Mesh {
  const materials = FACE_SHADES.map((k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }));
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials);
}

/** Flat-shaded mesh for shapes that are not boxes: every triangle gets its shade from one fixed light. */
export function faceted(geometry: THREE.BufferGeometry, colorOf: (face: number) => number, floor = 0.62): THREE.Mesh {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.computeVertexNormals();
  const position = g.getAttribute("position");
  const normal = g.getAttribute("normal");
  const colors = new Float32Array(position.count * 3);
  const light = new THREE.Vector3(0.35, 0.8, 0.5).normalize();
  const n = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < position.count; i += 3) {
    n.fromBufferAttribute(normal, i);
    c.setHex(colorOf(i / 3)).multiplyScalar(floor + (1.08 - floor) * Math.max(0, n.dot(light)));
    for (let v = 0; v < 3; v++) c.toArray(colors, (i + v) * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true }));
}

/** Bold text drawn once into a texture. Pass `bg: null` for text on a transparent background. */
export function textTexture(text: string, fg: string, bg: string | null, width = 512, height = 160): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const face = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
    let size = height * 0.66;
    ctx.font = `900 ${size}px ${face}`;
    const measured = ctx.measureText(text).width;
    if (measured > width * 0.86) size *= (width * 0.86) / measured;
    ctx.font = `900 ${size}px ${face}`;
    ctx.fillText(text, width / 2, height * 0.54);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** A chequered flag pattern, kept crisp. */
export function checkerTexture(cols: number, rows: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = (x + y) % 2 ? "#fffdf7" : "#17120f";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

/** A round patch of colour that fades out at the rim: ground with no edge to crop. */
export function softDisc(radius: number, color: string, solid = 0.5): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const fade = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    fade.addColorStop(0, color);
    fade.addColorStop(solid, color);
    fade.addColorStop(1, `${color}00`);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, 256, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  return disc;
}

/** Soft dark blob under something that stands on the ground. */
export function blobShadow(rx: number, rz: number, opacity = 0.16): THREE.Mesh {
  const blob = softDisc(1, "#17120f", 0.35);
  (blob.material as THREE.MeshBasicMaterial).opacity = opacity;
  blob.scale.set(rx, rz, 1);
  return blob;
}

/** Two stacked cones on a trunk. Stands on y = 0. */
export function buildTree(hex = 0x7fc96b): THREE.Group {
  const tree = new THREE.Group();
  const trunk = shadedBox(0.26, 0.8, 0.26, 0x8d6540);
  trunk.position.y = 0.4;
  const low = faceted(new THREE.ConeGeometry(0.85, 1.5, 6), () => hex);
  low.position.y = 1.45;
  const top = faceted(new THREE.ConeGeometry(0.6, 1.1, 6), () => hex);
  top.position.y = 2.2;
  tree.add(trunk, low, top);
  return tree;
}

export function buildCloud(): THREE.Group {
  const cloud = new THREE.Group();
  for (const [x, y, z, s] of [
    [0, 0, 0, 1],
    [1.1, -0.15, 0.1, 0.75],
    [-1.0, -0.2, -0.1, 0.65],
  ]) {
    const puff = faceted(new THREE.IcosahedronGeometry(1, 0), () => 0xffffff, 0.88);
    puff.position.set(x, y, z);
    puff.scale.setScalar(s);
    cloud.add(puff);
  }
  return cloud;
}

export function buildParcel(): THREE.Group {
  const parcel = new THREE.Group();
  parcel.add(shadedBox(0.7, 0.52, 0.52, 0xd9a868), shadedBox(0.14, 0.54, 0.54, 0xc6ff3d));
  return parcel;
}

const BODY = { w: 1.9, h: 1.25, d: 0.85 };
const LEG = 0.46;

/**
 * A small critter with the mascot's proportions and a simple walk cycle. `bands` are its colours
 * from top to bottom: one for a plain critter, three for the Solana stripes. The group's origin is
 * the body centre, so at scale 1 the feet are on GROUND.
 */
export class MiniCritter {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly legs: THREE.Mesh[] = [];
  private readonly parcels: THREE.Group[] = [];
  private readonly legBase = -(BODY.h / 2 + LEG / 2) + 0.02;

  constructor(bands: number[], parcels = 0) {
    const bandHeight = BODY.h / bands.length;
    bands.forEach((hex, i) => {
      const band = shadedBox(BODY.w, bandHeight, BODY.d, hex);
      band.position.y = BODY.h / 2 - bandHeight / 2 - i * bandHeight;
      this.body.add(band);
    });
    const mid = bands[Math.floor(bands.length / 2)];
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.4, 0.06), new THREE.MeshBasicMaterial({ color: INK }));
      eye.position.set(side * 0.47, 0.13, BODY.d / 2 + 0.03);
      const arm = shadedBox(0.3, 0.4, 0.5, mid);
      arm.position.set(side * (BODY.w / 2 + 0.15), 0.02, -0.08);
      this.body.add(eye, arm);
    }
    for (const z of [0.3, -0.3]) {
      for (const x of [-0.72, -0.44, 0.44, 0.72]) {
        const leg = shadedBox(0.17, LEG, 0.17, bands[bands.length - 1]);
        leg.position.set(x, this.legBase, z);
        this.legs.push(leg);
        this.group.add(leg);
      }
    }
    for (let k = 0; k < parcels; k++) {
      const parcel = buildParcel();
      parcel.position.y = BODY.h / 2 + 0.3 + k * 0.54;
      parcel.rotation.y = k * 0.5;
      parcel.visible = false;
      this.parcels.push(parcel);
      this.body.add(parcel);
    }
    this.group.add(this.body);
  }

  /** `walk` 0..1 is how hard it is walking, `hop` lifts it, `pace` speeds the cycle up for running. */
  update(time: number, walk: number, hop = 0, pace = 1): void {
    const cycle = time * 9 * pace;
    this.body.position.y = Math.abs(Math.sin(cycle)) * 0.09 * walk + hop;
    this.body.rotation.z = Math.sin(cycle) * 0.05 * walk;
    this.body.rotation.x = 0.1 * walk;
    this.legs.forEach((leg, i) => {
      leg.position.y = this.legBase + Math.max(0, Math.sin(cycle * 2 + (i % 2) * Math.PI + (i > 3 ? 1.2 : 0))) * 0.17 * walk + hop * 0.92;
    });
  }

  /** shows the first `count` parcels on its head; `pop` (0..1) scales the newest one in */
  setParcels(count: number, pop = 1): void {
    this.parcels.forEach((parcel, k) => {
      parcel.visible = k < count;
      parcel.scale.setScalar(k === count - 1 ? Math.max(0.0001, pop) : 1);
    });
  }
}

export function disposeScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Sprite)) return;
    o.geometry.dispose();
    const materials: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
    materials.forEach((m) => {
      if (m instanceof THREE.MeshBasicMaterial || m instanceof THREE.SpriteMaterial) m.map?.dispose();
      m.dispose();
    });
  });
  renderer.dispose();
}
