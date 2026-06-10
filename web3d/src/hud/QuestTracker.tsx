import { useState } from "react";

import { useWorldStore } from "../store/world.ts";

const STATUS_ORDER = { active: 0, open: 1, done: 2, failed: 3 } as const;

export function QuestTracker() {
  const world = useWorldStore((state) => state.world);
  const [collapsed, setCollapsed] = useState(false);
  const quests = (world?.quests ?? [])
    .slice()
    .sort((a, b) => STATUS_ORDER[a.status ?? "open"] - STATUS_ORDER[b.status ?? "open"]);

  if (quests.length === 0) return null;

  return (
    <div className="quests">
      <button type="button" className="quests-header" onClick={() => setCollapsed(!collapsed)}>
        Quests {collapsed ? "▸" : "▾"}
      </button>
      {!collapsed
        ? quests.map((quest) => (
            <div key={quest.id} className={`quest ${quest.status ?? "open"}`}>
              <span className="quest-status">{statusGlyph(quest.status)}</span>
              <div>
                <div className="quest-title">{quest.title}</div>
                {quest.description && (quest.status === "active" || quest.status === "open") ? (
                  <div className="quest-desc">{quest.description}</div>
                ) : null}
              </div>
            </div>
          ))
        : null}
    </div>
  );
}

function statusGlyph(status: string | undefined): string {
  if (status === "done") return "✓";
  if (status === "failed") return "✗";
  if (status === "active") return "●";
  return "○";
}
