import { useEffect, useMemo, useState } from "react";

import { type CombatMove, combatMovesFor } from "../../../src/combat.ts";
import { activeObjectives } from "../../../src/objectives.ts";
import type { CombatState, Npc, TickSummary, World } from "../../../src/types.ts";
import { type BubbleEvent, useWorldStore } from "../store/world.ts";

const DEFAULT_PLAYER_COMBAT: CombatState = { hp: 120, maxHp: 120, posture: 100, defeated: false };

export function CombatEncounterOverlay() {
  const world = useWorldStore((s) => s.world);
  const lastSummary = useWorldStore((s) => s.lastSummary);
  const bubbles = useWorldStore((s) => s.bubbles);
  const send = useWorldStore((s) => s.send);
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 80);
    return () => window.clearInterval(id);
  }, []);

  const enemyTurn = useMemo(() => enemyTurnWindow(bubbles, now), [bubbles, now]);

  const playerCombat = world?.player.combat ?? DEFAULT_PLAYER_COMBAT;
  const routeComplete = world?.storyProgress?.phase === "dawn_after_tasks";
  const resolution = world ? combatResolution(world, lastSummary) : null;
  const target = world ? currentEncounterTarget(world, lastSummary) : null;
  const recovering = !target && (playerCombat.defeated || (!routeComplete && (playerCombat.hp < playerCombat.maxHp || playerCombat.posture < 100)));
  const combatMoves = useMemo(() => world ? combatMovesFor(world) : [], [world]);
  const playerName = world?.player.name ?? "Player";
  const read = target ? encounterRead(playerCombat, target, enemyTurn.active) : null;
  const styleRead = target && world ? combatStyleRead(world, playerCombat, target, combatMoves) : null;

  const targetId = target?.id;
  const targetCombat = target?.combat;
  const sendMove = async (move: CombatMove) => {
    if (!targetId || playerCombat.defeated || enemyTurn.active) return;
    await send({
      type: "fight",
      targetId,
      moveId: move.id,
      text: `${move.label}: ${move.description}`,
    } as never);
  };

  useEffect(() => {
    if (!targetId || playerCombat.defeated || enemyTurn.active) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (event.target instanceof HTMLElement && /^(input|textarea|select)$/i.test(event.target.tagName)) return;
      const index = Number(event.key) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= combatMoves.length) return;
      const move = combatMoves[index];
      if (!move) return;
      const plan = movePlan(move, playerCombat, targetCombat);
      if (plan.disabled) return;
      event.preventDefault();
      void send({
        type: "fight",
        targetId,
        moveId: move.id,
        text: `${move.label}: ${move.description}`,
      } as never);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [combatMoves, enemyTurn.active, playerCombat, send, targetCombat, targetId]);

  if (!world) return null;
  if (routeComplete && resolution?.kind === "victory") return null;
  if (!resolution && !target && !recovering) return null;

  if (resolution) {
    return (
      <section className={`combat-encounter combat-resolution ${resolution.kind}`} aria-label="Combat result">
        <div className="combat-resolution-copy">
          <span>{resolution.kind === "victory" ? "Victory" : "Downed"}</span>
          <strong>{resolution.kind === "victory" ? `${resolution.target.name} is down` : `${playerName} needs to recover`}</strong>
          <p>
            {resolution.kind === "victory"
              ? "The immediate threat is cleared. The patrol can move on."
              : "You lost the exchange. Recover before forcing another fight."}
          </p>
        </div>
        <div className="combat-encounter-roster">
          <CombatantReadout name={playerName} label={playerCombat.defeated ? "Down" : "Player"} combat={playerCombat} />
          <div className="combat-lock-mark" aria-hidden="true">{resolution.kind === "victory" ? "KO" : "RESET"}</div>
          {resolution.kind === "victory" ? (
            <CombatantReadout name={resolution.target.name} label="Defeated" combat={resolution.target.combat} hostile />
          ) : (
            <div className="combatant-readout empty">
              <strong>Breathing room</strong>
              <span>The next beat starts after recovery.</span>
            </div>
          )}
        </div>
        <button type="button" className="encounter-recover" onClick={() => void send(null)}>
          {resolution.kind === "victory" ? "Continue patrol" : "Recover"}
        </button>
      </section>
    );
  }

  return (
    <section className={`combat-encounter ${target ? "locked" : "recovery"}${enemyTurn.active ? " enemy-turn" : ""}`} aria-label="Combat encounter" aria-busy={enemyTurn.active}>
      <div className="combat-encounter-roster">
        <CombatantReadout name={playerName} label={playerCombat.defeated ? "Down" : "Player"} combat={playerCombat} />
        <div className="combat-lock-mark" aria-hidden="true">{enemyTurn.active ? "WAIT" : target ? "VS" : "RECOVER"}</div>
        {target ? (
          <CombatantReadout name={target.name} label={target.factionId === "challengers" ? "Hostile" : "Target"} combat={target.combat} hostile />
        ) : (
          <div className="combatant-readout empty">
            <strong>Clear</strong>
            <span>No hostile target nearby.</span>
          </div>
        )}
      </div>
      {styleRead && <CombatStyleReadout read={styleRead} />}
      {read && <BattleReadout read={read} />}
      {target ? (
        <div className="encounter-moves" aria-label="Encounter moves">
          {enemyTurn.active && (
            <div className="combat-turn-lock" aria-live="polite">
              <span>Enemy turn</span>
              <strong>{enemyTurn.label}</strong>
            </div>
          )}
          {combatMoves.map((move, index) => {
            const plan = movePlan(move, playerCombat, target.combat);
            const disabled = playerCombat.defeated || enemyTurn.active || plan.disabled;
            return (
              <button
                key={move.id}
                type="button"
                className={`encounter-move ${move.style}${plan.recommended ? " recommended" : ""}${plan.caution ? " caution" : ""}`}
                disabled={disabled}
                onClick={() => void sendMove(move)}
              >
                <kbd className="encounter-shortcut" aria-hidden="true">{index + 1}</kbd>
                <span>{move.style}</span>
                <strong>{move.label}</strong>
                <small>{move.damage} dmg / {move.postureDamage} pst</small>
                <em>{plan.label}</em>
              </button>
            );
          })}
        </div>
      ) : (
        <button type="button" className="encounter-recover" onClick={() => void send(null)}>
          Recover
        </button>
      )}
    </section>
  );
}

