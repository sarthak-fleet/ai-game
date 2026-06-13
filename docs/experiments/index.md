# Experiments

Each experiment is a focused 1-2 day spike to evaluate a candidate solution
before adopting it. Outputs are real (deployed services, generated artifacts,
measured numbers), not design speculation. The doc here is the durable
artifact — code may be discarded; the learnings stay.

## Index

- [Image-to-3D bake-off](./image-to-3d-bakeoff.md) — TRELLIS vs. Hunyuan3D-2
  on Modal for unique-per-NPC character meshes. Compares cold-start, warm-gen,
  GPU cost, output size, and rigging-gap effort vs. sticking with VRM.
- [VRM baseline snapshot](./vrm-baseline.md) — headless Playwright capture of
  the live game after the VRM character swap. Confirms VRM loaders fire and
  characters render, flags a repeating Kenney `colormap.png` texture-load
  failure and a one-off WebGL context loss; MToon cel-shading not visually
  confirmed at default camera distance.
- [SadTalker dialogue close-ups](./sadtalker-dialogue.md) — revived idle
  SadTalker + Parler-TTS Modal apps for animated NPC dialogue. Auth
  unblocked via secret rotation (`custom-secret` rewritten with six
  candidate env-var names → forced container restart). End-to-end works:
  3.0s, 256×256 H.264+AAC MP4 from `opm-z-city-mira.png` +
  `saitama-voice.wav` in ~34s warm gen. **Verdict: skip** — SadTalker
  aggressively face-crops, losing the costume silhouette that makes each
  NPC visually distinct in the HUD, and anime lip-sync is barely
  perceptible. AniPortrait next if we revisit.

## Conventions

- Modal endpoints recorded in the doc body, never `.env`.
- Sample outputs live in `tmp/experiments/` (git-ignored; regenerate from
  the recipe in the doc).
- Every experiment ends with an explicit verdict: adopt / reject / defer.
