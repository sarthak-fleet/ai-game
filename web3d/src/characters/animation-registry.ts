/**
 * NPC animation-handle registry.
 *
 * `controls/runtime.ts`'s `npcRegistry` tracks scene-graph position/node for
 * fast-path systems (combat AI, minimap). It is intentionally narrow and
 * imported by code that must not depend on React refs.
 *
 * This sibling registry holds the React `CharacterAnimationHandle` for each
 * NPC so non-rendering callers (Dialogue HUD, story director) can fire
 * reactions like `greet` on the matching NPC without prop-drilling.
 *
 * Lifecycle is owned by `Npc.tsx`: the component registers its handle once
 * the underlying rig (VrmCharacter / RiggedCharacter) mounts, and clears it
 * on unmount. Lookups via `getNpcAnimation` are best-effort — when an NPC is
 * off-screen / not yet mounted, the entry may be missing; callers must
 * tolerate `null`.
 */
import type { CharacterAnimationHandle } from "./CharacterModel.tsx";

const handles = new Map<string, CharacterAnimationHandle>();

export function registerNpcAnimation(
  npcId: string,
  handle: CharacterAnimationHandle
): void {
  handles.set(npcId, handle);
}

export function unregisterNpcAnimation(npcId: string): void {
  handles.delete(npcId);
}

export function getNpcAnimation(npcId: string): CharacterAnimationHandle | null {
  return handles.get(npcId) ?? null;
}
