import Phaser from "phaser";
import { useEffect, useRef, useState } from "react";

import {
  CAST,
  type CastMember,
  type Direction,
  initialSnapshot,
  nextObjective,
  PROPS,
  propVisible,
  type StorySnapshot,
  type WorldProp,
  ZONES,
  zoneUnlocked,
} from "./agent-town-world.ts";

const FRAME_WIDTH = 48;
const FRAME_HEIGHT = 96;
const SHEET_COLUMNS = 56;
const FRAMES_PER_DIR = 6;
const SPEED = 175;
const INTERACT_DISTANCE = 64;
const MAP_KEY = "agent-town-office";
const PLAYER_KEY = "character_09";

const TILESETS = [
  ["room_builder", "Room_Builder_Office_48x48.png"],
  ["modern_office", "Modern_Office_48x48.png"],
  ["Classroom & Library", "5_Classroom_and_library_48x48.png"],
  ["Basement", "14_Basement_48x48.png"],
  ["Generic Interiors", "1_Generic_48x48.png"],
  ["Interios Room Builder", "Room_Builder_48x48.png"],
  ["6_Music_and_sport_48x48", "6_Music_and_sport_48x48.png"],
  ["3_Bathroom_48x48", "3_Bathroom_48x48.png"],
  ["4_Bedroom_48x48", "4_Bedroom_48x48.png"],
  ["2_LivingRoom_48x48", "2_LivingRoom_48x48.png"],
  ["7_Art_48x48", "7_Art_48x48.png"],
  ["8_Gym_48x48", "8_Gym_48x48.png"],
  ["9_Fishing_48x48", "9_Fishing_48x48.png"],
  ["11_Halloween_48x48", "11_Halloween_48x48.png"],
  ["13_Conference_Hall_48x48", "13_Conference_Hall_48x48.png"],
  ["16_Grocery_store_48x48", "16_Grocery_store_48x48.png"],
] as const;

const DIRECTIONS = ["right", "up", "left", "down"] as const;

