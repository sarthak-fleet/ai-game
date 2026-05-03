# AI World Simulator / Interactive Fandom RPG — Project Init

This is a north-star/init document, not the v0 PRD. It captures the vision,
research landscape, execution order, and anti-distractions for the project. The
first build should still get its own small PRD/spec once implementation starts.

## 1. One-Line Vision

**A system that imports fictional worlds and turns them into interactive AI-driven playable simulations.**

The user can enter a fictional universe, interact with AI-driven characters, change the story, and experience consequences through a lightweight 2D/3D game interface.

---

# 2. End-State Vision

In the final version, the system should be able to:

1. **Import a fictional world**

   * fandom/wiki pages
   * episode summaries
   * subtitles/transcripts
   * character pages
   * lore docs
   * user-written worlds

2. **Compile the world into structured game data**

   * characters
   * locations
   * factions
   * relationships
   * timeline/chronology
   * powers/items/rules
   * character personas
   * story arcs

3. **Let the player enter the world**

   * play as a main character
   * play as a side character
   * insert an original character
   * start from canon chronology or branch into alternate events

4. **Run persistent AI characters**

   * characters speak in-character
   * move around
   * remember past events
   * gossip with each other
   * react to consequences
   * pursue goals
   * change relationships

5. **Generate presentation assets**

   * portraits
   * location images
   * item cards
   * comic-style scene cards
   * later: short action/comedy/cutscene clips

The core product is not “AI NPC chat.” It is:

> **A persistent agent simulation engine inside a playable story world.**

---

# 3. Core Principle

Do not start with world import, 3D, or video.

Start with:

> **A tiny AI village where 3–5 characters move, talk, remember, gossip, and change behavior based on events.**

If this nucleus feels alive, everything else can be layered on top.

If this nucleus is boring, fandom import and generated clips will not save the project.

---

# 4. The Five Hidden Projects

| Priority | Layer                            | Why It Matters              | When To Build               |
| -------: | -------------------------------- | --------------------------- | --------------------------- |
|        1 | Character / agent simulation     | Gives the world life        | First                       |
|        2 | 2D game runtime                  | Makes it playable           | First, alongside agents     |
|        3 | Memory + consequence system      | Makes actions matter        | First/second                |
|        4 | Narrative director               | Keeps the world interesting | After agents work           |
|        5 | Lore/media import and generation | End-state multiplier        | After core simulation works |

The earlier ranking included media before director. For actual product quality, the better execution order is:

```text
Agent simulation → 2D runtime → memory/consequences → director → media → world import
```

---

# 5. MVP: Interactive AI Village

## MVP Goal

Build a small playable 2D simulation where a few characters behave like persistent agents instead of static NPCs.

## MVP World

Small village map:

* town square
* tavern
* blacksmith
* forest gate
* mage hut/shrine

## MVP Characters

1. **Arin** — blacksmith

   * proud, suspicious, secretly kind
   * refuses to help weak outsiders

2. **Mira** — innkeeper

   * social, warm, observant, gossipy
   * spreads information

3. **Tovan** — guard

   * rigid, insecure, fearful
   * blocks access to the forest

4. **Lysa** — mage

   * secretive, intelligent, morally ambiguous
   * knows more about demons than she admits

5. **Player**

   * talks, moves, triggers events, changes relationships

## MVP Scenario

A demon scout was seen near the forest.

The player can:

* ask villagers about it
* gain Arin’s trust
* convince Tovan to open the gate
* discover Lysa is hiding information
* trigger NPC-to-NPC conflict
* change future dialogue through actions

---

# 6. Sequential Build Steps

## Step 1 — Define the Simulation in Text

Before making a game UI, build the world as a text simulation.

Needed:

* 5 character cards
* 5 locations
* event log
* relationship graph
* basic memory list
* allowed actions per NPC
* one starting event: “demon scout seen near forest”

Output should look like:

```text
Mira hears the demon scout rumor.
Mira tells Tovan.
Tovan confronts Lysa.
Player asks Arin for a sword.
Arin refuses because trust is low.
Player proves themselves.
Arin remembers and softens later.
```

This proves whether the project has a soul.

---

## Step 2 — Build the Agent Loop

Each NPC should follow this loop:

```text
observe event
→ retrieve relevant memory
→ consider goals + relationships
→ choose speech/action
→ return structured JSON
→ validate action
→ update world state
→ store memory
```

LLM output must be structured:

```json
{
  "speech": "You want a sword? Earn it first.",
  "emotion": "skeptical",
  "intent": "test_player",
  "action": {
    "type": "start_quest",
    "quest_id": "prove_yourself"
  },
  "relationship_deltas": {
    "player": { "respect": 2, "trust": -1 }
  },
  "memory_to_store": "The player asked Arin for a weapon before proving themselves."
}
```

Rule:

> LLM proposes. Game engine validates.

---

## Step 3 — Add Memory and Relationships

