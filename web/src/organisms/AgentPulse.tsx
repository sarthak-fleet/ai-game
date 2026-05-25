import { useMemo, useState } from "react";

import type { AgentLoopStatus } from "../../../src/agent-loop.ts";
import type { Npc, TickSummary, World } from "../../../src/types.ts";
import { stepAgentLoop } from "../api/client.ts";
import { useWorldStore } from "../store/world.ts";

interface AgentSpotlight {
  id: string;
  name: string;
  label: string;
  text: string;
  pressure: number;
}

export function AgentPulse() {
  const world = useWorldStore((s) => s.world);
  const lastSummary = useWorldStore((s) => s.lastSummary);
  const status = useWorldStore((s) => s.agentLoopStatus);
  const applyServerTick = useWorldStore((s) => s.applyServerTick);
  const setAgentLoopStatus = useWorldStore((s) => s.setAgentLoopStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recent = useMemo(() => recentAgentAction(world, lastSummary), [world, lastSummary]);
  const spotlights = useMemo(() => agentSpotlights(world), [world]);

  if (!world) return null;

  const step = async () => {
    if (busy || status?.state === "running") return;
    setBusy(true);
    try {
      const result = await stepAgentLoop();
      setAgentLoopStatus(result.status);
      applyServerTick(result.state, result.summary);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="agent-pulse" aria-label="AI agent pulse">
      <div className="agent-pulse-head">
        <span className={`agent-loop-dot ${status?.state ?? "idle"}`} />
        <div>
          <strong>AI agents</strong>
          <small>{agentStatusText(status, world.tick)}</small>
        </div>
        <button type="button" onClick={() => void step()} disabled={busy || status?.state === "running"}>
          {busy ? "..." : status?.state === "running" ? "Live" : "Step"}
        </button>
      </div>
      <p className="agent-pulse-recent">
        <span>{recent?.label ?? "Watching"}</span>
        {recent?.text ?? "No autonomous action yet. Step agents to let the world answer."}
      </p>
      {spotlights.length > 0 && (
        <ol className="agent-pulse-list">
          {spotlights.map((agent) => (
            <li key={agent.id}>
              <span>{agent.name}</span>
              <strong>{agent.label}</strong>
              <small>{agent.text}</small>
              <i style={{ width: `${Math.max(8, Math.min(100, agent.pressure))}%` }} />
            </li>
          ))}
        </ol>
      )}
      {error && <p className="agent-pulse-error">{error}</p>}
    </section>
  );
}

function agentStatusText(status: AgentLoopStatus | null, worldTick: number): string {
  if (!status) return `world tick ${worldTick}`;
  if (status.state === "running") return `live · ${status.ticksRun} ticks`;
  if (status.lastError) return "needs attention";
  return `world ${worldTick} · ${status.ticksRun} agent ticks`;
}

function recentAgentAction(world: World | null, summary: TickSummary | null): { label: string; text: string } | null {
  if (!world || !summary) return null;
  const entry = [...summary.actions].reverse().find((candidate) =>
    candidate.fromDirector || (candidate.action.actorId !== "player" && Boolean(npcById(world, candidate.action.actorId)))
  );
  if (!entry) return null;
  const actor = entry.fromDirector ? "Director" : npcById(world, entry.action.actorId)?.name ?? "Agent";
  return { label: `t${summary.tick} · ${actor}`, text: entry.text };
}

function agentSpotlights(world: World | null): AgentSpotlight[] {
  if (!world) return [];
  return [...world.npcs]
    .sort((a, b) => agentRank(b) - agentRank(a))
    .slice(0, 3)
    .map((npc) => {
      const intent = npc.plan?.currentIntent;
      const goal = npc.ambitions?.find((candidate) => candidate.status !== "satisfied" && candidate.status !== "abandoned");
      const label = intent?.kind ? intent.kind : npc.mood?.emotion ?? npc.role ?? "agent";
      const text = intent?.reason ?? goal?.title ?? npc.plan?.nextActionHint ?? npc.goals?.[0] ?? "Waiting for the next world tick.";
      return {
        id: npc.id,
        name: npc.name,
        label,
        text,
        pressure: spotlightPressure(npc),
      };
    });
}

function agentRank(npc: Npc): number {
  const intentTick = npc.plan?.currentIntent?.updatedTick ?? -1;
  const questWeight = npc.tier === "quest" ? 35 : npc.factionId === "challengers" ? 28 : 0;
  const combatWeight = npc.combat && !npc.combat.defeated ? 18 : 0;
  const moodWeight = Math.max(npc.mood?.stress ?? 0, npc.mood?.suspicion ?? 0, npc.mood?.confidence ?? 0);
  return intentTick * 2 + questWeight + combatWeight + moodWeight;
}

function spotlightPressure(npc: Npc): number {
  const mood = npc.mood;
  const goal = npc.ambitions?.find((candidate) => candidate.status !== "satisfied" && candidate.status !== "abandoned");
  const combatMissing = npc.combat ? 100 - Math.round((npc.combat.hp / Math.max(1, npc.combat.maxHp)) * 100) : 0;
  return Math.max(mood?.stress ?? 0, mood?.suspicion ?? 0, goal?.priority ?? 0, combatMissing);
}

function npcById(world: World, actorId: string | undefined): Npc | undefined {
  return world.npcs.find((npc) => npc.id === actorId);
}