export function AgentTownPrototype() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<OfficePrototypeScene | null>(null);
  const snapshotRef = useRef<StorySnapshot>(initialSnapshot());
  const [active, setActive] = useState<CastMember>(CAST[0]!);
  const [snapshot, setSnapshot] = useState<StorySnapshot>(() => initialSnapshot());
  const [met, setMet] = useState<Set<string>>(() => new Set());
  const [log, setLog] = useState<string[]>(() => ["Walk the office. Press E near a character."]);

  const applyCharacterTalk = (character: CastMember) => {
    setActive(character);
    setMet((current) => new Set(current).add(character.id));
    const result = reduceCharacterTalk(snapshotRef.current, character);
    snapshotRef.current = result.snapshot;
    setSnapshot(result.snapshot);
    setLog((existing) => [...result.entries, `${character.name}: ${character.memory}`, ...existing].slice(0, 6));
  };

  const applyPropInspect = (prop: WorldProp) => {
    const result = reducePropInspect(snapshotRef.current, prop);
    snapshotRef.current = result.snapshot;
    setSnapshot(result.snapshot);
    setLog((existing) => [...result.entries, ...existing].slice(0, 6));
  };

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const scene = new OfficePrototypeScene((character) => {
      applyCharacterTalk(character);
    }, (prop) => {
      applyPropInspect(prop);
    });
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: 1280,
      height: 720,
      pixelArt: true,
      roundPixels: true,
      backgroundColor: "#111827",
      scale: { mode: Phaser.Scale.RESIZE },
      physics: {
        default: "arcade",
        arcade: { gravity: { x: 0, y: 0 } },
      },
      scene,
    });
    return () => {
      game.destroy(true);
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    snapshotRef.current = snapshot;
    sceneRef.current?.applySnapshot(snapshot);
  }, [snapshot]);

  const activeZone = ZONES.find((zone) => zone.id === snapshot.activeZone) ?? ZONES[0]!;
  const primaryAction = primaryStoryAction(snapshot);

  return (
    <div className="agent-town-shell">
      <div className="agent-town-game" ref={hostRef} aria-label="Agent town prototype" />
      <aside className="agent-town-panel" aria-label="Character interaction">
        <div className="agent-town-kicker">
          <span>{activeZone.name}</span>
          <b>{met.size + 1}/10 met</b>
        </div>
        <section className="agent-town-card">
          <small>{active.role}</small>
          <h1>{active.name}</h1>
          <p>{active.line}</p>
          <button type="button" onClick={() => sceneRef.current?.focusCharacter(active.id)}>Find</button>
        </section>
        <section className="agent-town-objective">
          <strong>{snapshot.objective}</strong>
          <p>{activeZone.description}</p>
          {primaryAction && (
            <button
              type="button"
              onClick={() => {
                if (primaryAction.kind === "prop") {
                  applyPropInspect(primaryAction.prop);
                  sceneRef.current?.focusProp(primaryAction.prop.id);
                } else {
                  const character = CAST.find((candidate) => candidate.id === primaryAction.characterId);
                  if (character) {
                    applyCharacterTalk(character);
                    sceneRef.current?.focusCharacter(character.id);
                  }
                }
              }}
            >
              {primaryAction.label}
            </button>
          )}
        </section>
        <section className="agent-town-zones" aria-label="World zones">
          {ZONES.map((zone) => {
            const unlocked = zoneUnlocked(zone, snapshot.flags);
            return (
              <button
                key={zone.id}
                type="button"
                disabled={!unlocked}
                className={zone.id === snapshot.activeZone ? "active" : ""}
                onClick={() => {
                  setSnapshot((current) => ({ ...current, activeZone: zone.id }));
                  sceneRef.current?.goToZone(zone.id);
                }}
              >
                {zone.name}
              </button>
            );
          })}
        </section>
        <section className="agent-town-inventory" aria-label="Inventory">
          <small>Inventory</small>
          <p>{snapshot.inventory.length > 0 ? snapshot.inventory.join(", ") : "Empty"}</p>
        </section>
        <section className="agent-town-log">
          {log.map((entry, index) => <p key={`${index}-${entry}`}>{entry}</p>)}
        </section>
        <a href="?legacy=1">Open old build</a>
      </aside>
    </div>
  );
}

class OfficePrototypeScene extends Phaser.Scene {
  private player?: Phaser.Physics.Arcade.Sprite;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private eKey?: Phaser.Input.Keyboard.Key;
  private collisionGroup?: Phaser.Physics.Arcade.StaticGroup;
  private characters = new Map<string, { data: CastMember; sprite: Phaser.Physics.Arcade.Sprite; prompt: Phaser.GameObjects.Text; tag: Phaser.GameObjects.Text }>();
  private props = new Map<string, { data: WorldProp; marker: Phaser.GameObjects.Container; tag: Phaser.GameObjects.Text }>();
  private target: { x: number; y: number } | null = null;
  private facing: Direction = "down";
  private prompt?: Phaser.GameObjects.Text;
  private playerTag?: Phaser.GameObjects.Text;
  private alertTint?: Phaser.GameObjects.Rectangle;
  private currentSnapshot: StorySnapshot = initialSnapshot();
  private selectedId = CAST[0]!.id;

  constructor(
    private readonly onTalk: (character: CastMember) => void,
    private readonly onInspect: (prop: WorldProp) => void,
  ) {
    super("OfficePrototypeScene");
  }