Implement memory outside the model.

Memory types:

* recent events
* important episodic memories
* character summaries
* public knowledge
* private knowledge
* relationship state

Relationship axes:

* trust
* respect
* fear
* affection
* resentment
* suspicion
* loyalty

This is where long-form memory actually lives. Fine-tuning is not for remembering player-specific events.

---

## Step 4 — Add a Simple 2D Runtime

After text simulation works, put it in a 2D game.

Recommended first stack:

```text
Phaser + TypeScript
Node.js or FastAPI backend
SQLite first, Postgres later
DeepSeek/API models through gateway
```

Game features:

* player movement
* NPC sprites
* small village map
* click-to-talk
* dialogue UI
* event log
* simulation tick
* relationship/debug panel

Do not overbuild the game engine.

---

## Step 5 — Add Quest and Consequence Layer

Add simple quests only after characters can remember/respond.

Initial quests:

1. investigate demon scout
2. earn Arin’s weapon
3. expose or protect Lysa’s secret

Quest outcomes should affect:

* NPC trust
* access to locations
* rewards
* rumors
* future dialogue

---

## Step 6 — Add Director Engine

The director keeps the simulation from becoming dead.

It should detect:

* nothing interesting has happened
* unresolved NPC tension exists
* player is stuck
* an event should escalate

Example director output:

```json
{
  "event_type": "confrontation",
  "description": "Tovan accuses Lysa of hiding information about the demon scout.",
  "participants": ["tovan", "lysa", "mira"],
  "location": "town_square"
}
```

The director should create pressure, not write the whole story.

---

## Step 7 — Add Media Layer

Start with still media, not clips.

Order:

1. character portraits
2. location images
3. item cards
4. scene cards
5. comic-style cutscenes
6. voice
7. short clips/video

First useful media feature:

```text
Major event happens → generate one scene card with image + caption
```

Example:

```text
Arin gives the player a silver sword.
→ generate dramatic forge scene image
→ show as cutscene card
```

---

## Step 8 — Add Structured World Import

Before fandom scraping, support manual world JSON import.

Input:

```json
{
  "world": {},
  "characters": [],
  "locations": [],
  "relationships": [],
  "timeline_events": [],
  "quests": []
}
```

Goal:

> The engine should be able to run a second custom world without code changes.

---

## Step 9 — Add Fandom/Wiki Import

Only after manual world import works.

Pipeline:

```text
fandom/wiki text
→ extract entities
→ extract relationships
→ extract locations
→ extract chronology
→ generate world bible
→ human review/edit
→ playable simulation
```

Important: public/commercial use of copyrighted worlds is risky. Treat fandom import as private/local experimentation first.

---

## Step 10 — Add Subtitles / Full Anime Import

This is later.

Subtitles can help extract:

* character speech style
* recurring relationships
* chronology
* scenes
* conflicts
* jokes/comedy patterns

But this is much harder than wiki import and should come after the simulation engine is good.

---

# 7. Work That Can Happen in Parallel

## Track A — Agent Core

Can start immediately.

* character schema
* memory schema
* relationship graph
* action schema
* prompt contract
* validator

## Track B — Game Client

Can start once basic world schema exists.

* Phaser map
* player movement
* NPC sprites
* dialogue UI
* event log UI

## Track C — Model Gateway / AI Ops

Can start immediately.

* DeepSeek adapter
* existing gateway integration
* model routing by NPC tier
* latency/cost logging
* fallback model support

## Track D — Research

Can happen alongside build, but should not block the MVP.

* AI Town
* Generative Agents
* Voyager
* SoulEngine
* AI RPG
* LLMUnity/Godot options

## Track E — Media Experiments

Can be explored lightly, but should not enter the MVP until core simulation works.

* portrait consistency
* scene card generation
* comic panel format
* character style references

## Track F — Lore Import Research

Can be researched, but not built first.

* fandom page structure
* wiki scraping
* entity extraction
* subtitle ingestion
* timeline extraction
* IP risk

---

# 8. Researched References + What To Steal

This section is based on the current state of the projects/docs we looked at. The goal is not to read endlessly. The goal is to steal patterns that directly reduce build risk.

---

## 8.1 Must-Steal References

### 1. AI Town

