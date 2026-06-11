import { evaluateArc } from "./arcs.ts";
import { runTick } from "./simulation.ts";
import type { World, WorldRecap } from "./types.ts";

/**
 * The world advances while you're away: on session return, compressed
 * scripted ticks replay the missed time — NPC routines run, rumors travel,
 * secrets surface, quests and tensions move. No LLM calls (cheap enough to
 * run on every return), so it also works offline and in story mode.
 */

const CATCHUP_TICK_PER_MS = 5 * 60_000; // one world tick per 5 real minutes away
const MIN_TICKS = 2; // below this (≈10 min) the absence isn't worth a recap
const MAX_TICKS = 96; // ≈ a full in-game day; longer absences compress

const HIGHLIGHT_PATTERNS =
  /learned|turned against|secret|completed|offered|accepted|defeated|confront|advances|stage|arrives|burn|stolen|missing/i;

export async function catchUpWorld(world: World, elapsedMs: number): Promise<WorldRecap | null> {
  const ticks = Math.min(MAX_TICKS, Math.floor(elapsedMs / CATCHUP_TICK_PER_MS));
  if (ticks < MIN_TICKS) return null;

  const since = { day: world.clock.day, hour: Math.floor(world.clock.hour) };
  const highlights: string[] = [];

  for (let index = 0; index < ticks; index += 1) {
    const summary = await runTick(world, undefined, {});
    for (const entry of summary.actions) {
      if (HIGHLIGHT_PATTERNS.test(entry.text)) highlights.push(entry.text);
    }
  }
  const arcBeat = evaluateArc(world);
  if (arcBeat) highlights.push(arcBeat.text);

  const recap: WorldRecap = {
    since,
    until: { day: world.clock.day, hour: Math.floor(world.clock.hour) },
    ticks,
    awayMs: elapsedMs,
    lines: dedupe(highlights).slice(-8),
  };
  world.recap = recap;
  return recap;
}

function dedupe(lines: string[]): string[] {
  return [...new Set(lines)];
}
