import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import type React from "react";
import { useVideoConfig } from "remotion";
import * as THREE from "three";
import { C } from "../theme";
import type { V3 } from "../lib/anim";

/** Applies the camera for this frame. Runs during render so it is always in sync with the frame. */
const Cam: React.FC<{ position: V3; target: V3; fov: number }> = ({ position, target, fov }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.position.set(...position);
  camera.fov = fov;
  camera.lookAt(...target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return null;
};

export const Stage: React.FC<{
  cam: V3;
  target: V3;
  fov?: number;
  bg?: string;
  ground?: string;
  children: React.ReactNode;
}> = ({ cam, target, fov = 36, bg = C.paper, ground = C.sand, children }) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas width={width} height={height} shadows flat dpr={1} gl={{ antialias: true }} style={{ position: "absolute", inset: 0 }}>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 22, 60]} />
      <Cam position={cam} target={target} fov={fov} />
      <ambientLight intensity={1.5} />
      <hemisphereLight args={["#ffffff", ground, 0.9]} />
      <directionalLight
        position={[7, 12, 8]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-camera-far={50}
        shadow-bias={-0.0004}
      />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[70, 48]} />
        <meshStandardMaterial color={ground} />
      </mesh>
      {children}
    </ThreeCanvas>
  );
};
