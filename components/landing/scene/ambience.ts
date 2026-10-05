import * as THREE from "three";
import { TRACK_FRAG, TRACK_VERT } from "./shaders";

/**
 * Everything that makes the yard feel alive without costing a post-processing pass:
 * a floating market of anonymous APIs, a skyline with beacons, inbound traffic, dust,
 * a radar sweep while vetting, a light pillar on the hire, and sprite glows (cheap bloom).
 */

export interface AmbienceState {
  time: number;
  color: THREE.Color;
  /** 0..1 progress of the market-wide search */
  search: number;
  /** 0..1 while the agent is vetting */
  sweep: number;
  /** 0..1 once a specialist is hired */
  hire: number;
  /** 0..1 burst on delivery */
  burst: number;
}

const SIGNAL = 0xc6ff3d;

// deterministic scatter: stable across reloads, no Math.random
const rnd = (i: number, n: number) => {
  const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.25, "rgba(255,255,255,0.28)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(c);
}

export class Ambience {
  private readonly market: THREE.Group;
  private readonly beacons: THREE.PointsMaterial;
  private readonly dust: THREE.Points;
  private readonly traffic: THREE.ShaderMaterial[] = [];
  private readonly marketMat = new THREE.MeshBasicMaterial();
  private readonly scanRings: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly sweepPivot = new THREE.Group();
  private readonly sweepMat: THREE.MeshBasicMaterial;
  private readonly pillar: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  private readonly coreGlow: THREE.Sprite;
  private readonly hireGlow: THREE.Sprite;

  constructor(scene: THREE.Scene, core: THREE.Vector3, intake: THREE.Vector3, winner: THREE.Vector3, mobile: boolean) {
    const tex = glowTexture();
    const sprite = (scale: number) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: SIGNAL, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      s.scale.setScalar(scale);
      scene.add(s);
      return s;
    };
    this.coreGlow = sprite(8);
    this.coreGlow.position.copy(core);
    this.hireGlow = sprite(5);
    this.hireGlow.position.copy(winner);

