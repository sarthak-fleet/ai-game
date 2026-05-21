import * as THREE from "three";

import type { Item, Location, Npc, World } from "../../../src/types.ts";

const WORLD_SCALE = 0.018;
const MIN_BUILDING_HEIGHT = 0.45;

export interface SceneLocationNode {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  active: boolean;
}

export interface SceneActorNode {
  id: string;
  name: string;
  x: number;
  z: number;
  color: string;
  player: boolean;
  quest: boolean;
}

export interface SceneItemNode {
  id: string;
  name: string;
  x: number;
  z: number;
  color: string;
}

export interface WorldSceneModel {
  locations: SceneLocationNode[];
  actors: SceneActorNode[];
  items: SceneItemNode[];
  bounds: { width: number; depth: number };
  cameraTarget: { x: number; z: number };
}

export function buildWorldSceneModel(world: World): WorldSceneModel {
  const bounds = worldBounds(world.locations);
  const activeLocation = world.locations.find((location) => location.id === world.player.locationId) ?? world.locations[0];
  const locations = world.locations.map((location) => locationNode(location, world.player.locationId));
  const actors = [
    playerNode(world, activeLocation),
    ...world.npcs.map((npc) => actorNode(npc, world.locations.find((location) => location.id === npc.locationId))),
  ].filter((node): node is SceneActorNode => Boolean(node));
  const items = world.items
    .map((item) => itemNode(item, world.locations.find((location) => location.id === item.locationId)))
    .filter((node): node is SceneItemNode => Boolean(node));
  const target = activeLocation ? centerForLocation(activeLocation) : { x: 0, z: 0 };
  return {
    locations,
    actors,
    items,
    bounds,
    cameraTarget: target,
  };
}

export class ThreeWorldRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
  private readonly root = new THREE.Group();
  private frame = 0;
  private disposed = false;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x070a0f, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
    this.scene.add(this.root);
    this.scene.add(new THREE.HemisphereLight(0xcfe7ff, 0x222018, 1.7));
    const sun = new THREE.DirectionalLight(0xffe1a0, 2.2);
    sun.position.set(6, 10, 5);
    this.scene.add(sun);
    this.resize();
  }

  resize(): void {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width));
    const height = Math.max(240, Math.round(rect.height));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  renderWorld(world: World): void {
    const model = buildWorldSceneModel(world);
    this.root.clear();
    this.root.add(makeGround(model));
    for (const location of model.locations) this.root.add(makeLocationMesh(location));
    for (const item of model.items) this.root.add(makeItemMesh(item));
    for (const actor of model.actors) this.root.add(makeActorMesh(actor));
    this.camera.position.set(model.cameraTarget.x + 4.8, 6.4, model.cameraTarget.z + 7.2);
    this.camera.lookAt(model.cameraTarget.x, 0.25, model.cameraTarget.z);
    this.render();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  start(): void {
    const animate = () => {
      if (this.disposed) return;
      this.frame = requestAnimationFrame(animate);
      this.root.rotation.y = Math.sin(performance.now() / 5800) * 0.015;
      this.render();
    };
    animate();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) {
        for (const item of material) item.dispose();
      } else {
        material?.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function worldBounds(locations: Location[]): { width: number; depth: number } {
  const maxX = Math.max(...locations.map((location) => location.x + location.w), 1);
  const maxY = Math.max(...locations.map((location) => location.y + location.h), 1);
  return { width: maxX * WORLD_SCALE, depth: maxY * WORLD_SCALE };
}

function centerForLocation(location: Location): { x: number; z: number } {
  return {
    x: (location.x + location.w / 2) * WORLD_SCALE,
    z: (location.y + location.h / 2) * WORLD_SCALE,
  };
}

function locationNode(location: Location, activeLocationId: string): SceneLocationNode {
  const center = centerForLocation(location);
  const area = location.w * location.h;
  return {
    id: location.id,
    name: location.name,
    x: center.x,
    z: center.z,
    width: Math.max(0.9, location.w * WORLD_SCALE),
    depth: Math.max(0.72, location.h * WORLD_SCALE),
    height: MIN_BUILDING_HEIGHT + Math.min(1.6, area / 90_000),
    active: location.id === activeLocationId,
  };
}

function playerNode(world: World, location: Location | undefined): SceneActorNode | null {
  if (!location) return null;
  const center = centerForLocation(location);
  return {
    id: "player",
    name: world.player.name ?? "Player",
    x: center.x,
    z: center.z,
    color: world.player.appearance?.palette?.[0] ?? "#58a6ff",
    player: true,
    quest: false,
  };
}

function actorNode(npc: Npc, location: Location | undefined): SceneActorNode | null {
  if (!location) return null;
  const center = centerForLocation(location);
  const offset = stableOffset(npc.id, 0.42);
  return {
    id: npc.id,
    name: npc.name,
    x: center.x + offset.x,
    z: center.z + offset.z,
    color: npc.appearance?.palette?.[0] ?? (npc.tier === "quest" ? "#b5e48c" : "#ff8a65"),
    player: false,
    quest: npc.tier === "quest",
  };
}

function itemNode(item: Item, location: Location | undefined): SceneItemNode | null {
  if (!location || item.holderId) return null;
  const center = centerForLocation(location);
  const offset = stableOffset(item.id, 0.58);
  return {
    id: item.id,
    name: item.name,
    x: center.x + offset.x,
    z: center.z + offset.z,
    color: "#f8d44e",
  };
}

function stableOffset(id: string, radius: number): { x: number; z: number } {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const angle = (hash % 360) * Math.PI / 180;
  const scale = 0.45 + ((hash >> 8) % 40) / 100;
  return { x: Math.cos(angle) * radius * scale, z: Math.sin(angle) * radius * scale };
}

function makeGround(model: WorldSceneModel): THREE.Object3D {
  const geometry = new THREE.BoxGeometry(model.bounds.width + 2.4, 0.08, model.bounds.depth + 2.4);
  const material = new THREE.MeshStandardMaterial({ color: 0x172018, roughness: 0.9, metalness: 0.02 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(model.bounds.width / 2, -0.06, model.bounds.depth / 2);
  return mesh;
}

function makeLocationMesh(location: SceneLocationNode): THREE.Object3D {
  const group = new THREE.Group();
  const color = location.active ? 0x4a6fa5 : 0x273344;
  const geometry = new THREE.BoxGeometry(location.width, location.height, location.depth);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.74, metalness: 0.04 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(location.x, location.height / 2, location.z);
  group.add(mesh);

  const ring = new THREE.Mesh(
    new THREE.BoxGeometry(location.width + 0.08, 0.035, location.depth + 0.08),
    new THREE.MeshStandardMaterial({ color: location.active ? 0xf8d44e : 0x596477, roughness: 0.8 })
  );
  ring.position.set(location.x, 0.02, location.z);
  group.add(ring);
  return group;
}

function makeActorMesh(actor: SceneActorNode): THREE.Object3D {
  const radius = actor.player ? 0.18 : 0.14;
  const height = actor.player ? 0.72 : actor.quest ? 0.62 : 0.52;
  const geometry = new THREE.CapsuleGeometry(radius, height, 5, 10);
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(actor.color), roughness: 0.48 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = actor.name;
  mesh.position.set(actor.x, height / 2 + 0.16, actor.z);
  return mesh;
}

function makeItemMesh(item: SceneItemNode): THREE.Object3D {
  const geometry = new THREE.IcosahedronGeometry(0.11, 1);
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(item.color), emissive: 0x4a3300, roughness: 0.32 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = item.name;
  mesh.position.set(item.x, 0.24, item.z);
  return mesh;
}
