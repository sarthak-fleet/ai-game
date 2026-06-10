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
  /** building this door belongs to */
  buildingId: string;
  districtId: string;
  /** world-space position of the exterior door (interaction point) */
  x: number;
  z: number;
  label: string;
  /** player exits toward this point (just outside the door) */
  outsideX: number;
  outsideZ: number;
}

export interface InteriorModel {
  buildingId: string;
  districtId: string;
  label: string;
  origin: { x: number; z: number };
  width: number;
  depth: number;
  wallHeight: number;
  floorColor: string;
  wallColor: string;
  accentColor: string;
  spawn: { x: number; z: number };
  exit: { x: number; z: number };
  furniture: FurnitureModel[];
}

const WALL_HEIGHT = 3.2;
const ROOM_MARGIN_FROM_CITY = 120;

interface FurniturePlan {
  kinds: FurnitureKind[];
  extra: FurnitureKind[];
  wallTint: string;
  names: string[];
}

const ROLE_FURNITURE: Array<{ pattern: RegExp; plan: FurniturePlan }> = [
  {
    pattern: /inn|kiosk|counter|report|station|market/i,
    plan: {
      kinds: ["counter", "table", "chair", "chair", "hearth", "shelf", "rug", "table", "barrel"],
      extra: ["barrel", "plant", "chair"],
      wallTint: "#8a6a4a",
      names: ["Common Hall", "Tavern Rooms", "Guest House", "Trading Post", "Counter Room"],
    },
  },
  {
    pattern: /forge|training|engine|industrial|concrete/i,
    plan: {
      kinds: ["anvil", "hearth", "table", "crate", "crate", "barrel", "shelf"],
      extra: ["crate", "barrel"],
      wallTint: "#4a4440",
      names: ["Workshop", "Tool Shed", "Smelting Room", "Storage Bay", "Machine Shop"],
    },
  },
  {
    pattern: /garden|home|apartment|wood|balcony/i,
    plan: {
      kinds: ["bed", "table", "chair", "rug", "shelf", "plant"],
      extra: ["plant", "chair"],
      wallTint: "#9a8468",
      names: ["Cottage", "Apartment", "Family Home", "Garden House", "Loft"],
    },
  },
  {
    pattern: /bridge|overpass|ruin|threat|alley|monster/i,
    plan: {
      kinds: ["crate", "crate", "barrel", "table"],
      extra: ["crate"],
      wallTint: "#52565e",
      names: ["Abandoned Room", "Squatter Den", "Storage Ruin", "Boarded House"],
    },
  },
];

const DEFAULT_PLAN: FurniturePlan = {
  kinds: ["table", "chair", "shelf", "rug", "plant"],
  extra: ["chair", "crate"],
  wallTint: "#7a7468",
  names: ["House", "Office", "Workroom", "Quarters", "Den"],
};

function planFor(district: DistrictModel): FurniturePlan {
  return ROLE_FURNITURE.find((entry) => entry.pattern.test(district.roleText))?.plan ?? DEFAULT_PLAN;
}

function doorFaceFor(district: DistrictModel, building: BuildingModel): { x: number; z: number; outsideX: number; outsideZ: number } {
  const dx = district.courtyard.x - building.x;
  const dz = district.courtyard.z - building.z;
  if (Math.abs(dx) > Math.abs(dz)) {
    const x = building.x + (Math.sign(dx) * building.width) / 2;
    return { x, z: building.z, outsideX: x + Math.sign(dx) * 1.4, outsideZ: building.z };
  }
  const z = building.z + (Math.sign(dz) * building.depth) / 2;
  return { x: building.x, z, outsideX: building.x, outsideZ: z + Math.sign(dz) * 1.4 };
}

/** Every building in every district is enterable. */
export function generateDoors(model: Pick<WorldModel, "districts">): InteriorDoor[] {
  const doors: InteriorDoor[] = [];
  for (const district of model.districts) {
    const plan = planFor(district);
    district.buildings.forEach((building, index) => {
      const face = doorFaceFor(district, building);
      const name = plan.names[index % plan.names.length]!;
      const suffix = index >= plan.names.length ? ` ${Math.floor(index / plan.names.length) + 1}` : "";
      doors.push({
        buildingId: building.id,
        districtId: district.locationId,
        label: `the ${name}${suffix}`,
        ...face,
      });
    });
  }
  return doors;
}

const interiorCache = new Map<string, InteriorModel>();

/**
 * On-demand interior generation: only the active room is ever mounted, so the
 * whole city can be enterable without paying for hundreds of live rooms. The
 * room is deterministic per building and always materializes at the same
 * staging spot south of the city.
 */
export function interiorForBuilding(world: World, model: WorldModel, buildingId: string): InteriorModel | null {
  const cacheKey = `${world.id}:${buildingId}`;
  const cached = interiorCache.get(cacheKey);
  if (cached) return cached;

  const district = model.districts.find((entry) => entry.buildings.some((building) => building.id === buildingId));
  const building = district?.buildings.find((entry) => entry.id === buildingId);
  const door = model.doors.find((entry) => entry.buildingId === buildingId);
  if (!district || !building || !door) return null;

  const plan = planFor(district);
  const rng = rngFor(world.id, buildingId, "interior");

  // room scales with the building footprint
  const width = clamp(building.width * 1.6, 9, 18);
  const depth = clamp(building.depth * 1.7, 8, 13);
  const origin = { x: model.bounds.minX, z: model.bounds.maxZ + ROOM_MARGIN_FROM_CITY };
  const exit = { x: origin.x + width / 2, z: origin.z + depth - 0.6 };
  const spawn = { x: exit.x, z: exit.z - 1.6 };

  const furniture: FurnitureModel[] = [];
  const slots = shuffledSlots(rng, origin, width, depth);
  const kindCount = Math.max(3, Math.round((width * depth) / 22));
  const kinds = [...plan.kinds].slice(0, kindCount);
  if (rng() > 0.5) kinds.push(pick(rng, plan.extra));
  kinds.forEach((kind, kindIndex) => {
    const slot = slots[kindIndex];
    if (!slot) return;
    furniture.push({
      id: `${buildingId}:furniture:${kindIndex}`,
      kind,
      x: slot.x,
      z: slot.z,
      rotationY: slot.rotationY + range(rng, -0.15, 0.15),
      color: district.palette.structure,
      accentColor: district.palette.accent,
    });
  });

  const interior: InteriorModel = {
    buildingId,
    districtId: district.locationId,
    label: door.label,
    origin,
    width,
    depth,
    wallHeight: WALL_HEIGHT,
    floorColor: shiftHex(district.palette.ground, 0.32),
    wallColor: blendHex(shiftHex(district.palette.structure, 0.18), plan.wallTint, 0.45),
    accentColor: district.palette.accent,
    spawn,
    exit,
    furniture,
  };
  interiorCache.set(cacheKey, interior);
  if (interiorCache.size > 24) {
    const oldest = interiorCache.keys().next().value;
    if (oldest) interiorCache.delete(oldest);
  }
  return interior;
}

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