  preload() {
    this.load.tilemapTiledJSON(MAP_KEY, "/agent-town/maps/office2.json");
    for (const [name, file] of TILESETS) this.load.image(name, `/agent-town/tilesets/${file}`);
    for (const key of new Set([PLAYER_KEY, ...CAST.map((character) => character.sprite)])) {
      const suffix = key.replace("character_", "");
      this.load.spritesheet(key, `/agent-town/characters/Premade_Character_48x48_${suffix}.png`, {
        frameWidth: FRAME_WIDTH,
        frameHeight: FRAME_HEIGHT,
      });
    }
    this.load.spritesheet("agent-town-arrow", "/agent-town/sprites/arrow_down_48x48.png", {
      frameWidth: 48,
      frameHeight: 48,
    });
  }

  create() {
    for (const key of new Set([PLAYER_KEY, ...CAST.map((character) => character.sprite)])) createCharacterAnimations(this, key);
    createArrowAnimation(this);

    const map = this.make.tilemap({ key: MAP_KEY });
    const tilesets = TILESETS.map(([name]) => map.addTilesetImage(name, name)).filter((tileset): tileset is Phaser.Tilemaps.Tileset => Boolean(tileset));
    for (const layer of ["floor", "walls", "ground", "furniture", "objects"]) map.createLayer(layer, tilesets);
    const overhead = map.createLayer("overhead", tilesets);
    if (overhead) overhead.setDepth(20);

    this.collisionGroup = this.physics.add.staticGroup();
    const collisions = map.getObjectLayer("collisions")?.objects ?? [];
    for (const object of collisions) {
      const body = this.add.rectangle((object.x ?? 0) + (object.width ?? 0) / 2, (object.y ?? 0) + (object.height ?? 0) / 2, object.width ?? 0, object.height ?? 0, 0x000000, 0);
      this.physics.add.existing(body, true);
      this.collisionGroup.add(body);
    }

    this.player = this.physics.add.sprite(610, 405, PLAYER_KEY, frameFor("down"));
    this.player.setDepth(10);
    this.player.setCollideWorldBounds(true);
    configureBody(this.player);
    this.physics.add.collider(this.player, this.collisionGroup);
    this.playerTag = this.add.text(this.player.x, this.player.y + 34, "Tatsumaki", {
      fontFamily: "Montserrat, sans-serif",
      fontSize: "11px",
      color: "#f6f1e8",
      backgroundColor: "rgba(25, 77, 46, 0.82)",
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5, 0).setDepth(24);

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(0.95);

    for (const character of CAST) this.addCharacter(character);
    for (const prop of PROPS) this.addProp(prop);
    this.alertTint = this.add.rectangle(0, 0, 2400, 1600, 0xff3b30, 0).setOrigin(0).setDepth(2).setScrollFactor(1);

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys = this.input.keyboard?.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>;
    this.eKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.input.keyboard?.disableGlobalCapture();
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonReleased()) return;
      this.target = { x: pointer.worldX, y: pointer.worldY };
    });

    this.prompt = this.add.text(0, 0, "Press E", promptStyle()).setOrigin(0.5, 1).setDepth(30).setVisible(false);
    this.onTalk(CAST[0]!);
    this.applySnapshot(this.currentSnapshot);
  }

  override update() {
    if (!this.player) return;
    const movement = this.inputVector();
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (movement.x !== 0 || movement.y !== 0) {
      this.target = null;
      body.setVelocity(movement.x * SPEED, movement.y * SPEED);
      this.setFacing(movement);
    } else if (this.target) {
      const dx = this.target.x - this.player.x;
      const dy = this.target.y - this.player.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= 6) {
        this.target = null;
        body.setVelocity(0, 0);
      } else {
        body.setVelocity((dx / distance) * SPEED, (dy / distance) * SPEED);
        this.setFacing({ x: dx, y: dy });
      }
    } else {
      body.setVelocity(0, 0);
    }

    this.syncAnimation();
    this.playerTag?.setPosition(this.player.x, this.player.y + 34);
    this.updateCharacterLabels();
    const nearest = this.nearestInteractable();
    if (this.prompt) {
      this.prompt.setVisible(Boolean(nearest));
      if (nearest) this.prompt.setPosition(nearest.x, nearest.y - 48);
      if (nearest) this.prompt.setText(nearest.kind === "character" ? "Press E" : "Inspect");
    }
    if (nearest && this.eKey && Phaser.Input.Keyboard.JustDown(this.eKey)) {
      if (nearest.kind === "character") this.talk(nearest.data);
      else this.inspect(nearest.data);
    }
  }

  focusCharacter(id: string) {
    const character = this.characters.get(id);
    if (!character) return;
    this.selectedId = id;
    this.target = { x: character.sprite.x, y: character.sprite.y + 34 };
  }

  focusProp(id: string) {
    const prop = this.props.get(id);
    if (!prop) return;
    this.target = { x: prop.data.x, y: prop.data.y + 34 };
  }

  goToZone(zoneId: string) {
    const zone = ZONES.find((candidate) => candidate.id === zoneId);
    if (!zone || !this.player) return;
    this.currentSnapshot = { ...this.currentSnapshot, activeZone: zone.id };
    this.player.setPosition(zone.spawn.x, zone.spawn.y);
    this.target = null;
    this.cameras.main.pan(zone.focus.x, zone.focus.y, 280, "Quad.easeOut", true);
  }

  applySnapshot(snapshot: StorySnapshot) {
    this.currentSnapshot = snapshot;
    this.alertTint?.setAlpha(snapshot.flags.alertRaised ? 0.08 : 0);
    for (const entry of this.props.values()) {
      const visible = propVisible(entry.data, snapshot.flags);
      entry.marker.setVisible(visible);
      entry.tag.setVisible(visible);
    }
    for (const entry of this.characters.values()) {
      const zone = ZONES.find((candidate) => candidate.id === entry.data.zoneId);
      const unlocked = !zone || zoneUnlocked(zone, snapshot.flags);
      entry.sprite.setVisible(unlocked);
      entry.tag.setVisible(unlocked);
      entry.prompt.setVisible(unlocked && entry.data.id === this.selectedId);
    }
  }

  private addCharacter(character: CastMember) {
    const sprite = this.physics.add.sprite(character.x, character.y, character.sprite, frameFor("down"));
    sprite.setDepth(9);
    sprite.setInteractive({ useHandCursor: true });
    configureBody(sprite);
    if (this.collisionGroup) this.physics.add.collider(sprite, this.collisionGroup);
    sprite.play(`${character.sprite}:idle-down`);
    sprite.on("pointerup", () => {
      this.selectedId = character.id;
      this.target = { x: sprite.x, y: sprite.y + 38 };
      this.talk(character);
    });
    const tag = this.add.text(character.x, character.y + 34, character.name, {
      fontFamily: "Montserrat, sans-serif",
      fontSize: "11px",
      color: "#f6f1e8",
      backgroundColor: "rgba(11, 18, 32, 0.78)",
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5, 0).setDepth(24);
    const prompt = this.add.text(character.x, character.y - 42, "!", {
      fontFamily: "Montserrat, sans-serif",
      fontSize: "18px",
      color: "#1f2937",
      backgroundColor: "#f8d44e",
      padding: { x: 7, y: 1 },
    }).setOrigin(0.5).setDepth(24).setVisible(false);
    this.characters.set(character.id, { data: character, sprite, prompt, tag });
  }

  private addProp(prop: WorldProp) {
    const base = this.add.circle(0, 0, 15, prop.color, 0.95);
    const label = this.add.text(0, 0, prop.symbol, {
      fontFamily: "Montserrat, sans-serif",
      fontSize: "15px",
      color: "#111827",
      fontStyle: "bold",
    }).setOrigin(0.5);
    const marker = this.add.container(prop.x, prop.y, [base, label]).setDepth(14).setSize(34, 34);
    marker.setInteractive(new Phaser.Geom.Circle(0, 0, 22), Phaser.Geom.Circle.Contains);
    marker.on("pointerup", () => {
      this.target = { x: prop.x, y: prop.y + 34 };
      this.inspect(prop);
    });
    const tag = this.add.text(prop.x, prop.y + 21, prop.label, {
      fontFamily: "Montserrat, sans-serif",
      fontSize: "11px",
      color: "#f6f1e8",
      backgroundColor: "rgba(11, 18, 32, 0.78)",
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5, 0).setDepth(24);
    this.props.set(prop.id, { data: prop, marker, tag });
  }

  private inputVector() {
    let x = 0;
    let y = 0;
    if (this.cursors?.left.isDown || this.keys?.["A"]?.isDown) x -= 1;
    if (this.cursors?.right.isDown || this.keys?.["D"]?.isDown) x += 1;
    if (this.cursors?.up.isDown || this.keys?.["W"]?.isDown) y -= 1;
    if (this.cursors?.down.isDown || this.keys?.["S"]?.isDown) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  private setFacing(vector: { x: number; y: number }) {
    if (Math.abs(vector.x) > Math.abs(vector.y)) this.facing = vector.x < 0 ? "left" : "right";
    else if (vector.y !== 0) this.facing = vector.y < 0 ? "up" : "down";
  }

  private syncAnimation() {
    if (!this.player) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const prefix = body.velocity.length() > 0 ? "walk" : "idle";
    const key = `${PLAYER_KEY}:${prefix}-${this.facing}`;
    if (this.player.anims.currentAnim?.key !== key) this.player.play(key);
  }

  private updateCharacterLabels() {
    for (const [id, entry] of this.characters) {
      entry.tag.setPosition(entry.sprite.x, entry.sprite.y + 34);
      entry.prompt.setPosition(entry.sprite.x, entry.sprite.y - 42);
      entry.prompt.setVisible(id === this.selectedId);
    }
  }

  private nearestInteractable():
    | { kind: "character"; data: CastMember; x: number; y: number }
    | { kind: "prop"; data: WorldProp; x: number; y: number }
    | null {
    if (!this.player) return null;
    let nearest:
      | { kind: "character"; data: CastMember; x: number; y: number }
      | { kind: "prop"; data: WorldProp; x: number; y: number }
      | null = null;
    let distance = Number.POSITIVE_INFINITY;
    for (const entry of this.characters.values()) {
      if (!entry.sprite.visible) continue;
      const candidateDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, entry.sprite.x, entry.sprite.y);
      if (candidateDistance < distance) {
        nearest = { kind: "character", data: entry.data, x: entry.sprite.x, y: entry.sprite.y };
        distance = candidateDistance;
      }
    }
    for (const entry of this.props.values()) {
      if (!entry.marker.visible) continue;
      const candidateDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, entry.data.x, entry.data.y);
      if (candidateDistance < distance) {
        nearest = { kind: "prop", data: entry.data, x: entry.data.x, y: entry.data.y };
        distance = candidateDistance;
      }
    }
    return distance <= INTERACT_DISTANCE ? nearest : null;
  }

  private talk(character: CastMember) {
    this.selectedId = character.id;
    this.onTalk(character);
  }

  private inspect(prop: WorldProp) {
    this.onInspect(prop);
  }
}