    // ---- the market: a few hundred anonymous APIs drifting around the yard
    const count = mobile ? 280 : 800;
    const cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.marketMat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = rnd(i, 1) * Math.PI * 2;
      const r = 10 + Math.pow(rnd(i, 2), 0.8) * 36;
      const s = 0.1 + rnd(i, 3) * 0.4;
      e.set(rnd(i, 4) * 3, rnd(i, 5) * 3, 0);
      m.compose(new THREE.Vector3(core.x + Math.cos(a) * r, -1 + rnd(i, 6) * 11, core.z + Math.sin(a) * r), q.setFromEuler(e), new THREE.Vector3(s, s, s));
      cubes.setMatrixAt(i, m);
      const k = rnd(i, 7);
      cubes.setColorAt(i, k > 0.9 ? col.setHex(SIGNAL).multiplyScalar(0.7) : k > 0.8 ? col.setHex(0x5ce1e6).multiplyScalar(0.5) : col.setHex(0x8c8e84).multiplyScalar(0.2 + rnd(i, 8) * 0.35));
    }
    this.market = new THREE.Group();
    this.market.add(cubes);
    scene.add(this.market);

    // ---- skyline with blinking beacons
    const towers = mobile ? 22 : 44;
    const tower = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x12140f }), towers);
    const tops = new Float32Array(towers * 3);
    for (let i = 0; i < towers; i++) {
      const a = (i / towers) * Math.PI * 2 + rnd(i, 9) * 0.1;
      const r = 36 + rnd(i, 10) * 24;
      const h = 4 + rnd(i, 11) * 15;
      const w = 0.8 + rnd(i, 12) * 1.8;
      const x = core.x + Math.cos(a) * r;
      const z = core.z + Math.sin(a) * r;
      m.compose(new THREE.Vector3(x, -1.6 + h / 2, z), q.identity(), new THREE.Vector3(w, h, w));
      tower.setMatrixAt(i, m);
      tops.set([x, -1.6 + h + 0.3, z], i * 3);
    }
    scene.add(tower);
    const topGeo = new THREE.BufferGeometry();
    topGeo.setAttribute("position", new THREE.BufferAttribute(tops, 3));
    this.beacons = new THREE.PointsMaterial({ color: 0xff5b1f, size: 0.45, transparent: true, depthWrite: false });
    scene.add(new THREE.Points(topGeo, this.beacons));

    // ---- dust
    const n = mobile ? 250 : 700;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([(rnd(i, 13) - 0.5) * 50, rnd(i, 14) * 13 - 1, (rnd(i, 15) - 0.5) * 50], i * 3);
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: SIGNAL, size: 0.06, transparent: true, opacity: 0.55, depthWrite: false }));
    scene.add(this.dust);

    // ---- inbound traffic: requests streaming into the agent from the market
    const lanes = mobile ? 5 : 10;
    for (let i = 0; i < lanes; i++) {
      // only from behind and the sides, so no beam ever crosses his face
      const a = Math.PI * (1.05 + (i / (lanes - 1)) * 0.9);
      const r = 17 + rnd(i, 16) * 10;
      const from = new THREE.Vector3(core.x + Math.cos(a) * r, 2 + rnd(i, 17) * 6, core.z + Math.sin(a) * r);
      const mid = from.clone().lerp(intake, 0.5).setY(from.y + 2.5);
      const mat = new THREE.ShaderMaterial({
        vertexShader: TRACK_VERT,
        fragmentShader: TRACK_FRAG,
        uniforms: {
          uTime: { value: 0 }, uDraw: { value: 1 }, uFlow: { value: 0.9 }, uDir: { value: 0.35 + rnd(i, 18) * 0.5 }, uAlpha: { value: 0.4 },
          uColor: { value: new THREE.Color(SIGNAL) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.traffic.push(mat);
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, mid, intake.clone()), 40, 0.014, 5), mat));
    }

    // ---- search pulses: rings racing out across the whole market
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.985, 1, 96),
        new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(core.x, -1.5, core.z);
      this.scanRings.push(ring);
      scene.add(ring);
    }

    // ---- radar sweep (searching, vetting)
    this.sweepMat = new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const wedge = new THREE.Mesh(new THREE.CircleGeometry(11, 20, 0, 0.55), this.sweepMat);
    wedge.rotation.x = -Math.PI / 2;
    this.sweepPivot.add(wedge);
    this.sweepPivot.position.set(core.x, -1.52, core.z);
    scene.add(this.sweepPivot);

    // ---- light pillar on the hire
    this.pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.75, 14, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.pillar.position.set(winner.x, 5.4, winner.z);
    scene.add(this.pillar);
  }

  update(s: AmbienceState): void {
    const t = s.time;
    this.market.rotation.y = t * 0.012;
    this.dust.rotation.y = -t * 0.01;
    this.beacons.opacity = 0.45 + 0.55 * Math.max(0, Math.sin(t * 2.2));
    for (const mat of this.traffic) {
      mat.uniforms.uTime.value = t;
      (mat.uniforms.uColor.value as THREE.Color).copy(s.color);
    }
    // searching: pulses race outward, the sweep widens to the horizon, the whole market flickers
    const searching = s.search > 0 && s.search < 1 ? Math.min(1, Math.sin(s.search * Math.PI) * 3) : 0;
    this.scanRings.forEach((ring, k) => {
      const f = (s.search * 3 + k / this.scanRings.length) % 1;
      ring.scale.setScalar(1 + f * 46);
      ring.material.opacity = searching * (1 - f) * 0.9;
    });
    this.marketMat.color.setScalar(1 + searching * (1.1 + 0.7 * Math.sin(t * 9)));
    this.sweepPivot.rotation.y = -t * (1.7 + searching * 1.3);
    this.sweepPivot.scale.setScalar(1 + searching * 3.2);
    this.sweepMat.opacity = Math.max(s.sweep * 0.16, searching * 0.1);
    this.pillar.material.opacity = s.hire * 0.16 + s.burst * 0.12;
    this.pillar.material.color.copy(s.color);
    this.coreGlow.material.color.copy(s.color);
    this.coreGlow.material.opacity = 0.5 + 0.08 * Math.sin(t * 1.7) + s.burst * 0.5;
    this.coreGlow.scale.setScalar(8 + s.burst * 6);
    this.hireGlow.material.opacity = s.hire * 0.6;
  }
}
