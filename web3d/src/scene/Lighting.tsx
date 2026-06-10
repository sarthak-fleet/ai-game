import { useMemo } from "react";
import * as THREE from "three";

import type { World } from "../../../src/types.ts";
import { type SceneMood, sceneMoodForClock } from "../mapping/mood.ts";

export function Lighting({ world, target }: { world: World; target: { x: number; z: number } }) {
  const mood: SceneMood = useMemo(() => sceneMoodForClock(world), [world]);
  const sunTarget = useMemo(() => new THREE.Object3D(), []);

  return (
    <>
      <color attach="background" args={[mood.skyColor]} />
      <fogExp2 attach="fog" args={[mood.fogColor, mood.fogDensity]} />
      <ambientLight intensity={0.5} color="#ffffff" />
      <hemisphereLight args={[mood.hemisphereSky, mood.hemisphereGround, mood.hemisphereIntensity * 1.4]} />
      <primitive object={sunTarget} position={[target.x, 0, target.z]} />
      <directionalLight
        color={mood.sunColor}
        intensity={mood.sunIntensity}
        position={[target.x + mood.sunPosition.x * 0.4, mood.sunPosition.y * 0.6, target.z + mood.sunPosition.z * 0.4]}
        target={sunTarget}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
      />
    </>
  );
}
