import type { Location, Npc, World } from "./types.ts";

export interface StoryPhaseLocations {
  hubId: string;
  reportId: string;
}

export function storyPhaseLocations(world: World): StoryPhaseLocations {
  const hubId = world.locations[0]?.id ?? world.player.locationId;
  const reportId = world.locations.find((location) => /report|station|kiosk|counter/i.test(location.visual?.role ?? ""))?.id
    ?? world.locations[3]?.id
    ?? hubId;
  return { hubId, reportId };
}

export function storyConfrontationTargetId(world: World): string {
  if (world.id === "opm_z_city" && hasNpc(world, "pax")) return "pax";
  if (world.id === "ashbend" && hasNpc(world, "lena")) return "lena";
  return world.villainPlans?.find((plan) => hasNpc(world, plan.actorId))?.actorId
    ?? world.quests?.[2]?.giverId
    ?? world.npcs.at(-1)?.id
    ?? "";
}

export function storyWitnessNpc(world: World): Npc | undefined {
  return npcById(world, world.quests?.[2]?.giverId ?? "") ?? npcById(world, storyConfrontationTargetId(world));
}

export function locationById(world: World, id: string): Location | undefined {
  return world.locations.find((location) => location.id === id);
}

export function npcById(world: World, id: string): Npc | undefined {
  return world.npcs.find((npc) => npc.id === id);
}

function hasNpc(world: World, id: string): boolean {
  return Boolean(npcById(world, id));
}
