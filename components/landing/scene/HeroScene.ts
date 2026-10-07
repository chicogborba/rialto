import * as THREE from "three";
import { Mascot } from "./mascot";

const PALETTE = [0x5ce1e6, 0xffd23f, 0xc6ff3d, 0x9945ff, 0x14f195, 0xffffff, 0xff4d4d];
const rnd = (i: number, n: number) => {
  const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** The hero: the critter standing among blocks resting on the ground, like the video's title card. */
const GROUND = -1.085; // the mascot's feet
export class HeroScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  private readonly mascot = new Mascot();
  private readonly cubes: { mesh: THREE.Mesh; x: number; y: number; z: number; phase: number; hop: number }[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();

  constructor(canvas: HTMLCanvasElement, mobile: boolean) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    this.renderer.setClearColor(0x000000, 0);
    this.scene.add(this.mascot.group);

    const count = mobile ? 12 : 24;
    for (let i = 0; i < count; i++) {
      const size = 0.28 + rnd(i, 1) * 0.42;
      const hex = PALETTE[i % PALETTE.length];
      // per-face shades fake the lighting, same trick as the mascot
      const mats = [0.84, 0.72, 1.05, 0.5, 0.95, 0.62].map((k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) }));
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mats);
      const side = i % 2 ? 1 : -1;
      mesh.rotation.y = rnd(i, 6) * 3;
      const cube = { mesh, x: side * (1.9 + rnd(i, 2) * (mobile ? 2.2 : 5.4)), y: GROUND + size / 2, z: -0.2 - rnd(i, 4) * 3.2, phase: rnd(i, 5) * 6.28, hop: 0.1 + rnd(i, 3) * 0.2 };
      this.cubes.push(cube);
      this.scene.add(mesh);
    }
    this.camera.position.set(0, 0.35, 6.2);
    this.camera.lookAt(0, -0.3, 0);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = Math.max(1, w) / Math.max(1, h);
    // the stage is a wide strip on desktop; pull back on narrow screens
    this.camera.position.z = 6.2 * Math.max(1, 2.2 / this.camera.aspect);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  render(time: number, dt: number, mx: number): void {
    this.mascot.update({ time, dt, mx, scout: 0, think: 0, hop: 0, pay: 0, party: 0 });
    for (const c of this.cubes) {
      // they rest on the ground and give a little hop now and then
      c.mesh.position.set(c.x, c.y + Math.max(0, Math.sin(time * 1.1 + c.phase)) * c.hop, c.z);
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** true when the screen point is over the critter */
  pick(clientX: number, clientY: number): boolean {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.intersectObject(this.mascot.hitBox).length > 0;
  }

  poke(variant: number): void {
    this.mascot.poke(variant);
  }

  dispose(): void {
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
    this.renderer.dispose();
  }
}
