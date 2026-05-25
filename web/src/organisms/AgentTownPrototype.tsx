import Phaser from "phaser";
import { useEffect, useRef, useState } from "react";

type Direction = "down" | "up" | "left" | "right";

interface CastMember {
  id: string;
  name: string;
  role: string;
  sprite: string;
  x: number;
  y: number;
  line: string;
  memory: string;
}

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

const CAST: CastMember[] = [
  { id: "saitama", name: "Saitama", role: "Errand hero", sprite: "character_01", x: 420, y: 310, line: "I lost a coupon somewhere. That is the important part.", memory: "Saitama is treating the patrol like a grocery detour." },
  { id: "genos", name: "Genos", role: "Cyborg disciple", sprite: "character_02", x: 565, y: 285, line: "I am collecting incident data and improving the patrol model.", memory: "Genos is logging every clue and over-indexing on Saitama's priorities." },
  { id: "mumen", name: "Mumen Rider", role: "Witness hero", sprite: "character_03", x: 755, y: 310, line: "If we get proof, I can file the alert properly.", memory: "Mumen needs evidence before escalating the public warning." },
  { id: "sonic", name: "Sonic", role: "Ninja rival", sprite: "character_04", x: 880, y: 455, line: "This office is small, but the duel can still be legendary.", memory: "Sonic wants any quiet task to become a public challenge." },
  { id: "fubuki", name: "Fubuki", role: "Psychic leader", sprite: "character_05", x: 335, y: 480, line: "A team works when everyone stops fighting the plan.", memory: "Fubuki is watching hierarchy and group control." },
  { id: "king", name: "King", role: "Legend", sprite: "character_06", x: 660, y: 520, line: "I am just standing here. Somehow that helps.", memory: "King calms the room by doing almost nothing." },
  { id: "bang", name: "Bang", role: "Master", sprite: "character_01", x: 1015, y: 325, line: "Footwork gives away intent before words do.", memory: "Bang is reading the challenger instead of the rumor." },
  { id: "metal_bat", name: "Metal Bat", role: "Backup", sprite: "character_02", x: 240, y: 650, line: "Tell me when this stops being paperwork.", memory: "Metal Bat is waiting for a real threat." },
  { id: "child_emperor", name: "Child Emperor", role: "Analyst", sprite: "character_03", x: 950, y: 650, line: "The marks and the monster scale do not match. That matters.", memory: "Child Emperor thinks one clue is bait and one clue is real." },
];

const DIRECTIONS = ["right", "up", "left", "down"] as const;

export function AgentTownPrototype() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<OfficePrototypeScene | null>(null);
  const [active, setActive] = useState<CastMember>(CAST[0]!);
  const [met, setMet] = useState<Set<string>>(() => new Set());
  const [log, setLog] = useState<string[]>(() => ["Walk the office. Press E near a character."]);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const scene = new OfficePrototypeScene((character) => {
      setActive(character);
      setMet((current) => new Set(current).add(character.id));
      setLog((current) => [`${character.name}: ${character.memory}`, ...current].slice(0, 5));
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

  return (
    <div className="agent-town-shell">
      <div className="agent-town-game" ref={hostRef} aria-label="Agent town prototype" />
      <aside className="agent-town-panel" aria-label="Character interaction">
        <div className="agent-town-kicker">
          <span>New prototype</span>
          <b>{met.size + 1}/10 met</b>
        </div>
        <section className="agent-town-card">
          <small>{active.role}</small>
          <h1>{active.name}</h1>
          <p>{active.line}</p>
          <button type="button" onClick={() => sceneRef.current?.focusCharacter(active.id)}>Find</button>
        </section>
        <section className="agent-town-objective">
          <strong>{met.size === CAST.length ? "Everyone has a memory in the log." : "Talk to the cast."}</strong>
          <p>WASD to move. Press E near someone. Click a character to walk over.</p>
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
  private target: { x: number; y: number } | null = null;
  private facing: Direction = "down";
  private prompt?: Phaser.GameObjects.Text;
  private playerTag?: Phaser.GameObjects.Text;
  private selectedId = CAST[0]!.id;

  constructor(private readonly onTalk: (character: CastMember) => void) {
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
    const nearest = this.nearestCharacter();
    if (this.prompt) {
      this.prompt.setVisible(Boolean(nearest));
      if (nearest) this.prompt.setPosition(nearest.sprite.x, nearest.sprite.y - 48);
    }
    if (nearest && this.eKey && Phaser.Input.Keyboard.JustDown(this.eKey)) this.talk(nearest.data);
  }

  focusCharacter(id: string) {
    const character = this.characters.get(id);
    if (!character) return;
    this.selectedId = id;
    this.target = { x: character.sprite.x, y: character.sprite.y + 34 };
    this.talk(character.data);
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

  private nearestCharacter() {
    if (!this.player) return null;
    let nearest: { data: CastMember; sprite: Phaser.Physics.Arcade.Sprite } | null = null;
    let distance = Number.POSITIVE_INFINITY;
    for (const entry of this.characters.values()) {
      const candidateDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, entry.sprite.x, entry.sprite.y);
      if (candidateDistance < distance) {
        nearest = entry;
        distance = candidateDistance;
      }
    }
    return distance <= INTERACT_DISTANCE ? nearest : null;
  }

  private talk(character: CastMember) {
    this.selectedId = character.id;
    this.onTalk(character);
  }
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