interface EncounterRead {
  label: string;
  text: string;
  intent?: string;
}

interface CombatStyleRead {
  style: string;
  rank: "S" | "A" | "B" | "C";
  tempo: string;
  finisher: string;
  next: string;
  intent?: string;
  assist?: {
    label: string;
    text: string;
  };
}

function CombatStyleReadout({ read }: { read: CombatStyleRead }) {
  return (
    <div className={`combat-style-readout rank-${read.rank.toLowerCase()}`} aria-label="Combat style">
      <div>
        <span>{read.style}</span>
        <strong>Style rank {read.rank}</strong>
      </div>
      <dl>
        <div>
          <dt>Tempo</dt>
          <dd>{read.tempo}</dd>
        </div>
        <div>
          <dt>Finisher</dt>
          <dd>{read.finisher}</dd>
        </div>
        <div>
          <dt>Next beat</dt>
          <dd>{read.next}</dd>
        </div>
      </dl>
      {read.intent && <p>Agent intent: {read.intent}</p>}
      {read.assist && (
        <p className="combat-assist-read">
          <span>{read.assist.label}</span>
          {read.assist.text}
        </p>
      )}
    </div>
  );
}

function BattleReadout({ read }: { read: EncounterRead }) {
  return (
    <div className="battle-readout" aria-label="Battle read">
      <span>{read.label}</span>
      <strong>{read.text}</strong>
      {read.intent && <small>{read.intent}</small>}
    </div>
  );
}

function CombatantReadout({ name, label, combat, hostile = false }: { name: string; label: string; combat?: CombatState; hostile?: boolean }) {
  const state = combat ?? { hp: 100, maxHp: 100, posture: 100, defeated: false };
  return (
    <div className={`combatant-readout${hostile ? " hostile" : ""}${state.defeated ? " defeated" : ""}`}>
      <span>{label}</span>
      <strong>{name}</strong>
      <Meter label="HP" value={state.hp} max={state.maxHp} danger={state.hp <= state.maxHp * 0.32} />
      <Meter label="Posture" value={state.posture} max={100} danger={state.posture <= 30} />
    </div>
  );
}

