import * as THREE from "three";
import { clamp01, disposeScene, smooth } from "./lowpoly";
import { Mascot } from "./mascot";

/**
 * One idle routine, on a loop, so the critter is never just standing there: looks around with the
 * magnifier, reads the clipboard, hops, flips a coin, celebrates. Each act is [start, length] in
 * seconds; between acts he just watches the pointer.
 */
const ROUTINE = { scout: [1.5, 3], think: [5.5, 3.2], hop: [9.2, 0.9], pay: [10.8, 2], party: [13.6, 2.2] } as const;
const CYCLE = 17.5;

/** 0 → 1 → 0 over the act, with soft edges */
function act(local: number, [start, length]: readonly [number, number]): number {
  const u = (local - start) / length;
  if (u <= 0 || u >= 1) return 0;
  return smooth(clamp01(u / 0.18)) * smooth(clamp01((1 - u) / 0.18));
}

/** The hero: just the critter. It watches the pointer, keeps busy and can be poked. */
export class HeroScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  private readonly mascot = new Mascot();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private fit = 1;

  constructor(canvas: HTMLCanvasElement, mobile: boolean) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    this.renderer.setClearColor(0x000000, 0);

    this.scene.add(this.mascot.group);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = Math.max(1, w) / Math.max(1, h);
    // pull back on narrow canvases so the critter never crops
    this.fit = Math.max(1, 1.1 / this.camera.aspect);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  render(time: number, dt: number, mx: number, my: number): void {
    this.camera.position.set(mx * 0.6, 0.5 - my * 0.25, 6.4 * this.fit);
    this.camera.lookAt(0, -0.2, 0);
    const local = time % CYCLE;
    const [hopStart, hopLength] = ROUTINE.hop;
    const think = act(local, ROUTINE.think);
    this.mascot.update({
      time,
      dt,
      mx,
      scout: act(local, ROUTINE.scout),
      // the checklist fills in while he reads, so this one is progress, not a level
      think: think > 0 ? Math.min(think, clamp01((local - ROUTINE.think[0]) / (ROUTINE.think[1] * 0.8))) : 0,
      hop: clamp01((local - hopStart) / hopLength),
      pay: act(local, ROUTINE.pay),
      party: act(local, ROUTINE.party),
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
