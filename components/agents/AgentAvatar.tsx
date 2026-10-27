"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { lookFromParts, lookKey, type LookParts } from "@/lib/agent/look";
import { cn } from "@/lib/utils";
import { buildCritter, describeLook, disposeTree, groundShadow, type Critter } from "./critter";

/**
 * An agent's critter. Cards use a still picture rendered once per look by one shared, hidden WebGL
 * canvas (a page of twenty agents would otherwise open twenty GPU contexts); the open agent and the
 * editor get `live`, a canvas of its own where the critter breathes, blinks, follows the pointer and
 * pops into a new outfit when the look changes.
 */

const SNAP = 480;
const snaps = new Map<string, string>();
let snapper: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera } | null = null;
const BASE_YAW = 0.12;

function camera(aspect = 1): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(28, aspect, 0.1, 50);
  cam.position.set(2.1, 2.4, 7.3);
  cam.lookAt(0, 1.32, 0);
  return cam;
}

function snapshot(parts: LookParts): string | null {
  const key = lookKey(parts);
  const hit = snaps.get(key);
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
    const look = lookFromParts(parts);
    const c = buildCritter(look);
    c.group.rotation.y = BASE_YAW;
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
    snaps.set(key, url);
    return url;
  } catch {
    return null;
  }
}

interface Props {
  parts: LookParts;
  className?: string;
  live?: boolean;
  /** drop in from above with a wave, for the moment an agent is created */
  reveal?: boolean;
  /** 1–5: how bouncy it is (its appetite) */
  energy?: number;
  /** bump to make it spin once, e.g. when the dice are rolled */
  spin?: number;
}

export function AgentAvatar({ parts, className, live = false, reveal = false, energy = 3, spin = 0 }: Props) {
  const label = describeLook(lookFromParts(parts));
  if (live) return <LiveCritter parts={parts} reveal={reveal} energy={energy} spin={spin} className={className} label={label} />;
  return <StillCritter parts={parts} className={className} label={label} />;
}

function StillCritter({ parts, className, label }: { parts: LookParts; className?: string; label: string }) {
  const key = lookKey(parts);
  const [shot, setShot] = useState<{ key: string; src: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    // after paint, so a page of cards shows its text first
    const id = requestAnimationFrame(() => {
      const src = snapshot(parts);
      if (alive) setShot({ key, src });
    });
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
    // parts is described by key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const src = shot?.key === key ? shot.src : null;
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={label} title={label} draggable={false} className={cn("aspect-square select-none object-contain", className)} />
  ) : (
    <div role="img" aria-label={label} className={cn("aspect-square", className)} />
  );
}

interface Stage {
  scene: THREE.Scene;
  critter: Critter | null;
  shadow: THREE.Mesh | null;
  /** when the current outfit went on: drives the pop */
  swapAt: number;
  spinAt: number;
  energy: number;
  now: number;
}

function LiveCritter({ parts, reveal, energy, spin, className, label }: { parts: LookParts; reveal: boolean; energy: number; spin: number; className?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const key = lookKey(parts);

  // the renderer and the loop live as long as the component
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
    const cam = camera();
    const st: Stage = { scene: new THREE.Scene(), critter: null, shadow: null, swapAt: -10, spinAt: -10, energy: 3, now: 0 };
    stage.current = st;
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
    let yaw = BASE_YAW;
    let pitch = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      st.now = t;
      const c = st.critter;
      if (c) {
        const k = still ? 0 : 0.6 + st.energy * 0.25; // livelier when it is keener to buy
        // reveal: drop in from above, squash on landing, then a happy wave
        const drop = reveal && !still ? Math.max(0, 1 - t / 0.55) : 0;
        const land = reveal && !still && t > 0.55 && t < 0.9 ? Math.sin(((t - 0.55) / 0.35) * Math.PI) : 0;
        // a new outfit pops on: shrink a little and spring back
        const since = (t - st.swapAt) / 0.45;
        const pop = still || since >= 1 ? 1 : 0.82 + 0.18 * (1 + 2.70158 * Math.pow(since - 1, 3) + 1.70158 * Math.pow(since - 1, 2));
        const hop = still ? 0 : Math.max(0, Math.sin(t * 2.4 * k)) * 0.06 * Math.max(0, st.energy - 2);
        c.group.position.y = drop * drop * 4.5 + hop;
        c.group.scale.setScalar(pop);
        const breathe = still ? 0 : Math.sin(t * 2.4 * k) * 0.025;
        c.body.scale.set(1 + land * 0.12 - breathe, 1 - land * 0.18 + breathe, 1 + land * 0.12 - breathe);
        c.body.position.y = c.rest * (1 - land * 0.1) + (still ? 0 : Math.sin(t * 2.4 * k) * 0.03);
        yaw += (BASE_YAW + mx * 0.6 - yaw) * 0.08;
        pitch += (my * 0.15 - pitch) * 0.08;
        const spun = (t - st.spinAt) / 0.6;
        const twirl = still || spun >= 1 ? 0 : Math.PI * 2 * (1 - Math.pow(1 - spun, 3));
        c.group.rotation.y = yaw + twirl;
        c.body.rotation.x = pitch;
        const waving = reveal && t < 3;
        c.arms[1].rotation.z = still ? 0.9 : 0.9 + Math.sin(t * (waving ? 9 : 3 * k)) * (waving ? 0.5 : 0.18);
        c.arms[0].rotation.z = still ? 0 : -Math.sin(t * 2.4 * k) * 0.08 * k;
        // blink every few seconds
        const blink = !still && t % 3.7 > 3.58 ? 0.12 : 1;
        for (const e of c.eyes) e.scale.y = blink;
        if (c.spinner) c.spinner.rotation.y = still ? 0 : t * 6 * k;
      }
      renderer.render(st.scene, cam);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      if (st.critter) disposeTree(st.critter.group);
      if (st.shadow) disposeTree(st.shadow);
      stage.current = null;
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [reveal]);

  // a new look swaps the critter in place, without a new renderer
  useEffect(() => {
    const st = stage.current;
    if (!st) return;
    const look = lookFromParts(parts);
    if (st.critter) {
      st.scene.remove(st.critter.group);
      disposeTree(st.critter.group);
    }
    if (st.shadow) {
      st.scene.remove(st.shadow);
      disposeTree(st.shadow);
    }
    st.critter = buildCritter(look);
    st.shadow = groundShadow(look);
    st.scene.add(st.critter.group, st.shadow);
    st.swapAt = st.now;
    // parts is described by key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reveal]);

  useEffect(() => {
    if (stage.current) stage.current.energy = energy;
  }, [energy, reveal]);

  useEffect(() => {
    if (stage.current && spin > 0) stage.current.spinAt = stage.current.now;
  }, [spin]);

  return <div ref={ref} role="img" aria-label={label} className={cn("aspect-square", className)} />;
}
