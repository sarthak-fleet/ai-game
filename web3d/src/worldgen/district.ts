import type { Location, World } from "../../../src/types.ts";
import { locationPalette } from "../mapping/visuals.ts";
import {
  type BuildingModel,
  type DistrictModel,
  FLOOR_HEIGHT,
  type NpcSpawn,
  type PropKind,
  type PropModel,
  SIDEWALK_INSET,
  WORLD_SCALE,
} from "./model.ts";
import { interactablePlacementsFor, itemPlacementsFor, npcSpawnFor } from "./placements.ts";
import { pick, range, rngFor } from "./rng.ts";

interface RoleProfile {
  minFloors: number;
  maxFloors: number;
  density: number;
  props: PropKind[];
  trees: number;
}

const DEFAULT_PROFILE: RoleProfile = { minFloors: 1, maxFloors: 3, density: 0.8, props: ["lamp", "bench", "crate"], trees: 3 };

const ROLE_PROFILES: Array<{ pattern: RegExp; profile: RoleProfile }> = [
  { pattern: /urban|plaza|hub|city|square/i, profile: { minFloors: 2, maxFloors: 6, density: 0.9, props: ["lamp", "bench", "sign", "planter"], trees: 2 } },
  { pattern: /forge|training|engine|industrial|concrete/i, profile: { minFloors: 1, maxFloors: 2, density: 0.7, props: ["crate", "dummy", "lamp"], trees: 1 } },
  { pattern: /garden|home|apartment|wood|balcony/i, profile: { minFloors: 1, maxFloors: 3, density: 0.6, props: ["planter", "bench", "lamp"], trees: 7 } },
  { pattern: /inn|kiosk|counter|report|station|market/i, profile: { minFloors: 1, maxFloors: 2, density: 0.85, props: ["stall", "sign", "lamp", "crate"], trees: 2 } },
  { pattern: /bridge|overpass|ruin|threat|alley|monster/i, profile: { minFloors: 1, maxFloors: 4, density: 0.5, props: ["crate", "sign"], trees: 1 } },
];

const FOLIAGE_COLORS = ["#4e8f4a", "#5da55a", "#3f7e44", "#6fae5c"];

function profileFor(location: Location): RoleProfile {
  const text = `${location.name} ${location.visual?.role ?? ""} ${(location.visual?.visualTags ?? []).join(" ")}`;
  return ROLE_PROFILES.find((entry) => entry.pattern.test(text))?.profile ?? DEFAULT_PROFILE;
}

export function generateDistrict(world: World, location: Location): DistrictModel {
  const palette = locationPalette(location);
  const profile = profileFor(location);
  const origin = { x: location.x * WORLD_SCALE, z: location.y * WORLD_SCALE };
  const width = location.w * WORLD_SCALE;
  const depth = location.h * WORLD_SCALE;
  const center = { x: origin.x + width / 2, z: origin.z + depth / 2 };
  const courtyardRadius = Math.min(width, depth) * 0.28;

  const buildings = generateBuildings(world.id, location.id, origin, width, depth, palette, profile);
  const props = [
    ...generateProps(world.id, location.id, center, courtyardRadius, palette, profile),
    ...generateTrees(world.id, location.id, center, courtyardRadius, Math.min(width, depth) / 2, profile.trees),
  ];
  const courtyard = { x: center.x, z: center.z, radius: courtyardRadius };

  const items = itemPlacementsFor(world, courtyard, location.id);
  const interactables = interactablePlacementsFor(world, courtyard, location.id, palette.accent);
  const npcSpawns: NpcSpawn[] = world.npcs
    .filter((npc) => npc.locationId === location.id && npc.id !== world.player.characterId)
    .map((npc) => npcSpawnFor(npc.id, courtyard));

  return {
    locationId: location.id,
    name: location.name,
    palette,
    origin,
    width,
    depth,
    courtyard: { x: center.x, z: center.z, radius: courtyardRadius },
    buildings,
    props,
    items,
    interactables,
    npcSpawns,
    playerSpawn: { x: center.x, z: center.z + courtyardRadius * 0.5 },
  };
}

