import { readFileSync } from "node:fs";
import { createEngine } from "./simulation.mjs";

const world = JSON.parse(readFileSync(new URL("../worlds/village.json", import.meta.url), "utf8"));
const engine = createEngine(world);

console.log(`Entering ${engine.state.name}`);
console.log(engine.tick({ type: "talk", targetId: "lena", text: "I heard trouble near the bridge." }));
console.log(engine.tick({ type: "move", locationId: "garden" }));