function encounterRead(playerCombat: CombatState, target: Npc, enemyTurnActive: boolean): EncounterRead {
  const targetCombat = target.combat ?? { hp: 100, maxHp: 100, posture: 100, defeated: false };
  const intent = target.plan?.currentIntent?.reason ? `Intent: ${target.plan.currentIntent.reason}` : target.mood?.emotion ? `Mood: ${target.mood.emotion}` : undefined;
  if (enemyTurnActive) {
    return { label: "Enemy turn", text: `${target.name} is answering your last move.`, intent };
  }
  if (playerCombat.hp <= playerCombat.maxHp * 0.35 || playerCombat.posture <= 30) {
    return { label: "Under pressure", text: "Your HP or posture is low; defensive moves reduce the next counter.", intent };
  }
  if (targetCombat.posture <= 45) {
    return { label: "Opening", text: `${target.name}'s posture is broken. A finisher can close the exchange.`, intent };
  }
  if (targetCombat.hp <= targetCombat.maxHp * 0.45) {
    return { label: "Finish window", text: `${target.name} is hurt. Push damage or end it before they reset.`, intent };
  }
  if (targetCombat.posture >= 65) {
    return { label: "Break posture", text: `${target.name} is steady. Counters and guard breaks create the first real opening.`, intent };
  }
  return { label: "Tempo", text: `${target.name} is losing shape. Chain pressure into a decisive move.`, intent };
}

function combatStyleRead(world: World, playerCombat: CombatState, target: Npc, moves: CombatMove[]): CombatStyleRead {
  const targetCombat = target.combat ?? { hp: 100, maxHp: 100, posture: 100, defeated: false };
  const hpPct = targetCombat.hp / Math.max(1, targetCombat.maxHp);
  const pressure = (1 - hpPct) * 58 + (100 - targetCombat.posture) * 0.42;
  const playerSafety = (playerCombat.hp / Math.max(1, playerCombat.maxHp)) * 0.65 + (playerCombat.posture / 100) * 0.35;
  const rank: CombatStyleRead["rank"] = pressure >= 72 && playerSafety >= 0.45
    ? "S"
    : pressure >= 50
      ? "A"
      : pressure >= 28
        ? "B"
        : "C";
  const finisherReady = targetCombat.posture <= 45 || hpPct <= 0.45;
  const style = characterStyleName(world);
  const next = finisherReady
    ? moves.find((move) => move.style === "finisher")?.label ?? "Finisher"
    : moves.find((move) => movePlan(move, playerCombat, targetCombat).recommended && move.style !== "finisher")?.label
      ?? moves.find((move) => move.style === "counter")?.label
      ?? moves[0]?.label
      ?? "Strike";
  const intent = target.plan?.currentIntent?.reason ?? target.mood?.emotion;
  const assist = activeCombatAssist(world, target);

  return {
    style,
    rank,
    tempo: pressure >= 50 ? "Advantage" : playerSafety <= 0.42 ? "Survive" : "Build",
    finisher: finisherReady ? "Ready" : "Locked",
    next,
    intent: intent ? truncate(intent, 92) : undefined,
    assist,
  };
}

function activeCombatAssist(world: World, target: Npc): CombatStyleRead["assist"] {
  if (world.id !== "opm_z_city" || target.id !== "pax") return undefined;
  const witness = world.npcs.find((npc) => npc.id === "lena");
  const active = witness?.memories.some((memory) => /witness assist: overpass civilians clear/i.test(memory.text)) ?? false;
  if (!active) return undefined;
  return {
    label: "Mumen assist",
    text: "Witness angle active; Sonic counters are reduced.",
  };
}

