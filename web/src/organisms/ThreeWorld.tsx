import { useEffect, useRef } from "react";

import { useWorldStore } from "../store/world.ts";
import { ThreeWorldRenderer } from "../three/world-scene.ts";

export function ThreeWorld() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = new ThreeWorldRenderer(host);
    const resizeObserver = new ResizeObserver(() => renderer.resize());
    resizeObserver.observe(host);

    const initialWorld = useWorldStore.getState().world;
    if (initialWorld) renderer.renderWorld(initialWorld);
    renderer.start();

    const unsub = useWorldStore.subscribe((state, previous) => {
      if (state.world && state.world !== previous.world) renderer.renderWorld(state.world);
    });

    return () => {
      unsub();
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  return <div ref={hostRef} className="three-host" aria-label="3D world view" />;
}
