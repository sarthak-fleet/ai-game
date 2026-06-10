import "./hud/hud.css";

import { useEffect } from "react";

import { Hud } from "./hud/Hud.tsx";
import { GameWorld } from "./scene/GameWorld.tsx";
import { useWorldStore } from "./store/world.ts";

export function App() {
  const world = useWorldStore((state) => state.world);
  const loading = useWorldStore((state) => state.loading);
  const error = useWorldStore((state) => state.error);
  const init = useWorldStore((state) => state.init);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    const disconnect = useWorldStore.getState().connectLive();
    return disconnect;
  }, []);

  if (loading && !world) {
    return <div className="screen-center">Entering the world…</div>;
  }

  if (!world) {
    return (
      <div className="screen-center">
        <div>{error ?? "Could not reach the world server."}</div>
        <div style={{ opacity: 0.6, fontSize: 13 }}>Is the simulation server running? (pnpm dev:server)</div>
        <button type="button" onClick={() => void init()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <GameWorld world={world} />
      <Hud />
    </div>
  );
}
