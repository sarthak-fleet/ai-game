import { useEffect, useMemo, useState } from "react";

import type { TickSummary, World } from "../../../src/types.ts";
import { Button } from "../atoms/Button.tsx";
import { type BubbleEvent, useWorldStore } from "../store/world.ts";

export function RouteCompleteOverlay() {
  const world = useWorldStore((s) => s.world);
  const lastSummary = useWorldStore((s) => s.lastSummary);
  const bubbles = useWorldStore((s) => s.bubbles);
  const send = useWorldStore((s) => s.send);
  const resetEpisode = useWorldStore((s) => s.resetEpisode);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 180);
    return () => window.clearInterval(id);
  }, []);

  const summary = useMemo(() => {
    if (!world || world.storyProgress?.phase !== "dawn_after_tasks") return null;
    if (hasFreshVictoryResolution(world, lastSummary, bubbles, now)) return null;
    const routeKey = episodeClearKey(world);
    const questsDone = (world.quests ?? []).filter((quest) => quest.status === "done").length;
    const questsTotal = world.quests?.length ?? 0;
    const tensionsResolved = (world.tensions ?? []).filter((tension) => tension.status === "resolved").length;
    const tensionsTotal = world.tensions?.length ?? 0;
    const defeatedHostiles = world.npcs.filter((npc) => npc.combat?.defeated).length;
    const agentMemories = world.npcs.reduce((total, npc) => total + npc.memories.length, 0);
    const rank = routeRank(world, questsDone, questsTotal, tensionsResolved, tensionsTotal);
    const title = world.id === "opm_z_city" ? "Z-City Patrol Cleared" : `${world.name} Route Cleared`;
    const copy = world.id === "opm_z_city"
      ? "The grocery coupon, cyborg core, overpass proof, and Sonic challenge are resolved."
      : "The starter route has reached its first stable ending.";
    const epilogue = routeEpilogue(world);
    const rewards = routeRewards(world, rank, defeatedHostiles, agentMemories);

    return {
      routeKey,
      title,
      copy,
      epilogue,
      rewards,
      rank,
      stats: [
        ["Rank", rank.label],
        ["Quests", `${questsDone}/${questsTotal}`],
        ["Tensions", `${tensionsResolved}/${tensionsTotal}`],
        ["Hostiles", String(defeatedHostiles)],
        ["Time", `D${world.clock.day} ${String(world.clock.hour).padStart(2, "0")}:00`],
      ],
      footer: `${agentMemories} agent memories recorded across ${world.tick} world ticks.`,
    };
  }, [bubbles, lastSummary, now, world]);

  const record = useMemo(() => {
    if (!summary || !world) return null;
    return recordEpisodeClear(world.id, summary.routeKey, summary.rank.tier, world.player.name ?? "Hero");
  }, [summary, world]);

  if (!summary || dismissedKey === summary.routeKey) return null;

  return (
    <section className="route-complete" aria-label="Route complete">
      <div className="route-complete-copy">
        <span>Episode Clear</span>
        <strong>{summary.title}</strong>
        <p>{summary.copy}</p>
      </div>
      <div className={`route-complete-rank rank-${summary.rank.tier.toLowerCase()}`} aria-label={`Patrol rank ${summary.rank.label}`}>
        <span>Patrol rank</span>
        <strong>{summary.rank.label}</strong>
        <p>{summary.rank.reason}</p>
      </div>
      <div className="route-complete-actions">
        <Button variant="primary" onClick={() => setDismissedKey(summary.routeKey)}>Keep exploring</Button>
        <Button onClick={() => void resetEpisode()}>Replay episode</Button>
        <Button onClick={() => void send(null)}>Let agents react</Button>
      </div>
      <dl className="route-complete-stats">
        {summary.stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="route-complete-rewards" aria-label="Episode rewards">
        {summary.rewards.map((reward) => (
          <div key={reward.label}>
            <span>{reward.label}</span>
            <strong>{reward.value}</strong>
            <small>{reward.text}</small>
          </div>
        ))}
      </div>
      {record && (
        <dl className="route-complete-record" aria-label="Episode record">
          <div>
            <dt>Best rank</dt>
            <dd>{record.bestRank}</dd>
          </div>
          <div>
            <dt>Clears</dt>
            <dd>{record.clears}</dd>
          </div>
          <div>
            <dt>Last hero</dt>
            <dd>{record.lastHero}</dd>
          </div>
        </dl>
      )}
      {summary.epilogue.length > 0 && (
        <ol className="route-complete-epilogue" aria-label="Route epilogue">
          {summary.epilogue.map((beat) => (
            <li key={beat.name}>
              <span>{beat.name}</span>
              <strong>{beat.status}</strong>
              <small>{beat.text}</small>
            </li>
          ))}
        </ol>
      )}
      <p className="route-complete-footnote">{summary.footer}</p>
    </section>
  );
}

