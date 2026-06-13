# New things to learn — ai-game

Technologies and patterns that were genuinely new during this build, with one-line stubs. See linked docs for depth.

---

## React Three Fiber (R3F)
- What: Declarative React bindings for Three.js — scenes as JSX, lifecycle as hooks.
- Why here: TBD
- Gotcha (from code): NPC position prop must stay constant; movement writes imperatively to `node.position` inside `useFrame` — a reactive `position` prop would teleport the node on every sim relocation (`web3d/src/characters/Npc.tsx:77-78`).
- Source: https://docs.pmnd.rs/react-three-fiber | See ../web3d-architecture.md §"Sim ↔ client sync"

## @react-three/rapier (Rapier physics)
- What: WASM Rapier physics engine with a first-class R3F binding — kinematic character controller, colliders.
- Why here: TBD
- Gotcha (from code): NPCs have no Rapier rigid bodies (visual-only — `Npc.tsx` imports no rapier), so melee hit detection uses distance thresholds (`MELEE_RANGE`, `STANCE_RANGE`) against the NPC position registry (`web3d/src/combat/pacing.ts`), not sensor colliders.
- Source: https://github.com/pmndrs/react-three-rapier | See ../web3d-architecture.md §"Combat"

## Cloudflare Durable Objects (DO)
- What: Actor-model stateful compute at the edge — one JS instance per entity, hibernates when idle, re-hydrates from SQLite storage on the next request.
- Why here: TBD
- Gotcha (from code): Instance-field state is gone after hibernation; `ensureEngine()` lazily re-hydrates from `ctx.storage.get("world")` on every first request (`worker/src/session-do.ts:76-104`). Any field set only in the constructor is lost between hibernations.
- Source: https://developers.cloudflare.com/durable-objects/

## Cloudflare service bindings (same-account Worker-to-Worker)
- What: Internal routing between Workers on the same account without going over the public internet.
- Why here: TBD
- Gotcha (from code): Same-account Workers cannot call each other over `workers.dev` URLs — direct fetches are blocked (`wrangler.jsonc:18-19` comment). The `GATEWAY` service binding (`wrangler.jsonc:20`) is required; LLM fetch is redirected through it at `worker/src/session-do.ts:68-73`.
- Source: https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/

## DO SQLite debounced persist
- What: Pattern for batching Durable Object storage writes so only the latest snapshot persists when ticks fire in a burst.
- Why here: TBD
- Gotcha (from code): Writing world JSON on every 4 s tick saturates the DO SQLite write budget; `PERSIST_DEBOUNCE_MS = 5_000` at `worker/src/session-do.ts:36` coalesces burst writes via a `setTimeout`-based debounce (lines 107-115).
- Source: https://developers.cloudflare.com/durable-objects/api/storage-api/

## LLM agent loop — interval polling
- What: `setInterval`-driven tick loop with a `stepping` flag to prevent re-entrant LLM calls.
- Why here: TBD
- Gotcha (from code): Under model latency the loop naturally self-throttles — `stepping` flag at `src/agent-loop.ts:61` throws `agent_loop_step_in_progress` if a tick is already in flight (line 96). Minimum interval hard-clamped to 250 ms at line 51 to prevent runaway in tests.
- Source: See retros/2026-06-12-single-to-cf-worker.md

## OpenAI-compatible endpoint abstraction + tiered model selection
- What: Single `router.ts` speaking the OpenAI chat completions shape; backends (Ollama, LM Studio, DeepSeek, gateway) swapped via env vars.
- Why here: TBD
- Gotcha (from code): Reasoning models need `LLM_NO_THINK=1` — when set, the system prompt appends "Do not include chain-of-thought" and the user turn gets `/no_think` suffix (`src/llm/router.ts:103,117,119`). Without this, `<think>` tokens in the reply break JSON extraction.
- Source: https://platform.openai.com/docs/api-reference/chat | See ../local-llm.md

## Structured JSON actions (LLM proposes, engine validates)
- What: Every LLM response is parsed as a typed action object, validated against world state, and rejected if invalid — the LLM never writes directly to state.
- Why here: TBD
- Source: See ../ai-dungeon-differentiation.md §"Differentiation Pillars"

## Prompt format — JSON-in-reply without function-calling API
- What: System prompt carries persona + world context; model is asked to append a JSON block to its natural-language reply; the router extracts the last JSON object.
- Why here: TBD
- Gotcha (from code): OpenAI function-calling and structured-output APIs are not universally supported across local-model backends; JSON-in-reply works on all OpenAI-compatible endpoints but requires retry + fallback for malformed output.
- Source: See external-references.md

## Deterministic worldgen with seeded PRNG
- What: `rngFor(...parts)` (= `mulberry32(seedFromString(parts.join(":")))`) as the sole randomness source — every prop, color, and NPC spawn is deterministic from world JSON.
- Why here: TBD
- Gotcha (from code): Any change to call order shifts the entire layout; call-sequence stability is verified by the determinism test at `tests/web3d-worldgen.test.ts:14` (same world → identical model on two runs). Seed keys look like `${worldId}:skyline`, `${building.id}:extras` (`web3d/src/worldgen/rng.ts:22-24`).
- Source: See ../web3d-architecture.md

## Canvas-generated textures (zero binary assets)
- What: Building facades, ground tiles, and prop textures generated at runtime on `<canvas>` elements and uploaded as `DataTexture`/`CanvasTexture` to the GPU.
- Why here: TBD
- Source: See ../web3d-architecture.md §"Look" | ../third-party-assets.md (for the GLB asset layer that sits on top)

## Phaser — retired but still in package.json
- What: 2D game framework used for the original prototype; replaced by R3F on 2026-06-12.
- Why here: TBD
- Gotcha (from code): `package.json` still lists `"phaser": "^4.1.0"` and `docs/PROJECT_RECOMMENDATION_CONTEXT.md` still references it as an audit snapshot artifact — zero `import.*[Pp]haser` lines exist anywhere in `src/` or `web3d/src/`.
- Source: See retros/2026-05-21-phaser-to-r3f.md
