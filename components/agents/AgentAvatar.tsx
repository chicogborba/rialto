"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import { buildCritter, describeLook, disposeTree, groundShadow, lookFor, type Critter } from "./critter";

/**
 * An agent's critter. Cards use a still picture rendered once per agent by one shared, hidden
 * WebGL canvas (a page of twenty agents would otherwise open twenty GPU contexts); the open agent
 * gets `live`, a canvas of its own where the critter breathes, blinks and follows the pointer.
 */

const SNAP = 480;
const snaps = new Map<string, string>();
let snapper: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera } | null = null;

function camera(aspect = 1): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(28, aspect, 0.1, 50);
  cam.position.set(1.9, 2.1, 6.4);
  cam.lookAt(0, 1.15, 0);
  return cam;
}

function snapshot(seed: string): string | null {
  const hit = snaps.get(seed);
  if (hit) return hit;
  try {
    if (!snapper) {
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setSize(SNAP, SNAP, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      snapper = { renderer, scene: new THREE.Scene(), camera: camera() };
    }
    const { renderer, scene, camera: cam } = snapper;
    const look = lookFor(seed);
    const c = buildCritter(look);
    c.group.rotation.y = 0.12;
    // a resting pose with a little life in it: one arm up, as if waving hello
    c.arms[1].rotation.z = 0.9;
    const shadow = groundShadow(look);
    scene.add(c.group, shadow);
    renderer.clear();
    renderer.render(scene, cam);
    const url = renderer.domElement.toDataURL("image/png");
    scene.remove(c.group, shadow);
    disposeTree(c.group);
    disposeTree(shadow);
    snaps.set(seed, url);
    return url;
  } catch {
    return null;
  }
}

export function AgentAvatar({ seed, className, live = false, reveal = false }: { seed: string; className?: string; live?: boolean; reveal?: boolean }) {
  const label = describeLook(lookFor(seed));
  if (live) return <LiveCritter seed={seed} reveal={reveal} className={className} label={label} />;
  return <StillCritter seed={seed} className={className} label={label} />;
}

function StillCritter({ seed, className, label }: { seed: string; className?: string; label: string }) {
  const [src, setSrc] = useState<string | null>(() => snaps.get(seed) ?? null);
  useEffect(() => {
    if (snaps.has(seed)) return;
    let alive = true;
    // after paint, so a page of cards shows its text first
    const id = requestAnimationFrame(() => {
      const url = snapshot(seed);
      if (alive) setSrc(url);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, [seed]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={label} title={label} draggable={false} className={cn("aspect-square select-none object-contain", className)} />
  ) : (
    <div role="img" aria-label={label} className={cn("aspect-square", className)} />
  );
}

function LiveCritter({ seed, reveal, className, label }: { seed: string; reveal: boolean; className?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    const scene = new THREE.Scene();
    const cam = camera();
    const look = lookFor(seed);
    const c: Critter = buildCritter(look);
    const shadow = groundShadow(look);
    scene.add(c.group, shadow);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const size = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(host);

    let mx = 0;
    let my = 0;
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      mx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      my = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    };
    window.addEventListener("pointermove", onMove);

    let raf = 0;
    let yaw = 0.12;
    let pitch = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      // reveal: drop in from above, squash on landing, then a happy wave
      const drop = reveal && !still ? Math.max(0, 1 - t / 0.55) : 0;
      const land = reveal && !still && t > 0.55 && t < 0.9 ? Math.sin(((t - 0.55) / 0.35) * Math.PI) : 0;
      c.group.position.y = drop * drop * 4.5;
      const breathe = still ? 0 : Math.sin(t * 2.4) * 0.025;
      c.body.scale.set(1 + land * 0.12 - breathe, 1 - land * 0.18 + breathe, 1 + land * 0.12 - breathe);
      c.body.position.y = c.rest * (1 - land * 0.1) + (still ? 0 : Math.sin(t * 2.4) * 0.03);
      yaw += (0.12 + mx * 0.6 - yaw) * 0.08;
      pitch += (my * 0.15 - pitch) * 0.08;
      c.group.rotation.y = yaw;
      c.body.rotation.x = pitch;
      const wave = still ? 0.9 : 0.9 + Math.sin(t * (reveal && t < 3 ? 9 : 3)) * (reveal && t < 3 ? 0.5 : 0.18);
      c.arms[1].rotation.z = wave;
      c.arms[0].rotation.z = still ? 0 : -Math.sin(t * 2.4) * 0.08;
      // blink every few seconds
      const blink = !still && t % 3.7 > 3.58 ? 0.12 : 1;
      for (const e of c.eyes) e.scale.y = blink;
      if (c.spinner) c.spinner.rotation.y = still ? 0 : t * 6;
      renderer.render(scene, cam);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      disposeTree(c.group);
      disposeTree(shadow);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [seed, reveal]);
  return <div ref={ref} role="img" aria-label={label} className={cn("aspect-square", className)} />;
}
