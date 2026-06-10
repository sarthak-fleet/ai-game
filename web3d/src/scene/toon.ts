import * as THREE from "three";

let gradientMap: THREE.DataTexture | null = null;

export function toonGradientMap(): THREE.DataTexture {
  if (gradientMap) return gradientMap;
  const steps = new Uint8Array([135, 200, 255]);
  gradientMap = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

const materialCache = new Map<string, THREE.MeshToonMaterial>();

export function toonMaterial(color: string, emissive?: string): THREE.MeshToonMaterial {
  const key = `${color}:${emissive ?? ""}`;
  const cached = materialCache.get(key);
  if (cached) return cached;
  const material = new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap: toonGradientMap(),
    ...(emissive ? { emissive: new THREE.Color(emissive), emissiveIntensity: 0.55 } : {}),
  });
  materialCache.set(key, material);
  return material;
}
