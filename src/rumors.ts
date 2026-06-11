import type { Memory, Npc, World } from "./types.ts";

/**
 * Information is alive: what NPCs hear travels, and what they learn changes
 * how they behave. Runs every tick (cheap, deterministic — no LLM), so the
 * world keeps scheming during offline catch-up too.
 *
 * Two passes:
 *  1. diffusion — co-located NPCs share their juiciest shareable memory
 *  2. revelation — leaked secrets get recognized; knowers shift relationships,
 *     moods, and goals (values like duty/justice can turn them against the holder)
 */

export interface RumorEvent {
  kind: "gossip_spread" | "secret_revealed" | "turned_against";
  actorId: string;
  aboutId?: string;
  text: string;
}

const MAX_SHARES_PER_TICK = 4;
const SHARE_MIN_IMPORTANCE = 2;
const CONFRONT_VALUES = /duty|justice|order|law|honor|protect|corps|loyal/i;

export function propagateInformation(world: World): RumorEvent[] {
  const events: RumorEvent[] = [];
  diffuseGossip(world, events);
  revealSecrets(world, events);
  return events;
}

// ---------------------------------------------------------------------------

function diffuseGossip(world: World, events: RumorEvent[]): void {
  let shares = 0;
  const byLocation = new Map<string, Npc[]>();
  for (const npc of world.npcs) {
    if (npc.combat?.defeated) continue;
    const list = byLocation.get(npc.locationId) ?? [];
    list.push(npc);
    byLocation.set(npc.locationId, list);
  }

  for (const group of byLocation.values()) {
    if (group.length < 2) continue;
    for (const teller of group) {
      if (shares >= MAX_SHARES_PER_TICK) return;
      const memory = juiciestShareable(teller, world.tick);
      if (!memory) continue;
      // tell one co-located NPC who hasn't heard it (round-robin by tick)
      const listeners = group.filter((other) => other.id !== teller.id && !knowsText(other, memory.text));
      if (listeners.length === 0) continue;
      const listener = listeners[world.tick % listeners.length]!;
      listener.memories.push({
        tick: world.tick,
        text: `${teller.name} told me: ${strip(memory.text)}`,
        meta: {
          sourceActorId: teller.id,
          visibility: "shared",
          importance: Math.max(1, (memory.meta?.importance ?? 2) - 1),
          tags: ["rumor"],
        },
      });
      shares += 1;
      events.push({
        kind: "gossip_spread",
        actorId: teller.id,
        aboutId: listener.id,
        text: `${teller.name} shares a rumor with ${listener.name}.`,
      });
    }
  }
}

/** the most recent shareable memory worth repeating (and not too stale) */
function juiciestShareable(npc: Npc, tick: number): Memory | null {
  for (let index = npc.memories.length - 1; index >= 0; index -= 1) {
    const memory = npc.memories[index]!;
    if ((memory.meta?.visibility ?? "private") === "private") continue;
    if ((memory.meta?.importance ?? 0) < SHARE_MIN_IMPORTANCE) continue;
    if (tick - memory.tick > 60) return null; // old news stops travelling
    return memory;
  }
  return null;
}

function knowsText(npc: Npc, text: string): boolean {
  const needle = strip(text).toLowerCase();
  return npc.memories.some((memory) => strip(memory.text).toLowerCase().includes(needle.slice(0, 80)));
}

function strip(text: string): string {
  return text.replace(/^[^:]{0,40}told me: /i, "").trim();
}

// ---------------------------------------------------------------------------

function significantWords(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4))];
}

function revealSecrets(world: World, events: RumorEvent[]): void {
  for (const holder of world.npcs) {
    for (const secret of holder.secrets ?? []) {
      const words = significantWords(secret.text);
      if (words.length < 2) continue;
      for (const other of world.npcs) {
        if (other.id === holder.id) continue;
        if (secret.knownBy?.includes(other.id)) continue;
        if (!recognizesSecret(other, words)) continue;

        secret.knownBy = [...(secret.knownBy ?? []), other.id];
        events.push({
          kind: "secret_revealed",
          actorId: other.id,
          aboutId: holder.id,
          text: `${other.name} has learned ${holder.name}'s secret.`,
        });
        applyRevelation(world, other, holder, secret.risk, events);
      }
    }
  }
}

/** enough of the secret's words appear in what this NPC has heard */
function recognizesSecret(npc: Npc, secretWords: string[], threshold = 0.5): boolean {
  const heard = npc.memories
    .slice(-40)
    .map((memory) => memory.text.toLowerCase())
    .join(" ");
  let hits = 0;
  for (const word of secretWords) if (heard.includes(word)) hits += 1;
  return hits >= Math.max(2, Math.ceil(secretWords.length * threshold));
}

function applyRevelation(world: World, knower: Npc, holder: Npc, risk: number, events: RumorEvent[]): void {
  const delta = risk >= 60 ? -3 : -1;
  knower.relationships = {
    ...knower.relationships,
    [holder.id]: Math.max(-10, (knower.relationships?.[holder.id] ?? 0) + delta),
  };
  const axes = knower.relationshipAxes?.[holder.id] ?? {};
  knower.relationshipAxes = {
    ...knower.relationshipAxes,
    [holder.id]: {
      ...axes,
      trust: Math.max(-10, (axes.trust ?? 0) - 3),
      suspicion: Math.min(10, (axes.suspicion ?? 0) + 3),
    },
  };
  if (knower.mood) {
    knower.mood.suspicion = Math.min(100, knower.mood.suspicion + 12);
    knower.mood.stress = Math.min(100, knower.mood.stress + 6);
  }
  knower.memories.push({
    tick: world.tick,
    text: `I have learned ${holder.name}'s secret. It changes things between us.`,
    meta: { importance: 3, visibility: "shared", sourceActorId: holder.id, tags: ["secret"] },
  });

  // principled NPCs act on dangerous secrets instead of sitting on them
  const values = (knower.traits?.values ?? []).join(" ");
  if (risk >= 60 && CONFRONT_VALUES.test(values)) {
    knower.relationships[holder.id] = Math.min(knower.relationships[holder.id] ?? 0, -4);
    knower.ambitions = [
      ...(knower.ambitions ?? []),
      {
        id: `${knower.id}_confront_${holder.id}_${world.tick}`,
        title: `Confront ${holder.name} about what I learned`,
        kind: "reveal",
        priority: 84,
        status: "active",
        targetId: holder.locationId,
      },
    ];
    events.push({
      kind: "turned_against",
      actorId: knower.id,
      aboutId: holder.id,
      text: `${knower.name} has turned against ${holder.name}.`,
    });
  }
}
