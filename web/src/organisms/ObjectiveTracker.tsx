import { useEffect } from "react";

import { combatMovesFor } from "../../../src/combat.ts";
import { questHintsFor } from "../../../src/hints.ts";
import { activeObjectives, type Objective } from "../../../src/objectives.ts";
import { questItemTargetsFor } from "../../../src/quest-targets.ts";
import { STARTER_QUEST_IDS } from "../../../src/story-progress.ts";
import type { PlayerAction, Quest, World } from "../../../src/types.ts";
import { Button } from "../atoms/Button.tsx";
import { useWorldStore } from "../store/world.ts";
import { movePlayerToward } from "../world-travel.ts";

type ChapterStepState = "done" | "active" | "locked";
interface ChapterStep {
  label: string;
  detail?: string;
  state: ChapterStepState;
}

export function ObjectiveTracker() {
  const world = useWorldStore((s) => s.world);
  const send = useWorldStore((s) => s.send);
  const openDrawer = useWorldStore((s) => s.openDrawer);
  if (!world) return null;
  return <ObjectiveTrackerContent world={world} send={send} openDrawer={openDrawer} />;
}

function ObjectiveTrackerContent({
  world,
  send,
  openDrawer,
}: {
  world: World;
  send: (action: PlayerAction | null) => Promise<void>;
  openDrawer: (npcId: string) => void;
}) {
  const chapter = chapterProgress(world);
  const objective = activeObjectives(world)[0];
  const storyTarget = objective?.storyTargetId ? world.npcs.find((npc) => npc.id === objective.storyTargetId) ?? null : null;
  const objectiveTargetNpc = objective?.targetType === "npc" ? world.npcs.find((npc) => npc.id === objective.targetId) ?? null : null;
  const storyTargetHere = Boolean(storyTarget && storyTarget.locationId === world.player.locationId && !storyTarget.combat?.defeated);
  const combatCommandActive = Boolean(objective && objective.storyAction === "fight_challenger" && storyTargetHere);
  const canMove = Boolean(objective && !storyTargetHere && world.player.locationId !== objective.locationId);
  const quest = objective ? (world.quests ?? []).find((candidate) => candidate.id === objective.questId) : undefined;

  useEffect(() => {
    if (!objective || combatCommandActive) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLElement && /^(input|textarea|select)$/i.test(event.target.tagName)) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      if (!objectiveActionAvailable(objective, canMove)) return;
      event.preventDefault();
      performObjectiveAction({ world, objective, canMove, storyTarget, quest, send, openDrawer });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canMove, combatCommandActive, objective, openDrawer, quest, send, storyTarget, world]);

  if (!objective) {
    const completed = (world.quests ?? []).filter((quest) => quest.status === "done").length;
    if (completed === 0) return null;
    return (
      <section className="objective-tracker complete" aria-label="Current objective">
        <div>
          <span>Complete</span>
          <strong>Starter path complete</strong>
          <p>All starter tasks are resolved. You can keep exploring, talking, saving, or waiting.</p>
          <ChapterProgress steps={chapter} />
        </div>
      </section>
    );
  }
  const resolved = objective.status === "done";
  const hint = quest ? questHintsFor(world, quest).at(-1) : null;
  const open = objective.status === "open";
  const here = !canMove;
  const handoverTarget = quest?.status === "active" && objective.targetType === "npc"
    ? questItemTargetsFor(world, quest).find((candidate) =>
      candidate.returnNpcId === objective.targetId &&
      world.items.some((item) => item.id === candidate.itemId && item.holderId === "player")
    )
    : null;

  const act = () => {
    performObjectiveAction({ world, objective, canMove, storyTarget, quest, send, openDrawer });
  };

  const actionLabel = canMove
    ? "Go"
    : objective.actionLabel ?? (objective.targetType === "npc"
      ? "Talk"
      : objective.targetType === "item"
        ? "Pick up"
        : "Here");
  const nextInstruction = combatCommandActive
    ? "Choose a fight move below."
    : objective.text;
  const contextLine = canMove
    ? `Quest: ${objective.questTitle}`
    : here && objective.targetType === "npc"
      ? `Talk to ${objectiveTargetNpc?.name ?? storyTarget?.name ?? objective.questTitle}`
      : `Quest: ${objective.questTitle}`;
  const buttonLabel = canMove
    ? "Go"
    : quest?.status === "open" && objective.targetType === "npc"
      ? "Start"
      : handoverTarget
        ? "Hand over"
        : actionLabel === "Here"
          ? "Do it"
          : actionLabel;

  return (
    <section className={`objective-tracker${resolved ? " complete" : ""}`} aria-label="Current objective">
      <div>
        <span>{resolved ? "Complete" : combatCommandActive ? "Fight" : open ? "New task" : "Next step"}</span>
        <strong>{nextInstruction}</strong>
        <p>{combatCommandActive ? `${objective.questTitle}: press 1-6 to attack.` : contextLine}</p>
        {hint && (
          <p className="objective-hint">
            <small>Hint</small>
            {hint.text}
          </p>
        )}
        <ChapterProgress steps={chapter} />
      </div>
      {!resolved && !combatCommandActive && (canMove || objective.targetType !== "location" || objective.storyAction) && (
        <div className="objective-actions">
          {(canMove || objective.targetType !== "location" || objective.storyAction) && (
            <Button onClick={act} variant={here ? "primary" : "default"}>
              {buttonLabel}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function storyFightOpeningMoveId(world: World): string {
  const moves = combatMovesFor(world);
  return moves.find((move) => move.style === "rush")?.id ?? moves.find((move) => move.style !== "finisher")?.id ?? moves[0]?.id ?? "quick_strike";
}

function objectiveActionAvailable(objective: Objective, canMove: boolean): boolean {
  return canMove || objective.targetType !== "location" || Boolean(objective.storyAction);
}

function performObjectiveAction({
  world,
  objective,
  canMove,
  storyTarget,
  quest,
  send,
  openDrawer,
}: {
  world: World;
  objective: Objective;
  canMove: boolean;
  storyTarget: World["npcs"][number] | null;
  quest: Quest | undefined;
  send: (action: PlayerAction | null) => Promise<void>;
  openDrawer: (npcId: string) => void;
}): void {
  const storyTargetHere = Boolean(storyTarget && storyTarget.locationId === world.player.locationId && !storyTarget.combat?.defeated);
  if (objective.storyAction === "confront_shadow" && (!canMove || storyTargetHere)) {
    void send({
      type: "confront",
      targetId: objective.storyTargetId ?? "lena",
      text: objective.text,
    } as never);
    return;
  }
  if (objective.storyAction === "fight_challenger" && (!canMove || storyTargetHere)) {
    void send({
      type: "fight",
      targetId: objective.storyTargetId ?? "pax",
      moveId: storyFightOpeningMoveId(world),
      text: objective.text,
    } as never);
    return;
  }
  if (canMove) {
    void movePlayerToward(storyTarget?.locationId ?? objective.locationId);
    return;
  }
  if (quest?.status === "open" && objective.targetType === "npc") {
    void send({ type: "accept_quest", questId: quest.id } as never);
    return;
  }
  if (quest?.status === "active" && objective.targetType === "npc") {
    const target = questItemTargetsFor(world, quest).find((candidate) =>
      candidate.returnNpcId === objective.targetId &&
      world.items.some((item) => item.id === candidate.itemId && item.holderId === "player")
    );
    if (target) {
      void send({ type: "give", itemId: target.itemId, targetId: target.returnNpcId } as never);
      return;
    }
  }
  if (objective.targetType === "npc") {
    openDrawer(objective.targetId);
    return;
  }
  if (objective.targetType === "item") {
    void send({ type: "pickup", itemId: objective.targetId } as never);
  }
}

function ChapterProgress({ steps }: { steps: ChapterStep[] }) {
  const active = steps.find((step) => step.state === "active") ?? steps.find((step) => step.state === "locked") ?? steps.at(-1);
  return (
    <ol className="chapter-progress" aria-label={`Chapter progress: ${active?.label ?? "route"}`}>
      {steps.map((step) => (
        <li key={step.label} className={`chapter-step ${step.state}`}>
          <b>{step.label}</b>
          {step.detail && <em>{step.detail}</em>}
        </li>
      ))}
    </ol>
  );
}

function chapterProgress(world: World): ChapterStep[] {
  const starterQuests = STARTER_QUEST_IDS
    .map((questId) => (world.quests ?? []).find((quest) => quest.id === questId))
    .filter((quest): quest is Quest => Boolean(quest));
  const requiredQuests = starterQuests.length > 0 ? starterQuests : (world.quests ?? []).slice(0, STARTER_QUEST_IDS.length);
  const starterDone = requiredQuests.filter((quest) => quest.status === "done").length;
  const starterTotal = Math.max(STARTER_QUEST_IDS.length, requiredQuests.length);
  const phase = world.storyProgress?.phase ?? "starter";
  const errandsDone = phase !== "starter" || starterDone >= starterTotal;
  const alertDone = phase === "shadow_confrontation" || phase === "dawn_after_tasks";
  const fightDone = phase === "dawn_after_tasks";

  return [
    {
      label: "Errands",
      detail: `${Math.min(starterDone, starterTotal)}/${starterTotal}`,
      state: errandsDone ? "done" : "active",
    },
    {
      label: "Alert",
      state: alertDone ? "done" : phase === "nightfall_warning" ? "active" : "locked",
    },
    {
      label: "Fight",
      state: fightDone ? "done" : phase === "shadow_confrontation" ? "active" : "locked",
    },
    {
      label: "Clear",
      state: phase === "dawn_after_tasks" ? "done" : "locked",
    },
  ];
}
