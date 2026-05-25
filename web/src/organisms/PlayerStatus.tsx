import { useMemo, useState } from "react";

import { activeObjectives } from "../../../src/objectives.ts";
import type { Npc, World } from "../../../src/types.ts";
import { useWorldStore } from "../store/world.ts";

const DEFAULT_COMBAT = { hp: 120, maxHp: 120, posture: 100, defeated: false };

export function PlayerStatus() {
  const world = useWorldStore((s) => s.world);
  const send = useWorldStore((s) => s.send);
  const [rosterOpen, setRosterOpen] = useState(false);
  const roster = useMemo(() => playableRoster(world), [world]);

  if (!world) return null;

  const location = world.locations.find((candidate) => candidate.id === world.player.locationId);
  const combat = world.player.combat ?? DEFAULT_COMBAT;
  const hpPct = Math.round((combat.hp / Math.max(1, combat.maxHp)) * 100);
  const inventoryCount = world.items.filter((item) => item.holderId === "player").length;
  const activeCharacter = world.player.characterId ? world.npcs.find((npc) => npc.id === world.player.characterId) : null;
  const appearance = world.player.appearance ?? activeCharacter?.appearance;
  const portrait = appearance?.portrait ?? "/assets/characters/player-hero.svg";
  const palette = appearance?.palette ?? [];
  const mainColor = normalizeColor(palette[0], "#58a6ff");
  const accentColor = normalizeColor(palette[1], "#f8d44e");
  const tags = appearanceTags(appearance);
  const chooseCharacter = async (npc: Npc) => {
    if (rosterChoiceLocked(world, npc)) return;
    await send({ type: "choose_character", targetId: npc.id } as never);
    setRosterOpen(false);
  };

  return (
    <>
      <section className="player-status" aria-label="Player status">
        <button
          type="button"
          className="player-status-portrait"
          aria-label="Open hero roster"
          onClick={() => setRosterOpen(true)}
          style={{ "--hero-main": mainColor, "--hero-accent": accentColor } as React.CSSProperties}
        >
          <PortraitImage src={portrait} name={world.player.name ?? "New Hero"} />
        </button>
        <div className="player-status-main">
          <div className="player-status-name">
            <span>Hero</span>
            <strong>{world.player.name ?? "New Hero"}</strong>
          </div>
          <div className="player-status-bars">
            <Meter label="HP" value={combat.hp} max={combat.maxHp} tone={combat.defeated ? "danger" : "hp"} />
            <Meter label="Posture" value={combat.posture} max={100} tone={combat.posture <= 30 ? "danger" : "posture"} />
          </div>
          <div className="player-status-meta">
            <span>{location?.name ?? world.player.locationId}</span>
            <span>{inventoryCount} pack</span>
            <span>{hpPct}% HP</span>
          </div>
          {tags.length > 0 && (
            <div className="player-status-tags">
              {tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
            </div>
          )}
        </div>
        <button type="button" className="player-status-roster" onClick={() => setRosterOpen(true)}>Roster</button>
      </section>

      {rosterOpen && (
        <section className="roster-modal" aria-label="Hero roster">
          <div className="roster-modal-head">
            <div>
              <span>Party</span>
              <strong>Z-City roster</strong>
            </div>
            <button type="button" aria-label="Close roster" onClick={() => setRosterOpen(false)}>Close</button>
          </div>
          <ol className="roster-grid">
            <li className="roster-card active">
              <RosterPortrait name={world.player.name ?? "New Hero"} palette={[mainColor, accentColor]} portrait={portrait} />
              <div>
                <span>Active</span>
                <strong>{world.player.name ?? "New Hero"}</strong>
                <small>{location?.name ?? "On patrol"} · {combat.hp}/{combat.maxHp} HP</small>
              </div>
            </li>
            {roster.map((npc) => (
              <RosterCard
                key={npc.id}
                npc={npc}
                selected={npc.id === world.player.characterId}
                disabled={rosterChoiceLocked(world, npc)}
                line={rosterLine(world, npc)}
                onChoose={() => void chooseCharacter(npc)}
              />
            ))}
          </ol>
        </section>
      )}
    </>
  );
}

function RosterCard({ npc, selected, disabled, line, onChoose }: { npc: Npc; selected: boolean; disabled: boolean; line: string; onChoose: () => void }) {
  return (
    <li className={selected ? "roster-card selected" : disabled ? "roster-card locked" : "roster-card"}>
      <button type="button" className="roster-card-button" disabled={disabled} onClick={onChoose} aria-label={selected ? `Playing as ${npc.name}` : `Play as ${npc.name}`}>
        <RosterPortrait name={npc.name} palette={npc.appearance?.palette} portrait={npc.appearance?.portrait} />
        <div>
          <span>{selected ? "Current hero" : disabled ? rosterLockLabel(npc) : npc.role ?? npc.tier ?? "Agent"}</span>
          <strong>{npc.name}</strong>
          <small>{line}</small>
        </div>
      </button>
    </li>
  );
}

function Meter({ label, value, max, tone }: { label: string; value: number; max: number; tone: "hp" | "posture" | "danger" }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / Math.max(1, max)) * 100)));
  return (
    <div className={`player-meter ${tone}`}>
      <span>{label}</span>
      <i style={{ width: `${pct}%` }} />
      <strong>{value}</strong>
    </div>
  );
}