function reduceCharacterTalk(snapshot: StorySnapshot, character: CastMember): { snapshot: StorySnapshot; entries: string[] } {
  if (character.id === "saitama" && snapshot.flags.couponFound && !snapshot.flags.couponReturned) {
    const flags = { ...snapshot.flags, couponReturned: true };
    return {
      snapshot: {
        ...snapshot,
        flags,
        inventory: snapshot.inventory.filter((item) => item !== "Grocery coupon"),
        activeZone: "hq",
        objective: nextObjective(flags),
      },
      entries: ["Saitama takes the coupon. Market Street opens and the alert board starts flashing."],
    };
  }
  if (character.id === "sonic" && snapshot.flags.sonicChallenged) {
    return { snapshot, entries: ["Sonic accepts the confrontation. The duel can become the next combat slice."] };
  }
  return { snapshot, entries: [`${character.name} is now available as a conversation lead.`] };
}

function reducePropInspect(snapshot: StorySnapshot, prop: WorldProp): { snapshot: StorySnapshot; entries: string[] } {
  const missing = (prop.requires ?? []).filter((flag) => !snapshot.flags[flag]);
  if (missing.length > 0) {
    return { snapshot, entries: [`${prop.label} is not useful yet.`] };
  }
  const flags = { ...snapshot.flags };
  for (const flag of prop.grants ?? []) flags[flag] = true;
  const inventory = prop.givesItem && !snapshot.inventory.includes(prop.givesItem)
    ? [...snapshot.inventory, prop.givesItem]
    : snapshot.inventory;
  const nextZone = prop.id === "challenge_mark" ? "alley" : snapshot.activeZone;
  return {
    snapshot: {
      ...snapshot,
      flags,
      inventory,
      activeZone: nextZone,
      objective: nextObjective(flags),
    },
    entries: [prop.inspectText],
  };
}