function routeRank(
  world: World,
  questsDone: number,
  questsTotal: number,
  tensionsResolved: number,
  tensionsTotal: number
): { tier: "S" | "A" | "B"; label: string; reason: string } {
  const playerCombat = world.player.combat;
  const hpPct = playerCombat ? playerCombat.hp / Math.max(1, playerCombat.maxHp) : 1;
  const allQuests = questsTotal === 0 || questsDone >= questsTotal;
  const allTensions = tensionsTotal === 0 || tensionsResolved >= tensionsTotal;
  if (allQuests && allTensions && hpPct >= 0.75) {
    return { tier: "S", label: "S", reason: "Clean patrol: every errand closed, threat resolved, hero still standing strong." };
  }
  if (allQuests && allTensions) {
    return { tier: "A", label: "A", reason: "Route clear: the city is safe, but the last exchange left a mark." };
  }
  return { tier: "B", label: "B", reason: "Stable ending: the route is playable, with unresolved pressure left to chase." };
}

interface EpisodeRecord {
  clears: number;
  bestRank: "S" | "A" | "B";
  lastHero: string;
  recordedKeys: string[];
}

function recordEpisodeClear(worldId: string, routeKey: string, rank: "S" | "A" | "B", hero: string): EpisodeRecord {
  const storageKey = `ai-game:episode-record:${worldId}`;
  const previous = readEpisodeRecord(storageKey);
  const alreadyRecorded = previous.recordedKeys.includes(routeKey);
  const next: EpisodeRecord = alreadyRecorded
    ? { ...previous, bestRank: betterRank(previous.bestRank, rank), lastHero: hero }
    : {
        clears: previous.clears + 1,
        bestRank: betterRank(previous.bestRank, rank),
        lastHero: hero,
        recordedKeys: [...previous.recordedKeys, routeKey].slice(-12),
      };
  window.localStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}

function readEpisodeRecord(storageKey: string): EpisodeRecord {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as Partial<EpisodeRecord> | null;
    if (!parsed || typeof parsed !== "object") return emptyEpisodeRecord();
    const bestRank = parsed.bestRank === "S" || parsed.bestRank === "A" || parsed.bestRank === "B" ? parsed.bestRank : "B";
    return {
      clears: typeof parsed.clears === "number" && Number.isFinite(parsed.clears) ? Math.max(0, parsed.clears) : 0,
      bestRank,
      lastHero: typeof parsed.lastHero === "string" && parsed.lastHero ? parsed.lastHero : "Hero",
      recordedKeys: Array.isArray(parsed.recordedKeys) ? parsed.recordedKeys.filter((key): key is string => typeof key === "string") : [],
    };
  } catch {
    return emptyEpisodeRecord();
  }
}

function emptyEpisodeRecord(): EpisodeRecord {
  return { clears: 0, bestRank: "B", lastHero: "Hero", recordedKeys: [] };
}

function episodeClearKey(world: World): string {
  return `${world.id}:run-${activeEpisodeRunId(world.id)}:clear`;
}