function RosterPortrait({ name, palette, portrait }: { name: string; palette?: string[]; portrait?: string }) {
  const main = normalizeColor(palette?.[0], "#58a6ff");
  const accent = normalizeColor(palette?.[1], "#f8d44e");
  return (
    <span
      className="roster-portrait"
      style={{ "--hero-main": main, "--hero-accent": accent } as React.CSSProperties}
      aria-hidden="true"
    >
      <PortraitImage src={portrait} name={name} />
    </span>
  );
}

function PortraitImage({ src, name }: { src?: string; name: string }) {
  return src ? <img src={src} alt="" /> : <span>{initialsFor(name)}</span>;
}

function playableRoster(world: World | null): Npc[] {
  if (!world) return [];
  return world.npcs
    .filter((npc) => npc.appearance)
    .sort((a, b) => tierRank(b) - tierRank(a) || a.name.localeCompare(b.name))
    .slice(0, 8);
}

function rosterChoiceLocked(world: World, npc: Npc): boolean {
  if (npc.id === world.player.characterId) return true;
  if (npc.combat?.defeated) return true;
  if (npc.factionId === "challengers") return true;
  return activeObjectives(world).some((objective) => objective.targetType === "npc" && objective.targetId === npc.id);
}

function rosterLockLabel(npc: Npc): string {
  if (npc.combat?.defeated) return "Defeated";
  if (npc.factionId === "challengers") return "Antagonist";
  return "Objective lead";
}

function tierRank(npc: Npc): number {
  if (npc.tier === "quest") return 3;
  if (npc.factionId === "challengers") return 2;
  if (npc.tier === "normal") return 1;
  return 0;
}

function rosterLine(world: World, npc: Npc): string {
  const location = world.locations.find((candidate) => candidate.id === npc.locationId)?.name ?? npc.locationId;
  const combat = npc.combat;
  if (combat?.defeated) return `${location} · defeated`;
  if (combat) return `${location} · ${combat.hp}/${combat.maxHp} HP`;
  return `${location} · ${npc.plan?.currentIntent?.kind ?? npc.mood?.emotion ?? "ready"}`;
}

function appearanceTags(appearance: World["player"]["appearance"]): string[] {
  return [
    appearance?.sourceLook,
    appearance?.silhouette,
    ...(appearance?.visualTags ?? []),
  ].filter((tag): tag is string => Boolean(tag));
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "H";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

function normalizeColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback;
}
