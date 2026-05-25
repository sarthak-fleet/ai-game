export type Direction = "down" | "up" | "left" | "right";

export type StoryFlag =
  | "couponFound"
  | "couponReturned"
  | "alertRaised"
  | "monsterAlleyUnlocked"
  | "sonicChallenged";

export type ZoneId = "hq" | "market" | "alley";

export interface CastMember {
  id: string;
  name: string;
  role: string;
  sprite: string;
  x: number;
  y: number;
  zoneId: ZoneId;
  line: string;
  memory: string;
}

export interface WorldZone {
  id: ZoneId;
  name: string;
  description: string;
  focus: { x: number; y: number };
  spawn: { x: number; y: number };
  unlockFlag?: StoryFlag;
}

export interface WorldProp {
  id: string;
  label: string;
  zoneId: ZoneId;
  x: number;
  y: number;
  color: number;
  symbol: string;
  inspectText: string;
  requires?: StoryFlag[];
  hiddenWhen?: StoryFlag;
  grants?: StoryFlag[];
  givesItem?: string;
}

export interface StorySnapshot {
  activeZone: ZoneId;
  flags: Record<StoryFlag, boolean>;
  inventory: string[];
  objective: string;
}

export const ZONES: WorldZone[] = [
  {
    id: "hq",
    name: "Hero HQ",
    description: "The compact command floor where the cast starts, shares leads, and receives alerts.",
    focus: { x: 610, y: 405 },
    spawn: { x: 610, y: 405 },
  },
  {
    id: "market",
    name: "Market Street",
    description: "A small shopping block unlocked once Saitama has his coupon back.",
    focus: { x: 280, y: 650 },
    spawn: { x: 270, y: 625 },
    unlockFlag: "couponReturned",
  },
  {
    id: "alley",
    name: "Monster Alley",
    description: "The danger route where the alert becomes a confrontation.",
    focus: { x: 930, y: 620 },
    spawn: { x: 900, y: 625 },
    unlockFlag: "monsterAlleyUnlocked",
  },
];

export const CAST: CastMember[] = [
  { id: "saitama", name: "Saitama", role: "Errand hero", sprite: "character_01", x: 420, y: 310, zoneId: "hq", line: "I lost a coupon somewhere. That is the important part.", memory: "Saitama is treating the patrol like a grocery detour." },
  { id: "genos", name: "Genos", role: "Cyborg disciple", sprite: "character_02", x: 565, y: 285, zoneId: "hq", line: "I am collecting incident data and improving the patrol model.", memory: "Genos is logging every clue and over-indexing on Saitama's priorities." },
  { id: "mumen", name: "Mumen Rider", role: "Witness hero", sprite: "character_03", x: 755, y: 310, zoneId: "hq", line: "If we get proof, I can file the alert properly.", memory: "Mumen needs evidence before escalating the public warning." },
  { id: "sonic", name: "Sonic", role: "Ninja rival", sprite: "character_04", x: 880, y: 455, zoneId: "alley", line: "This office is small, but the duel can still be legendary.", memory: "Sonic wants any quiet task to become a public challenge." },
  { id: "fubuki", name: "Fubuki", role: "Psychic leader", sprite: "character_05", x: 335, y: 480, zoneId: "hq", line: "A team works when everyone stops fighting the plan.", memory: "Fubuki is watching hierarchy and group control." },
  { id: "king", name: "King", role: "Legend", sprite: "character_06", x: 660, y: 520, zoneId: "hq", line: "I am just standing here. Somehow that helps.", memory: "King calms the room by doing almost nothing." },
  { id: "bang", name: "Bang", role: "Master", sprite: "character_01", x: 1015, y: 325, zoneId: "hq", line: "Footwork gives away intent before words do.", memory: "Bang is reading the challenger instead of the rumor." },
  { id: "metal_bat", name: "Metal Bat", role: "Backup", sprite: "character_02", x: 240, y: 650, zoneId: "market", line: "Tell me when this stops being paperwork.", memory: "Metal Bat is waiting for a real threat." },
  { id: "child_emperor", name: "Child Emperor", role: "Analyst", sprite: "character_03", x: 950, y: 650, zoneId: "alley", line: "The marks and the monster scale do not match. That matters.", memory: "Child Emperor thinks one clue is bait and one clue is real." },
];

export const PROPS: WorldProp[] = [
  {
    id: "coupon_box",
    label: "Coupon box",
    zoneId: "hq",
    x: 358,
    y: 390,
    color: 0xf8d44e,
    symbol: "$",
    inspectText: "You find Saitama's grocery coupon tucked under the workstation.",
    hiddenWhen: "couponFound",
    grants: ["couponFound"],
    givesItem: "Grocery coupon",
  },
  {
    id: "alert_board",
    label: "Alert board",
    zoneId: "hq",
    x: 520,
    y: 205,
    color: 0x58a6ff,
    symbol: "!",
    inspectText: "The board confirms a monster sign near the alley. The team can move out.",
    requires: ["couponReturned"],
    grants: ["alertRaised", "monsterAlleyUnlocked"],
  },
  {
    id: "challenge_mark",
    label: "Challenge mark",
    zoneId: "alley",
    x: 835,
    y: 575,
    color: 0x8d5cff,
    symbol: "X",
    inspectText: "The mark is Sonic's signature. He is baiting the patrol into a duel.",
    requires: ["monsterAlleyUnlocked"],
    grants: ["sonicChallenged"],
  },
];

export function initialSnapshot(): StorySnapshot {
  return {
    activeZone: "hq",
    inventory: [],
    flags: {
      couponFound: false,
      couponReturned: false,
      alertRaised: false,
      monsterAlleyUnlocked: false,
      sonicChallenged: false,
    },
    objective: "Find Saitama's grocery coupon.",
  };
}

export function zoneUnlocked(zone: WorldZone, flags: Record<StoryFlag, boolean>): boolean {
  return !zone.unlockFlag || flags[zone.unlockFlag];
}

export function propVisible(prop: WorldProp, flags: Record<StoryFlag, boolean>): boolean {
  if (prop.hiddenWhen && flags[prop.hiddenWhen]) return false;
  return (prop.requires ?? []).every((flag) => flags[flag]);
}

export function nextObjective(flags: Record<StoryFlag, boolean>): string {
  if (!flags.couponFound) return "Find Saitama's grocery coupon.";
  if (!flags.couponReturned) return "Bring the grocery coupon to Saitama.";
  if (!flags.alertRaised) return "Inspect the Hero Association alert board.";
  if (!flags.sonicChallenged) return "Enter Monster Alley and inspect Sonic's challenge mark.";
  return "Confront Sonic or keep talking to the cast.";
}
