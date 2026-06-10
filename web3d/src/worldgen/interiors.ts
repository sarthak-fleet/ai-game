import type { World } from "../../../src/types.ts";
import type { BuildingModel, DistrictModel, WorldModel } from "./model.ts";
import { pick, range, rngFor } from "./rng.ts";

export type FurnitureKind =
  | "bed"
  | "table"
  | "chair"
  | "counter"
  | "shelf"
  | "rug"
  | "hearth"
  | "anvil"
  | "barrel"
  | "crate"
  | "plant";

export interface FurnitureModel {
  id: string;
  kind: FurnitureKind;
  x: number;
  z: number;
  rotationY: number;
  color: string;
  accentColor: string;
}

export interface InteriorDoor {
  districtId: string;
  /** world-space position of the exterior door (interaction point) */
  x: number;
  z: number;
  /** label, e.g. "the Lantern Inn" */
  label: string;
  /** facing the courtyard: player exits toward this point */
  outsideX: number;
  outsideZ: number;
}

export interface InteriorModel {
  districtId: string;
  label: string;
  /** world-space rect of the room (placed far from the city) */
  origin: { x: number; z: number };
  width: number;
  depth: number;
  wallHeight: number;
  floorColor: string;
  wallColor: string;
  accentColor: string;
  /** player spawn just inside the exit door */
  spawn: { x: number; z: number };
  /** interior exit-door interaction point */
  exit: { x: number; z: number };
  furniture: FurnitureModel[];
}

const WALL_HEIGHT = 3.2;
const ROOM_SPACING = 40;
const ROOM_MARGIN_FROM_CITY = 120;

interface FurniturePlan {
  kinds: FurnitureKind[];
  extra: FurnitureKind[];
  /** room footprint in meters — every role gets a distinct floor plan */
  width: number;
  depth: number;
  /** lerp the wall color toward this tint for role identity */
  wallTint: string;
}

const ROLE_FURNITURE: Array<{ pattern: RegExp; plan: FurniturePlan }> = [
  // tavern hall: big and busy
  {
    pattern: /inn|kiosk|counter|report|station|market/i,
    plan: { kinds: ["counter", "table", "chair", "chair", "hearth", "shelf", "rug", "table", "barrel"], extra: ["barrel", "plant", "chair"], width: 18, depth: 13, wallTint: "#8a6a4a" },
  },
  // workshop: wide and soot-dark
  {
    pattern: /forge|training|engine|industrial|concrete/i,
    plan: { kinds: ["anvil", "hearth", "table", "crate", "crate", "barrel", "shelf"], extra: ["crate", "barrel"], width: 16, depth: 11, wallTint: "#4a4440" },
  },
  // home: small and cozy
  {
    pattern: /garden|home|apartment|wood|balcony/i,
    plan: { kinds: ["bed", "table", "chair", "rug", "shelf", "plant"], extra: ["plant", "chair"], width: 11, depth: 9, wallTint: "#9a8468" },
  },
  // ruin: cramped and bare
  {
    pattern: /bridge|overpass|ruin|threat|alley|monster/i,
    plan: { kinds: ["crate", "crate", "barrel", "table"], extra: ["crate"], width: 12, depth: 9, wallTint: "#52565e" },
  },
];

const DEFAULT_PLAN: FurniturePlan = { kinds: ["table", "chair", "shelf", "rug", "plant"], extra: ["chair", "crate"], width: 14, depth: 11, wallTint: "#7a7468" };

function planFor(district: DistrictModel): FurniturePlan {
  return ROLE_FURNITURE.find((entry) => entry.pattern.test(district.roleText))?.plan ?? DEFAULT_PLAN;
}

export function anchorBuilding(district: DistrictModel): BuildingModel | null {
  let best: BuildingModel | null = null;
  for (const building of district.buildings) {
    if (!best || building.width * building.depth > best.width * best.depth) best = building;
  }
  return best;
}

export function interiorDoorFor(district: DistrictModel): InteriorDoor | null {
  const building = anchorBuilding(district);
  if (!building) return null;
  const dx = district.courtyard.x - building.x;
  const dz = district.courtyard.z - building.z;
  let x = building.x;
  let z = building.z;
  let outsideX = x;
  let outsideZ = z;
  if (Math.abs(dx) > Math.abs(dz)) {
    x += (Math.sign(dx) * building.width) / 2;
    outsideX = x + Math.sign(dx) * 1.4;
    outsideZ = z;
  } else {
    z += (Math.sign(dz) * building.depth) / 2;
    outsideZ = z + Math.sign(dz) * 1.4;
    outsideX = x;
  }
  return { districtId: district.locationId, x, z, label: `the ${district.name}`, outsideX, outsideZ };
}

