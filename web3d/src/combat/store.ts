import { create } from "zustand";

import { combatMovesFor } from "../../../src/combat.ts";
import type { World } from "../../../src/types.ts";
import { deathThud, hitImpact, hurt } from "../audio/sfx.ts";
import { addCameraShake } from "../controls/runtime.ts";
import { useWorldStore } from "../store/world.ts";

export interface EnemyCombat {
  hp: number;
  maxHp: number;
  hostile: boolean;
  defeated: boolean;
  /** sim outcome has been reported (or matched) */
  reported: boolean;
}

export interface VfxEvent {
  id: number;
  kind: "spark" | "damage" | "telegraph" | "dust";
  x: number;
  y: number;
  z: number;
  text?: string;
  color: string;
  startedAt: number;
  expiresAt: number;
}

const PLAYER_MAX_HP = 120;
const ENEMY_DEFAULT_HP = 100;

interface CombatStore {
  playerHp: number;
  playerMaxHp: number;
  playerDown: boolean;
  lockTargetId: string | null;
  enemies: Record<string, EnemyCombat>;
  vfx: VfxEvent[];
  engage: (npcId: string) => EnemyCombat;
  damageEnemy: (npcId: string, amount: number, at: { x: number; y: number; z: number }) => void;
  damagePlayer: (amount: number, at: { x: number; y: number; z: number }) => void;
  setHostileFromSummaryActions: (actions: Array<{ type: string; actorId?: string; targetId?: string }>) => void;
  setLockTarget: (npcId: string | null) => void;
  addVfx: (event: Omit<VfxEvent, "id">) => void;
  pruneVfx: (now: number) => void;
  respawnPlayer: () => void;
  resetForWorld: () => void;
}

let vfxSeq = 0;

export const useCombatStore = create<CombatStore>((set, get) => ({
  playerHp: PLAYER_MAX_HP,
  playerMaxHp: PLAYER_MAX_HP,
  playerDown: false,
  lockTargetId: null,
  enemies: {},
  vfx: [],

  engage(npcId) {
    const existing = get().enemies[npcId];
    if (existing) {
      if (!existing.hostile && !existing.defeated) {
        const enemies = { ...get().enemies, [npcId]: { ...existing, hostile: true } };
        set({ enemies });
        return enemies[npcId]!;
      }
      return existing;
    }
    const world = useWorldStore.getState().world;
    const npc = world?.npcs.find((entry) => entry.id === npcId);
    const seeded: EnemyCombat = {
      hp: npc?.combat?.hp ?? ENEMY_DEFAULT_HP,
      maxHp: npc?.combat?.maxHp ?? ENEMY_DEFAULT_HP,
      hostile: true,
      defeated: Boolean(npc?.combat?.defeated),
      reported: Boolean(npc?.combat?.defeated),
    };
    set({ enemies: { ...get().enemies, [npcId]: seeded } });
    return seeded;
  },

  damageEnemy(npcId, amount, at) {
    const enemy = get().engage(npcId);
    if (enemy.defeated) return;
    const hp = Math.max(0, enemy.hp - amount);
    const defeated = hp <= 0;
    set({
      enemies: { ...get().enemies, [npcId]: { ...enemy, hp, hostile: !defeated, defeated } },
      ...(defeated && get().lockTargetId === npcId ? { lockTargetId: null } : {}),
    });
    addCameraShake(defeated ? 0.3 : 0.12);
    if (defeated) deathThud();
    else hitImpact(amount >= 35);
    get().addVfx({ kind: "spark", ...at, color: "#ffd84d", startedAt: performance.now(), expiresAt: performance.now() + 380 });
    get().addVfx({
      kind: "damage",
      ...at,
      text: String(amount),
      color: defeated ? "#ff7a7a" : "#ffffff",
      startedAt: performance.now(),
      expiresAt: performance.now() + 850,
    });
    if (defeated) void reportDefeatToSim(npcId);
  },

  damagePlayer(amount, at) {
    if (get().playerDown) return;
    const playerHp = Math.max(0, get().playerHp - amount);
    set({ playerHp, playerDown: playerHp <= 0 });
    addCameraShake(playerHp <= 0 ? 0.45 : 0.22);
    if (playerHp <= 0) deathThud();
    else hurt();
    get().addVfx({ kind: "spark", ...at, color: "#ff6a5a", startedAt: performance.now(), expiresAt: performance.now() + 380 });
  },

  setHostileFromSummaryActions(actions) {
    for (const action of actions) {
      if (action.type !== "fight") continue;
      const npcId = action.targetId === "player" ? action.actorId : action.actorId === "player" ? action.targetId : null;
      if (npcId && npcId !== "player") get().engage(npcId);
    }
  },

  setLockTarget(npcId) {
    set({ lockTargetId: npcId });
  },

  addVfx(event) {
    set({ vfx: [...get().vfx, { ...event, id: ++vfxSeq }] });
  },

  pruneVfx(now) {
    const vfx = get().vfx;
    if (vfx.some((event) => event.expiresAt <= now)) {
      set({ vfx: vfx.filter((event) => event.expiresAt > now) });
    }
  },

  respawnPlayer() {
    set({ playerHp: get().playerMaxHp, playerDown: false, lockTargetId: null });
  },

  resetForWorld() {
    set({ playerHp: PLAYER_MAX_HP, playerMaxHp: PLAYER_MAX_HP, playerDown: false, lockTargetId: null, enemies: {}, vfx: [] });
  },
}));

/**
 * Drive the tick-based sim to the client outcome: send finisher-style fight
 * actions until the sim marks the target defeated (bounded to avoid burning
 * world time if validation rejects).
 */
async function reportDefeatToSim(npcId: string): Promise<void> {
  const worldStore = useWorldStore.getState();
  const world = worldStore.world;
  if (!world) return;
  const finisher = combatMovesFor(world).find((move) => move.style === "finisher");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = useWorldStore.getState().world;
    const npc = state?.npcs.find((entry) => entry.id === npcId);
    if (npc?.combat?.defeated) break;
    const summary = await useWorldStore.getState().send({ type: "fight", targetId: npcId, moveId: finisher?.id });
    if (!summary) break;
  }
  const enemies = useCombatStore.getState().enemies;
  const enemy = enemies[npcId];
  if (enemy) useCombatStore.setState({ enemies: { ...enemies, [npcId]: { ...enemy, reported: true } } });
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>)["__combat"] = useCombatStore;
}

export function enemyStateFor(world: World | null, npcId: string): EnemyCombat | null {
  const client = useCombatStore.getState().enemies[npcId];
  if (client) return client;
  const npc = world?.npcs.find((entry) => entry.id === npcId);
  if (npc?.combat?.defeated) return { hp: 0, maxHp: npc.combat.maxHp, hostile: false, defeated: true, reported: true };
  return null;
}