function characterStyleName(world: World): string {
  const selected = world.player.characterId ? world.npcs.find((npc) => npc.id === world.player.characterId) : null;
  const tags = selected?.appearance?.visualTags ?? world.player.appearance?.visualTags ?? [];
  if (tags.some((tag) => /psychic|telekinetic/i.test(tag))) return "Psychic style";
  if (tags.some((tag) => /cyborg|mechanical|machine/i.test(tag))) return "Cyborg style";
  if (tags.some((tag) => /justice|bike|rider|heroic/i.test(tag))) return "Justice style";
  if (world.id === "opm_z_city") return "Hero style";
  return "Adventurer style";
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function movePlan(move: CombatMove, playerCombat: CombatState, targetCombat: CombatState | undefined): { label: string; recommended: boolean; caution: boolean; disabled?: boolean } {
  const target = targetCombat ?? { hp: 100, maxHp: 100, posture: 100, defeated: false };
  if (move.style === "finisher") {
    const ready = target.posture <= 45 || target.hp <= target.maxHp * 0.45;
    return { label: ready ? "Close" : "Build opening", recommended: ready, caution: !ready, disabled: !ready };
  }
  if (move.style === "guard") {
    const recommended = playerCombat.hp <= playerCombat.maxHp * 0.45 || playerCombat.posture <= 42;
    return { label: recommended ? "Stabilize" : "Brace", recommended, caution: false };
  }
  if (move.style === "counter") {
    const recommended = target.posture > 35;
    return { label: recommended ? "Break angle" : "Reset", recommended, caution: false };
  }
  if (move.style === "rush") {
    const recommended = target.hp > target.maxHp * 0.5 && target.posture > 25;
    return { label: recommended ? "Pressure" : "Chase", recommended, caution: false };
  }
  if (move.style === "special") {
    const recommended = target.hp <= target.maxHp * 0.55 || target.posture <= 55;
    return { label: recommended ? "Swing beat" : "Burst", recommended, caution: false };
  }
  const recommended = target.posture <= 55 || target.hp <= target.maxHp * 0.55;
  return { label: recommended ? "Punish" : "Chip", recommended, caution: false };
}

function Meter({ label, value, max, danger }: { label: string; value: number; max: number; danger?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={`combat-meter${danger ? " danger" : ""}`}>
      <em>{label}</em>
      <i style={{ width: `${pct}%` }} />
      <b>{value}/{max}</b>
    </div>
  );
}

function currentEncounterTarget(world: World, lastSummary: TickSummary | null): Npc | null {
  if (world.player.combat?.defeated) return null;
  const recentFight = [...(lastSummary?.actions ?? [])].reverse().find((entry) =>
    entry.action.type === "fight" &&
    (entry.action.actorId === "player" || entry.action.targetId === "player")
  );
  if (recentFight?.action.type === "fight") {
    const targetId = recentFight.action.actorId === "player" ? recentFight.action.targetId : recentFight.action.actorId;
    const target = combatTargetById(world, targetId);
    if (target) return target;
  }

  const objective = activeObjectives(world)[0];
  if (objective?.storyAction === "fight_challenger") {
    const target = combatTargetById(world, objective.storyTargetId ?? "pax");
    if (target) return target;
  }

  return world.npcs.find((npc) =>
    npc.locationId === world.player.locationId &&
    npc.id !== world.player.characterId &&
    !npc.combat?.defeated &&
    (npc.combat?.hp ?? npc.combat?.maxHp ?? 0) > 0 &&
    ((npc.combat?.hp ?? npc.combat?.maxHp ?? 0) < (npc.combat?.maxHp ?? 0) || (npc.combat?.posture ?? 100) < 100)
  ) ?? null;
}

function combatTargetById(world: World, targetId: string): Npc | null {
  const target = world.npcs.find((npc) =>
    npc.id === targetId &&
    npc.locationId === world.player.locationId &&
    npc.id !== world.player.characterId &&
    !npc.combat?.defeated
  );
  return target ?? null;
}

function combatResolution(world: World, lastSummary: TickSummary | null): { kind: "victory"; target: Npc } | { kind: "defeat" } | null {
  if (world.player.combat?.defeated) return { kind: "defeat" };
  const recentFight = [...(lastSummary?.actions ?? [])].reverse().find((entry) =>
    entry.action.type === "fight" &&
    entry.action.actorId === "player" &&
    entry.action.targetId !== "player"
  );
  const action = recentFight?.action;
  if (!action || action.type !== "fight") return null;
  const target = world.npcs.find((npc) => npc.id === action.targetId);
  if (!target?.combat?.defeated) return null;
  return { kind: "victory", target };
}

function enemyTurnWindow(bubbles: BubbleEvent[], now: number): { active: boolean; label: string } {
  const counter = [...bubbles]
    .reverse()
    .find((bubble) => {
      if (
        bubble.actionType !== "fight" ||
        bubble.actorId !== "player" ||
        bubble.sourceActorId === null ||
        bubble.sourceActorId === "player" ||
        bubble.combatStyle !== "counter" ||
        bubble.expiresAt <= now
      ) {
        return false;
      }
      const lockStartsAt = bubble.startsAt - 520;
      return lockStartsAt <= now && now < bubble.startsAt + 900;
    });
  if (!counter) return { active: false, label: "" };
  if (now < counter.startsAt) {
    const remaining = Math.max(0, Math.ceil((counter.startsAt - now) / 100) / 10);
    return { active: true, label: `Counter in ${remaining.toFixed(1)}s` };
  }
  return { active: true, label: "Resolving counter" };
}