function activeEpisodeRunId(worldId: string): number {
  try {
    const value = Number.parseInt(window.localStorage.getItem(`ai-game:episode-run:${worldId}`) ?? "0", 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function betterRank(a: "S" | "A" | "B", b: "S" | "A" | "B"): "S" | "A" | "B" {
  const order = { S: 3, A: 2, B: 1 };
  return order[b] > order[a] ? b : a;
}

function routeRewards(
  world: World,
  rank: { tier: "S" | "A" | "B"; label: string; reason: string },
  defeatedHostiles: number,
  agentMemories: number
): Array<{ label: string; value: string; text: string }> {
  const selected = world.player.characterId ? world.npcs.find((npc) => npc.id === world.player.characterId) : null;
  const playerName = world.player.name ?? selected?.name ?? "Hero";
  const styleTitle = routeStyleTitle(world, selected?.appearance?.visualTags ?? world.player.appearance?.visualTags ?? []);
  const nextThreat = world.villainPlans?.find((plan) => plan.hidden === false || plan.stage > 0)?.nextTrigger
    ?? world.directorState?.pendingReveals?.at(-1)
    ?? "The next loop can escalate from the cleared route state.";

  return [
    {
      label: "Hero title",
      value: `${rank.label}-Rank ${playerName}`,
      text: rank.tier === "S" ? "Clean clear title unlocked for this route." : "Route clear title unlocked for replay.",
    },
    {
      label: "Style unlock",
      value: styleTitle,
      text: defeatedHostiles > 0 ? `${defeatedHostiles} hostile beaten with this style.` : "Style tracked for future confrontations.",
    },
    {
      label: "AI aftermath",
      value: `${agentMemories} memories`,
      text: nextThreat,
    },
  ];
}

function routeStyleTitle(world: World, tags: string[]): string {
  if (tags.some((tag) => /psychic|telekinetic/i.test(tag))) return "Psychic Specialist";
  if (tags.some((tag) => /cyborg|mechanical|machine/i.test(tag))) return "Cyborg Breaker";
  if (tags.some((tag) => /justice|bike|rider|heroic/i.test(tag))) return "Justice Finisher";
  if (world.id === "opm_z_city") return "Hero Association Finisher";
  return "Route Stabilizer";
}

function routeEpilogue(world: World): Array<{ name: string; status: string; text: string }> {
  const important = world.npcs
    .filter((npc) => npc.tier === "quest" || npc.combat?.defeated || npc.factionId === "challengers")
    .slice(0, 4);
  return important.map((npc) => {
    const memory = [...npc.memories].reverse().find((entry) =>
      /defeated|cleared|complete|alert|threat|quest outcome|challenge/i.test(entry.text)
    ) ?? npc.memories.at(-1);
    const activeGoal = npc.ambitions?.find((ambition) => ambition.status === "active");
    const abandonedGoal = npc.ambitions?.find((ambition) => ambition.status === "abandoned");
    return {
      name: npc.name,
      status: npc.combat?.defeated ? "Defeated" : abandonedGoal ? "Interrupted" : activeGoal ? "Continuing" : "Settled",
      text: memory?.text ?? activeGoal?.title ?? npc.plan?.nextActionHint ?? "No new aftermath recorded.",
    };
  });
}

function hasFreshVictoryResolution(world: World, lastSummary: TickSummary | null, bubbles: BubbleEvent[], now: number): boolean {
  const latestSummaryWasVictory = (lastSummary?.actions ?? []).some((entry) => {
    const action = entry.action;
    if (action.type !== "fight" || action.actorId !== "player" || action.targetId === "player") return false;
    return Boolean(world.npcs.find((npc) => npc.id === action.targetId)?.combat?.defeated);
  });
  if (!latestSummaryWasVictory) return false;
  return bubbles.some((bubble) => bubble.actionType === "fight" && bubble.startsAt <= now && bubble.expiresAt > now);
}