function generateBuildings(
  worldId: string,
  locationId: string,
  origin: { x: number; z: number },
  width: number,
  depth: number,
  palette: { structure: string; accent: string },
  profile: RoleProfile
): BuildingModel[] {
  const buildings: BuildingModel[] = [];
  const beltDepth = Math.min(7, Math.min(width, depth) * 0.22);
  const inner = {
    minX: origin.x + SIDEWALK_INSET,
    minZ: origin.z + SIDEWALK_INSET,
    maxX: origin.x + width - SIDEWALK_INSET,
    maxZ: origin.z + depth - SIDEWALK_INSET,
  };

  const edges: Array<{ name: string; length: number; horizontal: boolean; fixed: number; start: number }> = [
    { name: "north", length: inner.maxX - inner.minX, horizontal: true, fixed: inner.minZ + beltDepth / 2, start: inner.minX },
    { name: "south", length: inner.maxX - inner.minX, horizontal: true, fixed: inner.maxZ - beltDepth / 2, start: inner.minX },
    { name: "west", length: inner.maxZ - inner.minZ - beltDepth * 2, horizontal: false, fixed: inner.minX + beltDepth / 2, start: inner.minZ + beltDepth },
    { name: "east", length: inner.maxZ - inner.minZ - beltDepth * 2, horizontal: false, fixed: inner.maxX - beltDepth / 2, start: inner.minZ + beltDepth },
  ];

  for (const edge of edges) {
    const rng = rngFor(worldId, locationId, "edge", edge.name);
    const gateCenter = edge.length / 2;
    const gateHalfWidth = 4;
    let cursor = 0;
    let lot = 0;
    while (cursor < edge.length) {
      const lotWidth = Math.min(range(rng, 5.5, 9.5), edge.length - cursor);
      if (lotWidth < 4) break;
      const lotCenter = cursor + lotWidth / 2;
      const overlapsGate = Math.abs(lotCenter - gateCenter) < gateHalfWidth + lotWidth / 2 - 1;
      const skip = overlapsGate || rng() > profile.density;
      if (!skip) {
        const floors = Math.round(range(rng, profile.minFloors, profile.maxFloors));
        const buildingDepth = Math.min(beltDepth, range(rng, beltDepth * 0.7, beltDepth));
        const shade = range(rng, -0.18, 0.22);
        buildings.push({
          id: `${locationId}:${edge.name}:${lot}`,
          x: edge.horizontal ? edge.start + lotCenter : edge.fixed,
          z: edge.horizontal ? edge.fixed : edge.start + lotCenter,
          width: edge.horizontal ? lotWidth - 0.8 : buildingDepth,
          depth: edge.horizontal ? buildingDepth : lotWidth - 0.8,
          height: Math.max(1, floors) * FLOOR_HEIGHT + range(rng, 0, 1.2),
          bodyColor: shiftColor(palette.structure, shade),
          roofColor: shiftColor(palette.structure, -0.3),
          accentColor: palette.accent,
          floors,
          windows: floors >= 2,
        });
      }
      cursor += lotWidth;
      lot += 1;
    }
  }
  return buildings;
}

function generateProps(
  worldId: string,
  locationId: string,
  center: { x: number; z: number },
  courtyardRadius: number,
  palette: { structure: string; accent: string },
  profile: RoleProfile
): PropModel[] {
  const rng = rngFor(worldId, locationId, "props");
  const props: PropModel[] = [];
  const lampCount = 4;
  for (let index = 0; index < lampCount; index += 1) {
    const angle = (index / lampCount) * Math.PI * 2 + Math.PI / 4;
    props.push({
      id: `${locationId}:lamp:${index}`,
      kind: "lamp",
      x: center.x + Math.cos(angle) * courtyardRadius,
      z: center.z + Math.sin(angle) * courtyardRadius,
      rotationY: 0,
      color: shiftColor(palette.structure, -0.25),
      accentColor: "#ffe9b0",
    });
  }
  const extraCount = 5;
  for (let index = 0; index < extraCount; index += 1) {
    const kind = pick(rng, profile.props);
    const angle = rng() * Math.PI * 2;
    const distance = courtyardRadius * range(rng, 0.45, 1.25);
    props.push({
      id: `${locationId}:extra:${kind}:${index}`,
      kind,
      x: center.x + Math.cos(angle) * distance,
      z: center.z + Math.sin(angle) * distance,
      rotationY: rng() * Math.PI * 2,
      color: shiftColor(palette.structure, range(rng, -0.1, 0.25)),
      accentColor: palette.accent,
    });
  }
  return props;
}

function generateTrees(
  worldId: string,
  locationId: string,
  center: { x: number; z: number },
  courtyardRadius: number,
  plotHalfMin: number,
  count: number
): PropModel[] {
  const rng = rngFor(worldId, locationId, "trees");
  const trees: PropModel[] = [];
  const maxRadius = plotHalfMin - 8.5;
  if (maxRadius <= courtyardRadius + 1) return trees;
  for (let index = 0; index < count; index += 1) {
    const angle = rng() * Math.PI * 2;
    const distance = range(rng, courtyardRadius + 1, maxRadius);
    trees.push({
      id: `${locationId}:tree:${index}`,
      kind: "tree",
      x: center.x + Math.cos(angle) * distance,
      z: center.z + Math.sin(angle) * distance,
      rotationY: rng() * Math.PI * 2,
      color: pick(rng, FOLIAGE_COLORS),
      accentColor: "#6b4a32",
    });
  }
  return trees;
}

export function shiftColor(hex: string, amount: number): string {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  const channels = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff].map((channel) => {
    const next = amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(next)));
  });
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
