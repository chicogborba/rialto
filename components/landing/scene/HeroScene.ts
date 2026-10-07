import * as THREE from "three";
import { disposeScene, GROUND } from "./lowpoly";
import { Mascot } from "./mascot";

/** The hero: just the critter on a soft shadow. It watches the pointer and can be poked. */
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

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.25, 48),
      new THREE.MeshBasicMaterial({ color: 0x17120f, transparent: true, opacity: 0.1, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1, 0.55, 1);
    shadow.position.y = GROUND + 0.005;
    this.scene.add(shadow, this.mascot.group);
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
    this.mascot.update({ time, dt, mx, scout: 0, think: 0, hop: 0, pay: 0, party: 0 });
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
