/** NPCs currently following the player (client-side companion state). */
export const followersStore = new Set<string>();

export function setFollowing(npcId: string, following: boolean): void {
  if (following) followersStore.add(npcId);
  else followersStore.delete(npcId);
}

export function clearFollowers(): void {
  followersStore.clear();
}
