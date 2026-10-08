import * as THREE from "three";
import { blobShadow, buildCloud, buildTree, disposeScene, GROUND, seg, softDisc } from "./lowpoly";
import { Mascot } from "./mascot";

/**
 * The hero: the critter, a few trees and drifting clouds. Nothing else.
 *
 * He watches the pointer, can be poked, and gives a small hop each time the headline names a new
 * thing he could go and buy.
 */

/** x, z, scale, colour: kept to the right of the headline and behind the critter */
const TREES: [number, number, number, number][] = [
  [-2.7, -3.8, 1.25, 0x7fc96b],
  [3.3, -3.2, 1.45, 0x6dbb86],
  [5.2, -6.6, 1.75, 0x7fc96b],
  [-3.7, -8.2, 1.5, 0x6dbb86],
  [1.3, -9.6, 1.3, 0x7fc96b],
];
/** x, z, scale: the height is set every frame so they sit along the top of the canvas */
const CLOUDS: [number, number, number][] = [
  [-14, -16, 1.4],
  [-3, -20, 1.8],
  [10, -17, 1.5],
];

export class HeroScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
  private readonly mascot = new Mascot();
  private readonly clouds: { group: THREE.Group; x: number }[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private fit = 1;

  constructor(canvas: HTMLCanvasElement, mobile: boolean) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    this.renderer.setClearColor(0x000000, 0);

    // ground with no edge: a patch of sand that fades into the page
    const ground = softDisc(12, "#e2d0a8", 0.4);
    ground.position.set(0, GROUND - 0.03, -1.5);
    this.scene.add(ground);

    for (const [x, z, s, hex] of TREES) {
      const tree = buildTree(hex);
      tree.position.set(x, GROUND, z);
      tree.scale.setScalar(s);
      const shadow = blobShadow(1.1 * s, 0.8 * s);
      shadow.position.set(x, GROUND - 0.01, z);
      this.scene.add(tree, shadow);
    }
    for (const [x, z, s] of CLOUDS) {
      const group = buildCloud();
      group.position.set(x, 6, z);
      group.scale.setScalar(s);
      this.clouds.push({ group, x });
      this.scene.add(group);
    }
    this.scene.add(this.mascot.group);
  }

  /** `shift` (0..0.5) moves the critter that share of the width to the right, leaving room for the headline. */
  resize(w: number, h: number, shift = 0): void {
    const width = Math.max(1, w);
    const height = Math.max(1, h);
    this.camera.aspect = width / height;
    // pull back on narrow canvases so the critter never crops
    this.fit = Math.max(1, 0.95 / ((1 - shift * 2) * this.camera.aspect));
    if (shift > 0) this.camera.setViewOffset(width, height, -shift * width, 0, width, height);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  /** `q` is the seconds since the headline last changed. */
  render(time: number, dt: number, mx: number, my: number, q = 99): void {
    this.camera.position.set(mx * 0.6, 1.5 - my * 0.25, 9.6 * this.fit);
    this.camera.lookAt(0, 0.3, 0);
    this.mascot.update({ time, dt, mx, scout: 0, think: 0, hop: q > 0.05 && q < 0.75 ? seg(q, 0.05, 0.75) * 0.999 : 0, pay: 0, party: 0 });

    // clouds drift along the top of the frame, wherever that is for this canvas
    const up = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2) - Math.atan2(this.camera.position.y - 0.3, this.camera.position.z));
    this.clouds.forEach(({ group, x }, i) => {
      group.position.x = ((x + time * (0.22 + i * 0.05) + 26) % 52) - 26;
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

  /** same as `pick`: the critter is the only thing here to point at */
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
