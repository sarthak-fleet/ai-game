import { useEffect, useState } from "react";

import { useLocalBrain } from "../ai/local-llm.ts";
import { useWorldStore } from "../store/world.ts";

/** Live FPS via a lightweight rAF sampler (updates ~2×/sec). */
function useFps(): number {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const tick = () => {
      frames += 1;
      const now = performance.now();
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return fps;
}

/**
 * Frontier legibility HUD: makes the platform tech *visible* (web-frontier-prd §Phase 0).
 * Shows FPS, NPC count, and the active dialogue compute backend — with a
 * "no server" badge whenever the in-browser brain is driving NPC dialogue.
 */
export function FrontierHud(): React.ReactElement {
  const fps = useFps();
  const npcCount = useWorldStore((state) => state.world?.npcs.length ?? 0);
  const brainStatus = useLocalBrain((state) => state.status);
  const caps = useLocalBrain((state) => state.caps);

  const local = brainStatus === "ready" || brainStatus === "generating";
  const backend = local ? "WebGPU · local" : caps?.webgpu ? "cloud (WebGPU idle)" : "cloud LLM";

  return (
    <div className="frontier-hud" title="Frontier capability readout">
      <span className="fh-stat">{fps} fps</span>
      <span className="fh-sep">·</span>
      <span className="fh-stat">{npcCount} NPCs</span>
      <span className="fh-sep">·</span>
      <span className={`fh-backend ${local ? "local" : ""}`}>{backend}</span>
      {local ? <span className="fh-badge">no server</span> : null}
    </div>
  );
}
