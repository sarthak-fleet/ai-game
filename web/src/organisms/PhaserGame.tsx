import Phaser from "phaser";
import { useEffect, useRef } from "react";

import { VillageScene } from "../phaser/VillageScene.ts";
import { useWorldStore } from "../store/world.ts";
import { movePlayerToward } from "../world-travel.ts";

const INITIAL_GAME_WIDTH = 1280;
const INITIAL_GAME_HEIGHT = 720;
const MIN_GAME_WIDTH = 320;
const MIN_GAME_HEIGHT = 240;

export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<VillageScene | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const onNpc = (npcId: string) => useWorldStore.getState().openDrawer(npcId);
    const onItem = (itemId: string) => {
      const world = useWorldStore.getState().world;
      const item = world?.items.find((candidate) => candidate.id === itemId);
      if (!world || item?.locationId !== world.player.locationId) return;
      void useWorldStore.getState().send({ type: "pickup", itemId } as never);
    };
    const onProp = (propId: string) => {
      const world = useWorldStore.getState().world;
      const prop = world?.interactables?.find((candidate) => candidate.id === propId);
      if (!world || prop?.locationId !== world.player.locationId) return;
      void useWorldStore.getState().send({ type: "inspect", propId } as never);
    };
    const onLoc = (locationId: string) => {
      const world = useWorldStore.getState().world;
      if (!world || world.player.locationId === locationId) return;
      void movePlayerToward(locationId);
    };
    const container = containerRef.current;
    const initialWidth = Math.max(MIN_GAME_WIDTH, Math.round(container.clientWidth || INITIAL_GAME_WIDTH));
    const initialHeight = Math.max(MIN_GAME_HEIGHT, Math.round(container.clientHeight || INITIAL_GAME_HEIGHT));
    const scene = new VillageScene({ onNpcClick: onNpc, onLocationClick: onLoc, onItemClick: onItem, onPropClick: onProp });
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: initialWidth,
      height: initialHeight,
      backgroundColor: "#0a0d12",
      scale: { mode: Phaser.Scale.RESIZE },
      scene,
    });
    const resizeGame = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(MIN_GAME_WIDTH, Math.round(rect.width));
      const height = Math.max(MIN_GAME_HEIGHT, Math.round(rect.height));
      game.scale.resize(width, height);
    };
    const resizeObserver = new ResizeObserver(resizeGame);
    resizeObserver.observe(container);
    requestAnimationFrame(resizeGame);

    const unsub = useWorldStore.subscribe((state, prev) => {
      if (state.world && state.world !== prev.world) scene.setWorld(state.world);
      if (state.zoom !== prev.zoom) scene.setCameraZoom(state.zoom, 450);
      if (state.drawerNpcId !== prev.drawerNpcId) {
        if (state.drawerNpcId) {
          useWorldStore.getState().setZoom(2.35);
        } else {
          useWorldStore.getState().setZoom(state.world?.id === "opm_z_city" ? 2.15 : 1.35);
        }
      }
      const newBubbles = state.bubbles.slice(prev.bubbles.length);
      for (const bubble of newBubbles) {
        const playBubble = () => {
          if (bubble.actionType === "fight" && bubble.actorId) scene.playCombatFx(bubble.actorId, bubble.combatStyle, bubble.combatLabel, bubble.sourceActorId ?? undefined);
          if (bubble.actionType !== "fight" && bubble.actorId) scene.playAgentActionFx(bubble.actorId, bubble.actionType, bubble.text, bubble.fromDirector);
          if (bubble.actorId) scene.flashActor(bubble.actorId);
          if (bubble.actionType === "fight" && bubble.sourceActorId && bubble.sourceActorId !== "player") scene.flashActor(bubble.sourceActorId);
          const speakerId = bubble.actionType === "fight" && bubble.sourceActorId && bubble.sourceActorId !== "player" ? bubble.sourceActorId : bubble.actorId;
          if (speakerId) scene.showBubble(speakerId, bubble.text);
        };
        const delay = Math.max(0, bubble.startsAt - performance.now());
        if (delay > 0) window.setTimeout(playBubble, delay);
        else playBubble();
      }
    });

    const initialWorld = useWorldStore.getState().world;
    if (initialWorld) scene.setWorld(initialWorld);

    const onTravelRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ locationId?: string }>).detail;
      if (detail?.locationId) {
        sceneRef.current?.previewPlayerMove(detail.locationId);
        void movePlayerToward(detail.locationId);
      }
    };
    const onWheel = (event: WheelEvent) => {
      if (useWorldStore.getState().drawerNpcId) return;
      const current = useWorldStore.getState().zoom;
      const next = Math.max(0.8, Math.min(4, current - event.deltaY * 0.002));
      useWorldStore.getState().setZoom(next);
    };
    window.addEventListener("ashment:travel-to", onTravelRequest);
    container.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("ashment:travel-to", onTravelRequest);
      container.removeEventListener("wheel", onWheel);
      unsub();
      game.destroy(true);
      sceneRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="phaser-host" aria-label="Village map" />;
}
