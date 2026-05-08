import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyAction, createEngine, retrieveMemories, validateAction } from "../src/simulation.mjs";

const fixture = () => JSON.parse(readFileSync(new URL("../worlds/village.json", import.meta.url), "utf8"));

test("validates and rejects malformed proposed actions", () => {
  const world = fixture();
  assert.equal(validateAction(world, { type: "dance", actorId: "mira" }).ok, false);

  const result = applyAction(world, { type: "gossip", actorId: "mira", targetId: "lena", aboutId: "ghost", text: "boo" });
  assert.equal(result.applied, false);
  assert.equal(result.reason, "Unknown gossip subject.");
});

test("player actions create memories retrievable by later dialogue context", () => {
  const engine = createEngine(fixture());
  engine.tick({ type: "talk", targetId: "lena", text: "The bridge is unsafe after sundown." });

  const memories = retrieveMemories(engine.state, "lena", "bridge unsafe");
  assert.ok(memories.some((memory) => /bridge is unsafe/.test(memory.text)));
});

test("npc confrontation changes relationship state", () => {
  const engine = createEngine(fixture());
  engine.tick();

  assert.equal(engine.npc("mira").relationships.tomas, -2);
  assert.equal(engine.npc("tomas").relationships.mira, -1);
});

test("gossip emerges from initial world state and changes third-party trust", () => {
  const engine = createEngine(fixture());
  const event = engine.tick();

  assert.ok(event.actions.some((entry) => entry.action.type === "gossip" && entry.action.aboutId === "pax"));
  assert.equal(engine.npc("lena").relationships.pax, -1);
  assert.equal(engine.npc("orrin").relationships.pax, -2);
});

test("tick summaries include rejected invalid LLM-like output and stable checksums", () => {
  const engine = createEngine(fixture());
  const event = engine.tick({ type: "move", actorId: "mira", locationId: "moon" });

  assert.equal(event.rejected.length, 1);
  assert.equal(event.rejected[0].reason, "Unknown location.");
  assert.match(event.checksum, /^[0-9a-f]{8}$/);
});