Link: [https://github.com/a16z-infra/ai-town](https://github.com/a16z-infra/ai-town)

What it is:

* A MIT-licensed, deployable starter kit for building a virtual town where AI characters live, chat, and socialize.
* It is explicitly inspired by the Generative Agents paper.
* It is close to the first version of this project: small world, multiple agents, conversations, shared state.

What to steal:

* Small-town simulation framing.
* Character-to-character interactions.
* Web-first playable prototype mindset.
* The idea that the world is a persistent simulation, not just a chat screen.

What not to copy blindly:

* Do not adopt its whole stack if it slows you down.
* Do not start by cloning it feature-for-feature.
* Do not spend too long understanding every implementation detail before building your own text simulation.

How it changes our plan:

> The first product should be closer to “AI Town with RPG consequences” than “anime open-world game.”

Research task:

* Read README.
* Inspect project structure.
* Identify how characters, conversations, world state, and ticks are represented.

---

### 2. Generative Agents / Smallville

Repo: [https://github.com/joonspk-research/generative_agents](https://github.com/joonspk-research/generative_agents)

Paper: [https://arxiv.org/abs/2304.03442](https://arxiv.org/abs/2304.03442)

What it is:

* The foundational research work for believable LLM agents in a sandbox environment.
* The architecture stores agent experiences, synthesizes them into reflections, retrieves relevant memories, and uses them for planning/action.
* The paper shows emergent social behavior, like agents spreading invitations and coordinating around a party.

What to steal:

* Memory stream.
* Observation → memory retrieval → reflection → planning → action loop.
* Reflection as compressed higher-level insight, not raw memory replay.
* Agent believability comes from memory + planning + reflection, not prompt personality alone.

What not to copy blindly:

* Do not implement full daily schedules first.
* Do not overbuild reflection before basic memory works.
* Do not simulate 25 agents before 5 agents are good.

How it changes our plan:

> Long-form memory should be built as an external memory/reflection system. Fine-tuning is not the memory layer.

Research task:

* Read the architecture section.
* Extract the memory scoring/retrieval/reflection pattern.
* Convert it into a simpler MVP memory design.

---

### 3. AI RPG

Link: [https://github.com/envy-ai/ai_rpg](https://github.com/envy-ai/ai_rpg)

What it is:

* A JS-based AI RPG system with prompt templates, world state, players, NPCs, regions, locations, exits, quests, saves, logs, and optional image generation.
* It uses configurable templates before calling OpenAI-compatible chat completion APIs.

What to steal:

* RPG world-state modeling.
* Entities like Player, Region, Location, Thing, Quest.
* Persistent saves and prompt/response logs.
* Optional art generation that does not block gameplay.
* Debug/control-panel thinking.

What not to copy blindly:

* It is more text-adventure/RPG-state oriented than your eventual 2D moving-agent game.
* Do not let prompt templating become the core product.

How it changes our plan:

> The backend should treat the game as structured RPG state first. The LLM should act inside that state, not invent the state.

Research task:

* Inspect server.js, Player/Region/Location/Quest models, prompt templates, saves, logs.
* Decide which entity abstractions map into your schema.

---

### 4. SoulEngine

Link: [https://github.com/PranavMishra17/SoulEngine](https://github.com/PranavMishra17/SoulEngine)

What it is:

* A TypeScript NPC intelligence framework with layered memory cycles, personality evolution, voice interaction, social networks, knowledge-base tiers, dual-instance mind, and MCP-style world actions.
* It uses the idea of a fast Speaker plus a background Thinker.
* It includes memory retention thresholds, letting some NPCs remember more and others forget more.

What to steal:

* Different NPC intelligence/memory tiers.
* Fast response vs slow background reasoning split.
* Memory consolidation into long-term insight, not raw dumping.
* Bounded personality drift.
* Tool/action list for world actions.

What not to copy blindly:

* Do not build voice first.
* Do not build full personality evolution before basic relationship/memory works.
* Do not overcomplicate memory cycles in MVP.

How it changes our plan:

> “Different intelligence levels” should include memory retention, action set, reasoning depth, and background planning—not just model size.

Research task:

* Study the five-pillar design.
* Extract memory-tier ideas into your NPC schema.
* Use fast/slow mind as Phase 2 or Phase 3, not MVP day one.

---

## 8.2 Agent References To Study Later

### 5. Voyager

Repo: [https://github.com/MineDojo/Voyager](https://github.com/MineDojo/Voyager)

Site: [https://voyager.minedojo.org/](https://voyager.minedojo.org/)

What it is:

* A long-running embodied Minecraft agent.
* Uses automatic curriculum, an ever-growing skill library of executable code, and iterative prompting with environment feedback/errors/self-verification.
* It shows how agents can accumulate reusable skills without parameter fine-tuning.

What to steal later:

* Skill library concept.
* Environment feedback loop.
* Self-verification after attempted actions.
* Reusable learned behavior/actions.

What not to build now:

* Automatic curriculum.
* Self-improving skill library.
* Complex embodied agent learning.

How it changes our plan:

> Voyager is a later reference for “agents learn skills over time.” It is not the first village build.

Research task:

* Read only enough to understand skill library + feedback loop.
* Revisit when NPCs need reusable action strategies.

---

## 8.3 Game Runtime Research

### 6. Phaser

Official template: [https://phaser.io/news/2024/01/phaser-vite-typescript-template](https://phaser.io/news/2024/01/phaser-vite-typescript-template)

GitHub template: [https://github.com/phaserjs/template-vite-ts](https://github.com/phaserjs/template-vite-ts)

What it is:

* Browser-first 2D game framework.
* Official Phaser + TypeScript + Vite templates exist.
* Fastest route to a playable 2D prototype with TS.

What to steal:

* Use Phaser for the first playable village.
* Keep the game client dumb: render map, sprites, dialogue, event log.
* Put agent/memory/world logic in backend, not inside Phaser.

What not to do:

* Do not build complex combat/physics first.
* Do not obsess over game-feel before NPC behavior works.

How it changes our plan:

> Phaser remains the recommended first game runtime because it minimizes ceremony and maximizes integration speed.

Research task:

* Build tiny demo: map + player movement + 2 NPC sprites + dialogue box.

---

### 7. Godot

Main docs: [https://docs.godotengine.org/](https://docs.godotengine.org/)

First 2D game tutorial: [https://docs.godotengine.org/en/stable/getting_started/first_2d_game/index.html](https://docs.godotengine.org/en/stable/getting_started/first_2d_game/index.html)

2D docs: [https://docs.godotengine.org/en/stable/tutorials/2d/index.html](https://docs.godotengine.org/en/stable/tutorials/2d/index.html)

What it is:

* Open-source 2D/3D game engine with strong 2D tooling.
* Better future path if the project becomes a real game rather than a web simulation.

What to steal later:

* Tilemaps.
* Scene system.
* Native-feeling game loop.
* Eventually better 2D/3D game structure.

What not to do now:

* Do not switch to Godot before the text/Phaser prototype proves fun.

How it changes our plan:

> Godot is the second runtime candidate, not the MVP runtime unless Phaser becomes limiting.

---

### 8. LLMUnity

Link: [https://github.com/undreamai/LLMUnity](https://github.com/undreamai/LLMUnity)

What it is:

* Unity package for creating LLM-backed characters.
* Supports local model management and RAG-style retrieval inside Unity.

What to steal later:

* Unity character integration pattern.
* RAG-in-game approach.
* Local model handling.

What not to do now:

* Do not start in Unity unless you are committing to 3D early.
* Do not let Unity/3D become the excuse to avoid building the agent core.

How it changes our plan:

> Unity/LLMUnity is a later-stage migration path for 3D, not the first execution path.

---

## 8.4 Model Gateway / AI Ops Research

### 9. DeepSeek API

Pricing/docs: [https://api-docs.deepseek.com/quick_start/pricing](https://api-docs.deepseek.com/quick_start/pricing)

V4 release notes: [https://api-docs.deepseek.com/news/news260424](https://api-docs.deepseek.com/news/news260424)

What it is:

* DeepSeek V4 Flash and V4 Pro support 1M context, JSON output, tool calls, and thinking/non-thinking modes.
* V4 Flash is positioned as the fast/economical model.
* V4 Pro is positioned as stronger for agentic/coding/reasoning tasks.

What to steal:

* Use V4 Flash as default for normal NPCs.
* Use thinking mode for quest NPCs, companions, and hard decisions.
* Use V4 Pro only for director, villain, lore compiler, or complex planning.
* Use JSON/tool calling for structured actions.

What not to do:

* Do not use long context as a substitute for memory architecture.
* Do not send the whole world every time.
* Do not rely on one model for all NPC tiers.

How it changes our plan:

> API models are better for early iteration than local-only inference. Local models remain useful for summarization, experiments, and future fine-tuning.

Research task:

* Test V4 Flash non-thinking vs thinking on the same NPC action prompt.
* Measure JSON validity, latency, and cost.

---

### 10. Cloudflare AI Gateway / Your Gateway Layer

Cloudflare AI Gateway docs: [https://developers.cloudflare.com/ai-gateway/](https://developers.cloudflare.com/ai-gateway/)

Dynamic routing: [https://developers.cloudflare.com/ai-gateway/features/dynamic-routing/](https://developers.cloudflare.com/ai-gateway/features/dynamic-routing/)

Observability: [https://developers.cloudflare.com/ai-gateway/observability/](https://developers.cloudflare.com/ai-gateway/observability/)

What it is:

* AI traffic control plane for routing, fallbacks, observability, cost tracking, caching, and rate limiting.
* Dynamic routing allows conditional routes, quotas, fallbacks, and A/B style model routing.

What to steal:

* Treat your existing gateway as the model router and observability layer.
* Route by task type and NPC tier.
* Track latency, token usage, JSON failure rate, and action rejection rate.
* Add fallbacks for model/provider failure.

What not to do:

* Do not hide core experiments behind vague `auto` routing.
* Use explicit model routing while evaluating behavior.

How it changes our plan:

> Model routing is a first-class backend module. It should not be an afterthought.

Suggested routing policy:

```json
{
  "background_npc": "template_or_tiny_local",
  "normal_npc": "deepseek-v4-flash-non-thinking",
  "quest_npc": "deepseek-v4-flash-thinking",
  "companion": "deepseek-v4-flash-thinking",
  "villain": "deepseek-v4-pro-thinking",
  "director": "deepseek-v4-pro-thinking",
  "lore_compiler": "best_available_model"
}
```

---

## 8.5 Lore Import Research

### 11. MediaWiki / Fandom Import

MediaWiki Action API: [https://www.mediawiki.org/wiki/API:Action_API](https://www.mediawiki.org/wiki/API:Action_API)

Get page contents: [https://www.mediawiki.org/wiki/API:Get_the_contents_of_a_page](https://www.mediawiki.org/wiki/API:Get_the_contents_of_a_page)

Parse wikitext: [https://www.mediawiki.org/wiki/API:Parsing_wikitext](https://www.mediawiki.org/wiki/API:Parsing_wikitext)

Fandom API sandbox: [https://dev.fandom.com/wiki/Dev_Wiki:Sandbox/API](https://dev.fandom.com/wiki/Dev_Wiki:Sandbox/API)

What it is:

* MediaWiki APIs can retrieve page contents and parse wikitext.
* Fandom uses wiki structures, but pages will be messy, inconsistent, spoilery, and not directly game-ready.

What to steal:

* Use API extraction later instead of fragile browser scraping where possible.
* Convert source material into a reviewable world bible.
* Keep human review/editing in the pipeline.

What not to do now:

* Do not start with direct fandom import.
* Do not assume a wiki page equals playable game data.
* Do not commercially depend on copyrighted worlds.

How it changes our plan:

> Build manual world JSON import before fandom import. Fandom import should compile into the same world schema.

Pipeline:

```text
wiki page/source text
→ extract entities
→ extract relationships
→ extract chronology
→ generate world bible draft
→ human review
→ playable world
```

---

### 12. Subtitle / Anime Ingestion

WhisperX: [https://github.com/m-bain/whisperX](https://github.com/m-bain/whisperX)

PySceneDetect: [https://github.com/Breakthrough/PySceneDetect](https://github.com/Breakthrough/PySceneDetect)

PySceneDetect docs: [https://www.scenedetect.com/](https://www.scenedetect.com/)

What it is:

* WhisperX provides ASR with word-level timestamps and speaker diarization.
* PySceneDetect detects shot changes and can split videos into clips.

What to steal later:

* Use subtitles/transcripts to extract speech style, repeated character dynamics, jokes, and scene structure.
* Use scene detection to chunk episodes into analyzable moments.

What not to do now:

* Do not touch full anime ingestion before the AI village works.
* Do not confuse shot detection with story-scene understanding. Shot boundaries still need semantic grouping.

How it changes our plan:

> Subtitle/anime import is a late-stage research project, not a build dependency.

---

## 8.6 Research-Driven Build Decisions

After the research pass, the build plan should change in these ways:

1. **Start as AI Town + RPG consequences**, not as anime import.
2. **Use Generative Agents for memory architecture**, but simplify it heavily.
3. **Use AI RPG for world-state and quest abstractions.**
4. **Use SoulEngine and Super NPC for NPC state design.**
5. **Use Agentshire/Agent Town for spatial UX and gamefeel references.**
6. **Use DeepSeek V4 Flash for most NPC calls.**
7. **Use DeepSeek V4 Pro only for high-value reasoning.**
8. **Use your gateway as model routing/observability, not as the brain.**
9. **Use Phaser first for playable 2D.**
10. **Keep Godot/Unity/LLMUnity as later migration paths.**
11. **Do manual world JSON import before fandom/wiki import.**
12. **Do still-image scene cards before video clips.**
13. **Do not research Voyager deeply until reusable skills become necessary.**

---

## 8.7 Stealable Patterns by Core Product

We have five core products hidden inside the end-state vision. Research should be organized by these five products, not by random repo lists.

---

### Product 1 — Lore Ingestion / World Compiler

Goal:

> Turn raw lore into structured playable world data.

Inputs later:

* fandom/wiki pages
* character pages
* episode summaries
* subtitles/transcripts
* user-written lore docs
* public-domain stories

Output:

* world bible
* characters
* locations
* factions
* relationships
* timeline
* powers/items/rules
* quest seeds
* canon start points

Repos/docs worth stealing from:

#### Narratium.ai

Link: [https://github.com/Kryo123456/Narratium.ai](https://github.com/Kryo123456/Narratium.ai)

Steal:

* character cards + lore/worldbook model
* visual memory/session tracing
* branching story UI
* “creative studio” framing for worlds/characters/conversations
* beginner-friendly UI for editing characters and worlds

Do not copy:

* licensing/content strategy blindly
* discontinued/unstable development assumptions
* roleplay-only architecture without game-state validation

Use it for:

* world editor UX
* character/lore management UI
* branching-session visualization

#### MediaWiki / Fandom APIs

Links:

* [https://www.mediawiki.org/wiki/API:Action_API](https://www.mediawiki.org/wiki/API:Action_API)
* [https://www.mediawiki.org/wiki/API:Get_the_contents_of_a_page](https://www.mediawiki.org/wiki/API:Get_the_contents_of_a_page)
* [https://www.mediawiki.org/wiki/API:Parsing_wikitext](https://www.mediawiki.org/wiki/API:Parsing_wikitext)
* [https://dev.fandom.com/wiki/Dev_Wiki:Sandbox/API](https://dev.fandom.com/wiki/Dev_Wiki:Sandbox/API)

Steal:

* official API-based extraction instead of brittle scraping
* page content retrieval
* wikitext parsing
* links/categories as graph hints

Do not build first:

* direct fandom import
* full chronology extraction
* automatic canon fidelity

First version:

```text
manual world JSON → playable world
```

Only later:

```text
wiki/fandom text → extracted entities → world bible draft → human review → playable world
```

#### AI RPG

Link: [https://github.com/envy-ai/ai_rpg](https://github.com/envy-ai/ai_rpg)

Steal:

* world-state entity structure
* regions/locations/exits/quests
* save/log system
* prompt templates tied to RPG objects

Use it for:

* the target world schema that lore import compiles into

---

### Product 2 — Character / Agent Simulation Engine

Goal:

> Characters should feel alive: they remember, act, talk, move, gossip, and change relationships.

Repos worth stealing from:

#### Generative Agents / Smallville

Repo: [https://github.com/joonspk-research/generative_agents](https://github.com/joonspk-research/generative_agents)

Paper: [https://arxiv.org/abs/2304.03442](https://arxiv.org/abs/2304.03442)

Steal:

* memory stream
* observation → retrieval → reflection → planning → action
* importance scoring
* reflection as compressed long-term understanding

Do not copy first:

* 25-agent simulation
* full daily plans
* overbuilt reflection cycles

#### Super NPC

PyPI: [https://pypi.org/project/supernpc/](https://pypi.org/project/supernpc/)

Steal:

* simple NPCAgent API shape
* memory, emotions, personality, relationships as separate modules
* Big Five personality idea
* JSON state serialization
* REST API integration pattern
* engine-agnostic NPC service

Do not copy blindly:

* alpha claims around scale
* local-only assumption
* limited relationship model if too simple

Use it for:

* first NPC state schema
* REST API surface
* emotion/personality module boundaries

#### SoulEngine

Link: [https://github.com/PranavMishra17/SoulEngine](https://github.com/PranavMishra17/SoulEngine)

Steal:

* layered memory
* NPC memory tiers
* fast speaker vs slow thinker
* relationship/social graph
* personality drift bounded over time
* tool/action agency

Use it for:

* Phase 2+ deeper NPC brain

#### Agentshire

Link: [https://github.com/Agentshire/Agentshire](https://github.com/Agentshire/Agentshire)

Steal:

* dual-mode NPC behavior:

  * cheap algorithmic daily behavior by default
  * AI “Soul Mode” only when needed
* 3-tier decisions:

  * L1 daily plan
  * L2 tactical choice
  * L3 dialogue
* relationship graph
* daily narrative summaries

Do not copy:

* OpenClaw dependency as required architecture
* 3D-first scope
* too much town-life polish before agent core works

Use it for:

* intelligence tiers
* cost control
* gamefeel around living NPCs

#### ARCADIA

Link: [https://github.com/ruvnet/ARCADIA](https://github.com/ruvnet/ARCADIA)

Steal:

* emotional state engine idea
* GOAP-style autonomous NPC behavior
* vector index/cache for semantic game state
* performance mindset

Do not copy first:

* Rust engine architecture
* self-improving/evolutionary complexity
* engine-heavy abstractions

Use it for:

* later NPC behavior planner
* emotion/GOAP inspiration

---

### Product 3 — Narrative Director / Story Orchestrator

Goal:

> Keep the world interesting without hand-writing every plot beat.

The director should detect:

* dead air
* unresolved tension
* quest stagnation
* hidden secret ready to reveal
* relationship conflict
* player confusion
* opportunity for comedy/drama/action

Repos worth stealing from:

#### Generative Agents

Steal:

* reflection: synthesize raw events into higher-level narrative implications
* social propagation: NPCs indirectly create events by talking

Use for:

* director summaries
* “what is narratively important?” judgments

#### AI RPG

Steal:

* quest-state constraints
* RPG state as guardrails for generated story events

Use for:

* director cannot invent impossible story states
* director proposes quest/event updates inside current world state

#### Narratium.ai

Steal:

* branching session visualization
* adventure mode decisions
* memory/session graph UI

Use for:

* showing branches and canon divergence later

#### Agentshire

Steal:

* cinematic workflow structure
* summon/rally/assign/celebrate style event choreography
* mini-game/event injections as pacing tools
* NPC stress mechanics as simulation pressure

Use for:

* making director events visible and game-like

#### ARCADIA

Steal:

* GOAP planner for NPC/director goals
* adaptive behavior evaluation

Use later:

* director chooses actions based on goal satisfaction, not vibes only

First director version:

```text
If nothing interesting happened recently:
  find unresolved tension
  pick 2–3 involved NPCs
  trigger rumor/confrontation/request/event
  validate against world state
```

Do not build:

* full plot generator
* full canon-preserving director
* cinematic LLM video planner

---

### Product 4 — Game Runtime / Spatial UX

Goal:

> Make the simulation playable and visible.

First runtime:

```text
Phaser + TypeScript
```

Later candidates:

```text
Godot / Unity
```

Repos worth stealing from:

#### Phaser

Template: [https://github.com/phaserjs/template-vite-ts](https://github.com/phaserjs/template-vite-ts)

Steal:

* fast browser-first 2D shell
* TS/Vite setup
* map + sprites + input + dialogue UI

Use for:

* MVP playable village

#### Agentshire

Link: [https://github.com/Agentshire/Agentshire](https://github.com/Agentshire/Agentshire)

Steal:

* dual interface:

  * town mode
  * chat mode
* real-time dialogue bubbles
* typewriter streaming
* NPC status cards
* map editor / character workshop idea
* day/night/weather as low-cost immersion
* AI tool control over town: broadcast, spawn NPC, trigger effects, set weather/time

Do not copy first:

* 3D town
* full weather/audio/VFX system
* OpenClaw plugin lock-in

#### Agent Town

Link: [https://github.com/geezerrrr/agent-town](https://github.com/geezerrrr/agent-town)

Steal:

* pixel-art spatial interface for agents
* in-world task/dialogue assignment
* visible execution states
* worker/NPC bubbles showing current state
* session management and token/context metering

Use for:

* visualizing NPC thoughts/actions in 2D
* debug UI for agent state

#### Godot

Docs: [https://docs.godotengine.org/](https://docs.godotengine.org/)

Steal later:

* better 2D/3D game structure
* tilemaps
* scene system

#### LLMUnity

Link: [https://github.com/undreamai/LLMUnity](https://github.com/undreamai/LLMUnity)

Steal later:

* Unity LLM integration
* local model/RAG integration

First runtime feature list:

```text
player movement
NPC sprites
click-to-talk
dialogue bubbles
event log
relationship debug panel
simulation tick
```

---

### Product 5 — Media / Cutscene Layer

Goal:

> Make important moments feel like anime/game scenes without making video the first bottleneck.

Build order:

```text
portraits → location images → item cards → scene cards → comic panels → voice → short clips/video
```

Repos/tools worth stealing from:

#### Narratium.ai

Steal:

* polished world/character visual UX
* visual memory/session tracing
* roleplay presentation patterns

Use for:

* UI/UX inspiration for character cards, lore, and branch memories

#### Agentshire

Steal:

* real-time dialogue bubbles
* VFX feedback for major events
* cinematic workflow/choreography
* deliverable preview cards/lightbox pattern
* weather/time/audio as ambience

Use for:

* “scene card” presentation
* cutscene-lite moments
* gamefeel without full video

#### AI RPG

Steal:

* optional image generation, not blocking core gameplay
* generated art as enhancement, not system dependency

#### WhisperX

Link: [https://github.com/m-bain/whisperX](https://github.com/m-bain/whisperX)

Steal later:

* transcript with timestamps
* speaker diarization for source video analysis

#### PySceneDetect

Link: [https://github.com/Breakthrough/PySceneDetect](https://github.com/Breakthrough/PySceneDetect)

Steal later:

* scene/shot boundary detection
* clip chunking for anime import research

Do not build first:

* video generation
* full anime clip import
* generated animation pipeline

First media version:

```text
major event → generate one still scene card + caption → cache it
```

Example:

```text
Arin gives the player a silver sword.
Scene card: forge, warm lighting, Arin reluctant but respectful.
```

---

## 8.8 New Repos To Audit With Skepticism

These are useful, but none should derail the MVP.

| Repo         | Relevance    | Steal                                                                                                | Skepticism                                                                               |
| ------------ | ------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Agentshire   | Very high    | spatial NPC UX, Soul Mode, map editor, character workshop, day/night/weather, 3-tier agent decisions | tied to OpenClaw/QClaw, 3D-first, possibly too much polish                               |
| Agent Town   | High         | pixel RPG UX, in-world agent assignment, visible execution states, Phaser/Next-style direction       | office-agent framing, not RPG storytelling                                               |
| Super NPC    | Very high    | NPCAgent API, memory/emotion/personality/relationship modules, REST API, JSON persistence            | alpha; verify actual code depth before relying                                           |
| Narratium.ai | Medium-high  | worldbook, character cards, branching visual memory/session tracing                                  | restrictive content license, possible discontinuity, roleplay-first not game-state-first |
| ARCADIA      | Medium       | emotion engine, GOAP, vector index/cache, performance mindset                                        | Rust/engine-heavy, likely overkill for MVP                                               |
| Voyager      | Medium later | skill library, long-running feedback loop, self-verification                                         | not an NPC town/RPG framework; study later                                               |

---

## 8.9 Revised Research Order

Research in this exact order:

```text
1. AI Town — multi-agent town baseline
2. Generative Agents — memory/reflection/planning
3. Agentshire — spatial UX + NPC intelligence tiers
4. Super NPC — simple NPC memory/emotion/personality API
5. AI RPG — RPG state/quest/location models
6. Phaser template — first playable runtime
7. SoulEngine — deeper NPC memory/personality architecture
8. Agent Town — spatial debug/execution UX
9. DeepSeek + gateway routing — model strategy
10. Narratium — worldbook/branching UI
11. MediaWiki/Fandom APIs — lore import
12. ARCADIA — GOAP/emotion/performance later
13. Voyager — reusable skill library later
14. WhisperX/PySceneDetect — subtitles/video ingestion later
```

Blunt rule:

> If a research item does not directly help the 5-NPC village, it is not allowed to block the build.

---

## 8.10 What We Should Build First After This Research

First build target is unchanged, but sharper:

```text
Text-only AI Village
- 5 NPCs
- event log
- memory stream
- relationship graph
- emotion state
- structured actions
- action validator
- cheap model routing
- NPC-to-NPC gossip
```

But we now explicitly steal these pieces:

```text
AI Town: multi-agent town framing
Generative Agents: memory stream/reflection
Super NPC: NPC module boundaries
Agentshire: L1/L2/L3 decision tiers + algorithmic default behavior
AI RPG: quest/location/world-state schema
Cloudflare/Gateway: model routing + observability
```

After this works in text:

```text
Phaser 2D Village
- town square / tavern / blacksmith / forest gate / mage hut
- player movement
- NPC sprites
- dialogue bubbles
- event log
- relationship/debug panels
```

# 9. Model Strategy

Use different intelligence levels by NPC tier.

| NPC Type                 | Model Strategy                         |
| ------------------------ | -------------------------------------- |
| background NPCs          | templates / tiny local model / no LLM  |
| normal NPCs              | cheap API model, non-thinking          |
| quest NPCs               | cheap API model, thinking mode         |
| companions               | cheap/strong API model + deeper memory |
| villains/faction leaders | stronger API model                     |
| director                 | stronger reasoning model               |
| lore compiler            | strongest available model              |

Local models are worth learning, but mostly for:

* offline experiments
* memory summarization
* cheap background NPCs
* prompt testing
* future fine-tuning

Fine-tuning is useful for:

* JSON action discipline
* tone/style
* archetypes
* tool calling

Fine-tuning is not for:

* dynamic memory
* player-specific history
* quest state
* evolving relationships

---

# 10. Minimal Data Schemas

## Character

```json
{
  "id": "arin",
  "name": "Arin",
  "role": "blacksmith",
  "personality": ["proud", "suspicious", "secretly kind"],
  "goals": ["protect village", "test outsiders"],
  "secrets": ["once failed to save someone"],
  "relationships": {},
  "allowed_actions": ["speak", "move_to", "refuse", "give_item", "start_quest"],
  "current_location": "blacksmith"
}
```

## Event

```json
{
  "id": "event_001",
  "type": "rumor",
  "description": "A demon scout was seen near the forest.",
  "participants": ["mira"],
  "location": "tavern",
  "importance": 0.7,
  "visibility": "public"
}
```

## Memory

```json
{
  "owner": "arin",
  "content": "The player asked for a sword before proving themselves.",
  "importance": 0.5,
  "tags": ["player", "weapon", "trust"],
  "source_event_id": "event_014"
}
```

## Relationship

```json
{
  "source": "arin",
  "target": "player",
  "trust": 10,
  "respect": 0,
  "fear": 0,
  "affection": 0,
  "resentment": 0,
  "suspicion": 25
}
```

---

# 11. Success Criteria

The first version is successful if:

* NPCs feel distinct
* NPCs remember important events
* relationships affect dialogue/actions
* NPCs can talk to each other
* player actions create persistent consequences
* at least one interaction surprises the user coherently
* JSON/action validation works reliably
* the system is fun in text before visuals

Do not expand until these are true.

---

# 12. Immediate Start

Build this first:

```text
Text-only AI village simulation
5 NPCs
1 demon-scout scenario
memory
relationships
NPC-to-NPC gossip
structured JSON actions
action validation
```

Then move it into Phaser.

Everything else waits.

---

# 13. Brutal Summary

The project is good because it teaches:

* long-running agents
* memory systems
* tool/action calling
* simulation loops
* game-state management
* AI product architecture
* model routing and cost control
* later: fine-tuning and local models

But the project dies if it starts with:

* full anime import
* clip generation
* 3D
* many fandoms
* large open world

The correct first build is:

> **One small AI village that feels alive.**

That is the nucleus. Build that first.
