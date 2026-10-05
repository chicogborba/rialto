import * as THREE from "three";

/**
 * "SOLO" robot: a humanoid robot written by Claude Opus 5.5 as three.js primitives, in one pass,
 * trying to match the reference (white shell, dark joints, amber eyes, antennae). This is the honest
 * best effort of a language model emitting geometry as code — it is the left side of the comparison.
 */

export interface SoloRobot {
  group: THREE.Group;
  /** build order: feet → head. Scale each from 0 to 1 to "assemble" it. */
  parts: THREE.Object3D[];
  triangles: number;
}

export function buildSoloRobot(): SoloRobot {
  const shell = new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: 0.45, metalness: 0.1 });
  const joint = new THREE.MeshStandardMaterial({ color: 0x26282b, roughness: 0.6, metalness: 0.4 });
  const eye = new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xff9a00, emissiveIntensity: 1.4 });

  const group = new THREE.Group();
  const parts: THREE.Object3D[] = [];
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z = 0, rz = 0, rx = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, 0, rz);
    group.add(m);
    parts.push(m);
    return m;
  };
  const both = (fn: (side: 1 | -1) => void) => {
    fn(-1);
    fn(1);
  };

  // legs
  both((s) => add(new THREE.BoxGeometry(0.15, 0.07, 0.3), joint, s * 0.13, 0.035, 0.05));
  both((s) => add(new THREE.BoxGeometry(0.13, 0.05, 0.12), shell, s * 0.13, 0.085, 0.13));
  both((s) => add(new THREE.CapsuleGeometry(0.055, 0.3, 4, 12), shell, s * 0.13, 0.3));
  both((s) => add(new THREE.SphereGeometry(0.066, 14, 10), joint, s * 0.13, 0.52));
  both((s) => add(new THREE.CapsuleGeometry(0.068, 0.24, 4, 12), shell, s * 0.13, 0.74));
  both((s) => add(new THREE.SphereGeometry(0.072, 14, 10), joint, s * 0.13, 0.94));

  // torso
  add(new THREE.CapsuleGeometry(0.09, 0.14, 4, 14), shell, 0, 1.0, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(0.06, 0.07, 0.18, 14), joint, 0, 1.13);
  for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.068, 0.012, 6, 16), joint, 0, 1.08 + i * 0.045, 0, 0, Math.PI / 2);
  const chest = add(new THREE.SphereGeometry(0.2, 20, 14), shell, 0, 1.37);
  chest.scale.set(1.08, 1, 0.72);
  const plate = add(new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), joint, 0, 1.33);
  plate.scale.set(1.05, 1, 0.74);

  // arms
  both((s) => add(new THREE.SphereGeometry(0.075, 14, 10), joint, s * 0.265, 1.47));
  both((s) => {
    const pad = add(new THREE.SphereGeometry(0.09, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), shell, s * 0.275, 1.49, 0, -s * 0.5);
    pad.scale.set(1, 0.9, 0.9);
  });
  both((s) => add(new THREE.CapsuleGeometry(0.05, 0.2, 4, 12), shell, s * 0.305, 1.28, 0, s * 0.1));
  both((s) => add(new THREE.SphereGeometry(0.05, 12, 8), joint, s * 0.325, 1.11));
  both((s) => add(new THREE.CapsuleGeometry(0.045, 0.2, 4, 12), shell, s * 0.34, 0.94, 0, s * 0.06));
  both((s) => add(new THREE.SphereGeometry(0.05, 12, 8), joint, s * 0.35, 0.77));
  both((s) => {
    for (let f = -1; f <= 1; f++) add(new THREE.BoxGeometry(0.018, 0.07, 0.018), joint, s * 0.35 + f * 0.026, 0.7, 0.01);
  });

  // head
  add(new THREE.CylinderGeometry(0.035, 0.04, 0.09, 12), joint, 0, 1.6);
  const head = add(new THREE.SphereGeometry(0.15, 22, 16), shell, 0, 1.77);
  head.scale.set(1, 1.05, 0.95);
  both((s) => add(new THREE.CylinderGeometry(0.047, 0.047, 0.02, 18), joint, s * 0.062, 1.775, 0.132, 0, Math.PI / 2));
  both((s) => add(new THREE.CylinderGeometry(0.03, 0.03, 0.024, 18), eye, s * 0.062, 1.775, 0.136, 0, Math.PI / 2));
  both((s) => add(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), joint, s * 0.158, 1.765, 0, Math.PI / 2));
  both((s) => add(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), joint, s * 0.1, 1.95, 0, -s * 0.12));
  both((s) => add(new THREE.SphereGeometry(0.014, 8, 6), joint, s * 0.108, 2.01));

  let triangles = 0;
  for (const p of parts) {
    const g = (p as THREE.Mesh).geometry;
    triangles += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  }
  return { group, parts, triangles: Math.round(triangles) };
}
