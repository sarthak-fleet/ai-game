const ACTION_TYPES = new Set(["move", "talk", "gossip", "confront", "remember"]);

export function cloneWorld(world) {
  return JSON.parse(JSON.stringify(world));
}

export function createEngine(world) {
  const state = cloneWorld(world);
  return {
    state,
    tick(playerAction) {
      return runTick(state, playerAction);
    },
    npc(id) {
      return getNpc(state, id);
    },
  };
}

export function runTick(world, playerAction) {
  const actions = [];
  const rejected = [];

  if (playerAction) {
    const result = applyAction(world, { ...playerAction, actorId: "player" });
    (result.applied ? actions : rejected).push(result);
  }

  const proposed = proposeNpcActions(world);
  for (const action of proposed) {
    const result = applyAction(world, action);
    (result.applied ? actions : rejected).push(result);
  }

  world.tick += 1;
  const summary = summarizeTick(world, actions, rejected);
  world.eventLog.push(summary);
  return summary;
}

export function applyAction(world, action) {
  const validation = validateAction(world, action);
  if (!validation.ok) {
    return { applied: false, action, reason: validation.reason };
  }

  switch (action.type) {
    case "move":
      if (action.actorId === "player") {
        world.player = { ...(world.player ?? {}), locationId: action.locationId };
      } else {
        getNpc(world, action.actorId).locationId = action.locationId;
      }
      return applied(action, `${nameOf(world, action.actorId)} moved to ${locationName(world, action.locationId)}.`);
    case "talk":
      remember(world, action.targetId, `${nameOf(world, action.actorId)} said: ${action.text}`);
      remember(world, action.actorId, `Told ${nameOf(world, action.targetId)}: ${action.text}`);
      return applied(action, `${nameOf(world, action.actorId)} spoke with ${nameOf(world, action.targetId)}.`);
    case "gossip":
      remember(world, action.targetId, `${nameOf(world, action.actorId)} shared a rumor: ${action.text}`);
      adjustRelationship(world, action.actorId, action.aboutId, -1);
      adjustRelationship(world, action.targetId, action.aboutId, -1);
      return applied(action, `${nameOf(world, action.actorId)} gossiped to ${nameOf(world, action.targetId)} about ${nameOf(world, action.aboutId)}.`);
    case "confront":
      remember(world, action.targetId, `${nameOf(world, action.actorId)} confronted you: ${action.text}`);
      remember(world, action.actorId, `Confronted ${nameOf(world, action.targetId)}: ${action.text}`);
      adjustRelationship(world, action.actorId, action.targetId, -2);
      adjustRelationship(world, action.targetId, action.actorId, -1);
      return applied(action, `${nameOf(world, action.actorId)} confronted ${nameOf(world, action.targetId)}.`);
    case "remember":
      remember(world, action.actorId, action.text);
      return applied(action, `${nameOf(world, action.actorId)} remembered something new.`);
    default:
      return { applied: false, action, reason: "Unsupported action type." };
  }
}

export function validateAction(world, action) {
  if (!action || typeof action !== "object") return invalid("Action must be an object.");
  if (!ACTION_TYPES.has(action.type)) return invalid("Unsupported action type.");
  if (action.actorId !== "player" && !getNpc(world, action.actorId)) return invalid("Unknown actor.");
  if (["talk", "gossip", "confront"].includes(action.type) && !getNpc(world, action.targetId)) return invalid("Unknown target.");
  if (action.type === "gossip" && !getNpc(world, action.aboutId)) return invalid("Unknown gossip subject.");
  if (action.type === "move" && !world.locations.some((location) => location.id === action.locationId)) return invalid("Unknown location.");
  if (["talk", "gossip", "confront", "remember"].includes(action.type) && typeof action.text !== "string") return invalid("Text is required.");
  return { ok: true };
}

export function retrieveMemories(world, npcId, query, limit = 3) {
  const npc = getNpc(world, npcId);
  if (!npc) return [];
  const terms = String(query).toLowerCase().split(/\W+/).filter(Boolean);
  return [...npc.memories]
    .map((memory) => ({
      ...memory,
      score: terms.reduce((score, term) => score + (memory.text.toLowerCase().includes(term) ? 1 : 0), 0),
    }))
    .filter((memory) => memory.score > 0)
    .sort((a, b) => b.score - a.score || b.tick - a.tick)
    .slice(0, limit);
}

export function proposeNpcActions(world) {
  const actions = [];
  const mira = getNpc(world, "mira");
  const tomas = getNpc(world, "tomas");
  const orrin = getNpc(world, "orrin");
  const pax = getNpc(world, "pax");

  if (world.tick === 0 && mira && tomas) {
    actions.push({
      type: "confront",
      actorId: "mira",
      targetId: "tomas",
      text: "The garden tools went missing after you borrowed them.",
    });
  }

  if (world.tick === 0 && orrin && pax) {
    actions.push({
      type: "gossip",
      actorId: "orrin",
      targetId: "lena",
      aboutId: "pax",
      text: "Pax may know why the notice board keeps losing trinkets.",
    });
  }

  if (world.tick > 0 && tomas?.relationships?.mira < 0) {
    actions.push({
      type: "remember",
      actorId: "tomas",
      text: "Mira is angry about the missing tools; return them before asking for herbs.",
    });
  }

  return actions;
}

function applied(action, text) {
  return { applied: true, action, text };
}

function invalid(reason) {
  return { ok: false, reason };
}

function remember(world, npcId, text) {
  const npc = getNpc(world, npcId);
  if (!npc) return;
  npc.memories.push({ tick: world.tick, text });
}

function adjustRelationship(world, fromId, toId, delta) {
  const npc = getNpc(world, fromId);
  if (!npc) return;
  npc.relationships[toId] = (npc.relationships[toId] ?? 0) + delta;
}

function summarizeTick(world, actions, rejected) {
  return {
    tick: world.tick,
    actions: actions.map(({ action, text }) => ({ action, text })),
    rejected: rejected.map(({ action, reason }) => ({ action, reason })),
    checksum: checksum(world),
  };
}

function checksum(world) {
  const stable = JSON.stringify({
    tick: world.tick,
    npcs: world.npcs.map((npc) => ({
      id: npc.id,
      locationId: npc.locationId,
      relationships: Object.fromEntries(Object.entries(npc.relationships).sort()),
      memoryCount: npc.memories.length,
    })),
    player: world.player ?? null,
  });
  let hash = 0;
  for (let i = 0; i < stable.length; i += 1) hash = (hash * 31 + stable.charCodeAt(i)) >>> 0;
  return hash.toString(16).padStart(8, "0");
}

function getNpc(world, id) {
  return world.npcs.find((npc) => npc.id === id);
}

function nameOf(world, id) {
  if (id === "player") return "Player";
  return getNpc(world, id)?.name ?? id;
}

function locationName(world, id) {
  return world.locations.find((location) => location.id === id)?.name ?? id;
}
