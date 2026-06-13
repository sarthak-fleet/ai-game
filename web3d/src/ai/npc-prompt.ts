/**
 * npc-prompt.ts — build an in-character prompt for the in-browser NPC brain.
 *
 * Mirrors a trimmed version of the server persona (src/dialogue.ts
 * buildDialogueSystem). The local model is small, so we ask for a plain spoken
 * line only — no action/JSON protocol; anything that needs a real sim action
 * still flows through the server path.
 */

import type { Npc, World } from "../../../src/types.ts";

export interface DialogueLineLite {
  speaker: string;
  speakerName?: string;
  text: string;
}

export function buildNpcSystemPrompt(npc: Npc, world: World): string {
  const traits = npc.traits?.personality?.join(", ");
  return [
    `You are ${npc.name}, a character in "${world.story?.title ?? world.name}".`,
    world.story?.premise ? `World premise: ${world.story.premise}` : "",
    `Role: ${npc.role ?? "inhabitant"}.${npc.description ? ` ${npc.description}` : ""}`,
    traits ? `Traits: ${traits}.` : "",
    npc.traits?.speechStyle ? `Speech style: ${npc.traits.speechStyle}.` : "",
    npc.mood ? `Current mood: ${npc.mood.emotion}.` : "",
    npc.goals?.length ? `Goals: ${npc.goals.join("; ")}.` : "",
    "",
    "You are talking face to face with the player. Reply with ONLY your spoken line,",
    "1-2 short sentences, in character. No name prefix, no quotes, no narration.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildNpcUserPrompt(lines: DialogueLineLite[], playerText: string, playerName: string): string {
  const transcript = lines
    .filter((line) => line.speaker === "player" || line.speaker === "npc")
    .slice(-6)
    .map((line) => `${line.speaker === "player" ? playerName : line.speakerName || "You"}: ${line.text}`)
    .join("\n");
  return `${transcript ? `${transcript}\n` : ""}${playerName}: ${playerText}`;
}
