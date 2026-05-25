import { lazy, Suspense, useEffect, useRef, useState } from "react";

import { ActionBar } from "../organisms/ActionBar.tsx";
import { AgentLoopPanel } from "../organisms/AgentLoopPanel.tsx";
import { AgentPulse } from "../organisms/AgentPulse.tsx";
import { AmbienceToggle } from "../organisms/AmbienceToggle.tsx";
import { AppHeader } from "../organisms/AppHeader.tsx";
import { CombatEncounterOverlay } from "../organisms/CombatEncounterOverlay.tsx";
import { CutsceneList } from "../organisms/CutsceneList.tsx";
import { CutscenePlayer } from "../organisms/CutscenePlayer.tsx";
import { ErrorBoundary } from "../organisms/ErrorBoundary.tsx";
import { EventLog } from "../organisms/EventLog.tsx";
import { FightCinematicOverlay } from "../organisms/FightCinematicOverlay.tsx";
import { FocusQuickSlots } from "../organisms/FocusQuickSlots.tsx";
import { InventoryPanel } from "../organisms/InventoryPanel.tsx";
import { MusicToggle } from "../organisms/MusicToggle.tsx";
import { NpcDrawer } from "../organisms/NpcDrawer.tsx";
import { ObjectiveTracker } from "../organisms/ObjectiveTracker.tsx";
import { OutcomeToast } from "../organisms/OutcomeToast.tsx";
import { PlayerStatus } from "../organisms/PlayerStatus.tsx";
import { QuestList } from "../organisms/QuestList.tsx";
import { RelationshipsPanel } from "../organisms/RelationshipsPanel.tsx";
import { ReplayInspector } from "../organisms/ReplayInspector.tsx";
import { RouteCompleteOverlay } from "../organisms/RouteCompleteOverlay.tsx";
import { SoundToggle } from "../organisms/SoundToggle.tsx";
import { StoryPanel } from "../organisms/StoryPanel.tsx";
import { useWorldStore } from "../store/world.ts";

const PhaserGame = lazy(async () => {
  const module = await import("../organisms/PhaserGame.tsx");
  return { default: module.PhaserGame };
});

export function AppShell() {
  const world = useWorldStore((s) => s.world);
  const worldName = world?.name;
  const drawerNpcId = useWorldStore((s) => s.drawerNpcId);
  const zoom = useWorldStore((s) => s.zoom);
  const [focusMode, setFocusMode] = useState(true);
  const focusWorldId = useRef<string | null>(null);
  const routeClear = world?.storyProgress?.phase === "dawn_after_tasks";

  useEffect(() => {
    document.title = worldName ?? "AI Game";
  }, [worldName]);

  useEffect(() => {
    if (!world || focusWorldId.current === world.id) return;
    focusWorldId.current = world.id;
    setFocusMode(world.id === "opm_z_city" || window.matchMedia("(max-width: 700px)").matches);
    useWorldStore.getState().setZoom(world.id === "opm_z_city" ? 2.15 : 1.35);
  }, [world]);

  useEffect(() => {
    if (!focusMode) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusMode]);

  return (
    <div
      className={`app-shell view-2d${focusMode ? " focus-mode" : ""}${drawerNpcId ? " dialogue-mode" : ""}${routeClear ? " route-clear-mode" : ""}`}
      style={{ "--zoom-level": zoom } as React.CSSProperties}
    >
      <AppHeader />
      <AmbienceToggle />
      <SoundToggle />
      <MusicToggle />
      <FocusQuickSlots />
      <CutscenePlayer />
      <ObjectiveTracker />
      <CombatEncounterOverlay />
      <RouteCompleteOverlay />
      <FightCinematicOverlay />
      <AgentPulse />
      <PlayerStatus />
      <OutcomeToast />
      <main className="game-layout">
        <section id="map">
          <div className="map-vignette" aria-hidden="true" />
          <ErrorBoundary fallback={(error) => (
            <div className="banner error">Map failed: {error.message}</div>
          )}>
            <Suspense fallback={<div className="phaser-host loading" aria-label="2D world loading" />}>
              <PhaserGame />
            </Suspense>
          </ErrorBoundary>
          <div className="control-hint">Enter: do next step · WASD/click: move · E: interact nearby</div>
        </section>
        <aside className="hud-panel">
          <details className="journal-foldout story-foldout">
            <summary>Story</summary>
            <StoryPanel />
          </details>
          <details className="journal-foldout">
            <summary>Interact</summary>
            <ActionBar />
          </details>
          <details className="journal-foldout">
            <summary>Quests</summary>
            <QuestList />
          </details>
          <details className="journal-foldout">
            <summary>Scenes</summary>
            <CutsceneList />
          </details>
          <details className="journal-foldout">
            <summary>Pack</summary>
            <InventoryPanel />
          </details>
          <details className="journal-foldout">
            <summary>Activity</summary>
            <EventLog />
          </details>
          <details className="journal-foldout">
            <summary>Agents</summary>
            <AgentLoopPanel />
          </details>
          <details className="debug-foldout">
            <summary>Debug</summary>
            <ReplayInspector />
            <RelationshipsPanel />
          </details>
        </aside>
      </main>
      <NpcDrawer />
    </div>
  );
}