function primaryStoryAction(snapshot: StorySnapshot):
  | { kind: "prop"; label: string; prop: WorldProp }
  | { kind: "character"; label: string; characterId: string }
  | null {
  if (!snapshot.flags.couponFound) return { kind: "prop", label: "Inspect coupon box", prop: PROPS.find((prop) => prop.id === "coupon_box")! };
  if (!snapshot.flags.couponReturned) return { kind: "character", label: "Give coupon to Saitama", characterId: "saitama" };
  if (!snapshot.flags.alertRaised) return { kind: "prop", label: "Inspect alert board", prop: PROPS.find((prop) => prop.id === "alert_board")! };
  if (!snapshot.flags.sonicChallenged) return { kind: "prop", label: "Inspect challenge mark", prop: PROPS.find((prop) => prop.id === "challenge_mark")! };
  return { kind: "character", label: "Talk to Sonic", characterId: "sonic" };
}

function configureBody(sprite: Phaser.Physics.Arcade.Sprite) {
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  body.setSize(FRAME_WIDTH * 0.5, FRAME_HEIGHT * 0.2);
  body.setOffset(FRAME_WIDTH * 0.25, FRAME_HEIGHT * 0.75);
}

function createCharacterAnimations(scene: Phaser.Scene, spriteKey: string) {
  if (scene.anims.exists(`${spriteKey}:idle-down`)) return;
  for (const [row, prefix, rate] of [[1, "idle", 8], [2, "walk", 10]] as const) {
    DIRECTIONS.forEach((direction, index) => {
      scene.anims.create({
        key: `${spriteKey}:${prefix}-${direction}`,
        frames: scene.anims.generateFrameNumbers(spriteKey, {
          start: row * SHEET_COLUMNS + index * FRAMES_PER_DIR,
          end: row * SHEET_COLUMNS + index * FRAMES_PER_DIR + FRAMES_PER_DIR - 1,
        }),
        frameRate: rate,
        repeat: -1,
      });
    });
  }
}

function createArrowAnimation(scene: Phaser.Scene) {
  if (scene.anims.exists("agent-town-arrow-bounce")) return;
  scene.anims.create({
    key: "agent-town-arrow-bounce",
    frames: scene.anims.generateFrameNumbers("agent-town-arrow", { start: 0, end: 5 }),
    frameRate: 6,
    repeat: -1,
  });
}

function frameFor(direction: Direction): number {
  return SHEET_COLUMNS + DIRECTIONS.indexOf(direction) * FRAMES_PER_DIR;
}

function promptStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: "Montserrat, sans-serif",
    fontSize: "14px",
    color: "#1f2937",
    backgroundColor: "#f8d44e",
    padding: { x: 8, y: 4 },
  };
}