export function generateInteriors(world: World, model: WorldModel): { interiors: InteriorModel[]; doors: InteriorDoor[] } {
  const interiors: InteriorModel[] = [];
  const doors: InteriorDoor[] = [];
  model.districts.forEach((district, index) => {
    const door = interiorDoorFor(district);
    if (!door) return;
    doors.push(door);

    const rng = rngFor(world.id, district.locationId, "interior");
    const plan = planFor(district);
    const origin = {
      x: model.bounds.minX + index * ROOM_SPACING,
      z: model.bounds.maxZ + ROOM_MARGIN_FROM_CITY,
    };
    const exit = { x: origin.x + plan.width / 2, z: origin.z + plan.depth - 0.6 };
    const spawn = { x: exit.x, z: exit.z - 1.6 };

    const furniture: FurnitureModel[] = [];
    const slots = shuffledSlots(rng, origin, plan.width, plan.depth);
    const kinds = [...plan.kinds];
    if (rng() > 0.5) kinds.push(pick(rng, plan.extra));
    kinds.forEach((kind, kindIndex) => {
      const slot = slots[kindIndex];
      if (!slot) return;
      furniture.push({
        id: `${district.locationId}:furniture:${kindIndex}`,
        kind,
        x: slot.x,
        z: slot.z,
        rotationY: slot.rotationY + range(rng, -0.15, 0.15),
        color: district.palette.structure,
        accentColor: district.palette.accent,
      });
    });

    interiors.push({
      districtId: district.locationId,
      label: `the ${district.name}`,
      origin,
      width: plan.width,
      depth: plan.depth,
      wallHeight: WALL_HEIGHT,
      floorColor: shiftHex(district.palette.ground, 0.32),
      wallColor: blendHex(shiftHex(district.palette.structure, 0.18), plan.wallTint, 0.45),
      accentColor: district.palette.accent,
      spawn,
      exit,
      furniture,
    });
  });
  return { interiors, doors };
}

/** Perimeter/feature slots scaled to the room; spawn lane (door column) stays clear. */
function shuffledSlots(
  rng: () => number,
  origin: { x: number; z: number },
  width: number,
  depth: number
): Array<{ x: number; z: number; rotationY: number }> {
  const slots = [
    { x: origin.x + 2.2, z: origin.z + 2.2, rotationY: Math.PI / 4 },
    { x: origin.x + width - 2.2, z: origin.z + 2.2, rotationY: -Math.PI / 4 },
    { x: origin.x + 2, z: origin.z + depth / 2, rotationY: Math.PI / 2 },
    { x: origin.x + width - 2, z: origin.z + depth / 2, rotationY: -Math.PI / 2 },
    { x: origin.x + width / 2, z: origin.z + 1.8, rotationY: 0 },
    { x: origin.x + width / 2 - width * 0.22, z: origin.z + depth / 2 + 1, rotationY: 0.3 },
    { x: origin.x + width / 2 + width * 0.22, z: origin.z + depth / 2 + 1, rotationY: -0.3 },
    { x: origin.x + 2.4, z: origin.z + depth - 2.6, rotationY: Math.PI * 0.75 },
    { x: origin.x + width - 2.4, z: origin.z + depth - 2.6, rotationY: -Math.PI * 0.75 },
    // large rooms expose two more mid-floor slots
    ...(width >= 16
      ? [
          { x: origin.x + width * 0.3, z: origin.z + depth * 0.62, rotationY: 0.6 },
          { x: origin.x + width * 0.7, z: origin.z + depth * 0.62, rotationY: -0.6 },
        ]
      : []),
  ];
  for (let index = slots.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [slots[index], slots[swap]] = [slots[swap]!, slots[index]!];
  }
  return slots;
}

function blendHex(from: string, to: string, t: number): string {
  const a = Number.parseInt(from.replace("#", ""), 16);
  const b = Number.parseInt(to.replace("#", ""), 16);
  const channels = [16, 8, 0].map((shift) => {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * t);
  });
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function shiftHex(hex: string, amount: number): string {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  const channels = [16, 8, 0].map((shift) => {
    const channel = (value >> shift) & 0xff;
    const next = amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(next)));
  });
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
