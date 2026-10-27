"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Mascot } from "@/components/landing/scene/mascot";
import { blobShadow, buildCloud, buildCoin, buildParcel, buildStall, buildTree, faceted, GROUND, rnd, softDisc, textTexture } from "@/components/landing/scene/lowpoly";

/** The "Rialto is open" announcement scene: rendered once, still, for a screenshot. */
export function OpenScene({ width, height }: { width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 200);

    const ground = softDisc(18, "#e2d0a8", 0.45);
    ground.position.set(2, GROUND - 0.03, -2);
    scene.add(ground);

    // the main stall: Rialto's own, lime awning, OPEN on the counter
    const main = buildStall(0xc6ff3d, "RIALTO");
    main.position.set(2.35, GROUND, -0.9);
    main.rotation.y = -0.22;
    main.scale.setScalar(1.45);
    const mainShadow = blobShadow(2.3, 1.4, 0.22);
    mainShadow.position.set(2.35, GROUND - 0.005, -0.75);
    scene.add(main, mainShadow);
    const open = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.34), new THREE.MeshBasicMaterial({ map: textTexture("OPEN", "#17120f", "#c6ff3d", 512, 184) }));
    open.position.set(0, 0.42, 0.44);
    open.rotation.z = -0.05;
    main.add(open);
    // parcels and coins waiting on the counter
    [[-0.5, 0.97, 0.05, 0x5ce1e6], [0.05, 0.97, 0.1, 0xffd23f], [-0.22, 1.36, 0.08, 0xff8fa3]].forEach(([x, y, z, band]) => {
      const p = buildParcel(band);
      p.scale.setScalar(0.62);
      p.position.set(x, y - 0.2, z);
      p.rotation.y = rnd(x * 10, 2) - 0.5;
      main.add(p);
    });
    for (let i = 0; i < 3; i++) {
      const c = buildCoin();
      c.position.set(0.55 + i * 0.05, 0.86 + i * 0.075, 0.15);
      c.scale.setScalar(0.55);
      main.add(c);
    }

    // the rest of the market, further back
    const others: [string, number, number, number, number, number][] = [
      ["3D", 0xffd23f, -2.2, -7.5, 1.0, 0.3],
      ["VOICE", 0x5ce1e6, 8.4, -4.6, 1.0, -0.5],
      ["MUSIC", 0xff8fa3, 11.5, -10.5, 1.05, -0.35],
    ];
    for (const [label, color, x, z, s, turn] of others) {
      const st = buildStall(color, label);
      st.position.set(x, GROUND, z);
      st.rotation.y = turn;
      st.scale.setScalar(s);
      const sh = blobShadow(1.5, 1, 0.18);
      sh.position.set(x, GROUND - 0.005, z + 0.1);
      scene.add(st, sh);
    }

    const trees: [number, number, number, number][] = [
      [-0.8, -4.4, 1.25, 0x7fc96b], [7.6, -8.6, 1.6, 0x6dbb86], [12.6, -3.2, 1.35, 0x7fc96b],
      [15.5, -8.5, 1.7, 0x6dbb86], [1.8, -16, 1.5, 0x7fc96b], [9.5, -15, 1.4, 0x7fc96b], [-6, -14, 1.5, 0x6dbb86],
    ];
    for (const [x, z, s, hex] of trees) {
      const t = buildTree(hex);
      t.position.set(x, GROUND, z);
      t.scale.setScalar(s);
      const sh = blobShadow(1.1 * s, 0.8 * s);
      sh.position.set(x, GROUND - 0.01, z);
      scene.add(t, sh);
    }
    for (let i = 0; i < 26; i++) {
      const tuft = faceted(new THREE.ConeGeometry(0.11, 0.3, 4), () => (i % 3 ? 0x8fcf7a : 0x6dbb86));
      tuft.position.set(-2 + rnd(i, 1) * 13, GROUND + 0.14, 2.2 - rnd(i, 2) * 6.5);
      tuft.scale.setScalar(0.8 + rnd(i, 4) * 0.8);
      if (Math.abs(tuft.position.x - 0.4) < 1.6 && tuft.position.z > -1) continue;
      scene.add(tuft);
    }
    [[-9, 7.4, -22, 1.7], [4.5, 8.6, -24, 2.0], [15, 7.2, -21, 1.6]].forEach(([x, y, z, s]) => {
      const c = buildCloud();
      c.position.set(x, y, z);
      c.scale.setScalar(s);
      scene.add(c);
    });

    // the critter, celebrating in front of the stall
    const mascot = new Mascot();
    mascot.group.position.set(-0.25, 0, 0.75);
    const shadow = blobShadow(1.25, 0.6, 0.2);
    shadow.position.set(-0.25, GROUND - 0.005, 0.8);
    scene.add(mascot.group, shadow);

    // settle his pose: run the celebration for a few seconds of simulated time and stop mid-hop
    const dt = 1 / 60;
    let t = 0;
    for (; t < 3.05; t += dt) mascot.update({ time: t, dt, mx: 0.15, scout: 0, think: 0, hop: 0, pay: 0, party: 1, turn: 0.28 });

    camera.position.set(1.2, 3.1, 17.5);
    camera.lookAt(1.2, 1.0, -1.5);
    // frame the market in the right part of the image, the headline owns the left
    camera.setViewOffset(width, height, -width * 0.24, height * 0.04, width, height);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    (window as unknown as { __rendered?: boolean }).__rendered = true;
    return () => renderer.dispose();
  }, [width, height]);
  return <canvas ref={ref} style={{ width, height }} className="absolute inset-0" />;
}
