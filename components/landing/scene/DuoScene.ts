import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { buildSoloRobot } from "./soloRobot";

/** Side-by-side turntable: the robot Claude wrote as code (left) vs. the specialist API's model (right). */
export class DuoScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private readonly left = new THREE.Group();
  private readonly right = new THREE.Group();
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, modelUrl: string, mobile: boolean) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.5));
    this.renderer.setClearColor(0x000000, 0);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x20221d, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(2, 5, 6);
    this.scene.add(key);

    const HEIGHT = 2;
    const solo = buildSoloRobot();
    solo.group.scale.setScalar(HEIGHT / 2.03);
    this.left.add(solo.group);
    this.left.position.x = -0.95;
    this.right.position.x = 0.95;
    this.scene.add(this.left, this.right);

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(modelUrl, (gltf) => {
      if (this.disposed) return;
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const s = HEIGHT / size.y;
      model.scale.setScalar(s);
      model.position.set(-(box.min.x + size.x / 2) * s, -box.min.y * s, -(box.min.z + size.z / 2) * s);
      this.right.add(model);
    });

    this.camera.position.set(0, 1.05, 5.3);
    this.camera.lookAt(0, 1.0, 0);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = Math.max(1, w) / Math.max(1, h);
    // keep both robots in frame on narrow canvases
    this.camera.position.z = 5.3 * Math.max(1, 1.2 / this.camera.aspect);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  render(angle: number): void {
    this.left.rotation.y = angle;
    this.right.rotation.y = angle;
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
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
