import { audioContext, isSfxEnabled, masterBus } from "./sfx.ts";

/**
 * Generative score — no audio files. A step sequencer plays bass roots, slow
 * pad chords, and probabilistic arpeggio notes from a mood-selected scale,
 * plus an ambient bed (wind, night crickets). Moods crossfade smoothly.
 */
export interface MusicMood {
  phase: "dawn" | "day" | "dusk" | "night";
  pressure: number;
  combat: boolean;
}

interface MoodProfile {
  /** semitone offsets from the root */
  scale: number[];
  root: number;
  stepSeconds: number;
  arpChance: number;
  padGain: number;
  brightness: number;
}

const PROFILES: Record<string, MoodProfile> = {
  dawn: { scale: [0, 2, 4, 7, 9, 11], root: 220, stepSeconds: 0.5, arpChance: 0.35, padGain: 0.045, brightness: 1600 },
  day: { scale: [0, 2, 4, 7, 9], root: 196, stepSeconds: 0.46, arpChance: 0.45, padGain: 0.04, brightness: 2200 },
  dusk: { scale: [0, 3, 5, 7, 10], root: 174.6, stepSeconds: 0.55, arpChance: 0.3, padGain: 0.05, brightness: 1200 },
  night: { scale: [0, 3, 5, 7, 10], root: 146.8, stepSeconds: 0.62, arpChance: 0.22, padGain: 0.055, brightness: 900 },
  tense: { scale: [0, 2, 3, 7, 8], root: 138.6, stepSeconds: 0.42, arpChance: 0.3, padGain: 0.06, brightness: 800 },
  combat: { scale: [0, 3, 5, 6, 7, 10], root: 164.8, stepSeconds: 0.24, arpChance: 0.6, padGain: 0.05, brightness: 1400 },
};

let mood: MusicMood = { phase: "day", pressure: 0, combat: false };
let running = false;
let timer: number | null = null;
let step = 0;
let musicBus: GainNode | null = null;
let crickets: number | null = null;
let windSource: AudioBufferSourceNode | null = null;

function profile(): MoodProfile {
  if (mood.combat) return PROFILES["combat"]!;
  if (mood.pressure > 70) return PROFILES["tense"]!;
  return PROFILES[mood.phase] ?? PROFILES["day"]!;
}

export function updateMusicMood(next: MusicMood): void {
  mood = next;
  updateAmbience();
}

export function startMusic(): void {
  if (running) return;
  const context = audioContext();
  const master = masterBus();
  if (!context || !master) return;
  running = true;
  musicBus = context.createGain();
  musicBus.gain.value = 1;
  musicBus.connect(master);
  startWind();
  updateAmbience();
  const tick = () => {
    playStep();
    timer = window.setTimeout(tick, profile().stepSeconds * 1000);
  };
  tick();
}

function note(frequency: number, duration: number, gainValue: number, type: OscillatorType, filterFrequency: number): void {
  const context = audioContext();
  if (!context || !musicBus || !isSfxEnabled()) return;
  const osc = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFrequency;
  osc.type = type;
  osc.frequency.value = frequency;
  const t = context.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(gainValue, t + Math.min(0.12, duration * 0.3));
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(filter).connect(gain).connect(musicBus);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

function degree(index: number, octave = 0): number {
  const p = profile();
  const semis = p.scale[((index % p.scale.length) + p.scale.length) % p.scale.length]! + 12 * octave;
  return p.root * Math.pow(2, semis / 12);
}

function playStep(): void {
  if (!isSfxEnabled()) {
    step += 1;
    return;
  }
  const p = profile();
  // bass root every 4 steps, alternating I and VI-ish
  if (step % 4 === 0) {
    note(degree(step % 16 === 8 ? 3 : 0, -1), p.stepSeconds * 3.4, 0.05, "triangle", 500);
  }
  // pad chord every 8 steps
  if (step % 8 === 0) {
    const base = step % 32 === 16 ? 2 : 0;
    note(degree(base), p.stepSeconds * 7, p.padGain, "sine", p.brightness);
    note(degree(base + 2), p.stepSeconds * 7, p.padGain * 0.8, "sine", p.brightness);
    note(degree(base + 4), p.stepSeconds * 7, p.padGain * 0.6, "sine", p.brightness);
  }
  // arpeggio sparkle
  if (Math.random() < p.arpChance) {
    note(degree(Math.floor(Math.random() * p.scale.length), 1), p.stepSeconds * 1.6, 0.03, "sine", p.brightness * 1.4);
  }
  // combat pulse
  if (mood.combat && step % 2 === 0) {
    note(degree(0, -1), 0.1, 0.05, "square", 400);
  }
  step += 1;
}

function startWind(): void {
  const context = audioContext();
  if (!context || !musicBus) return;
  const seconds = 4;
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  windSource = context.createBufferSource();
  windSource.buffer = buffer;
  windSource.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 320;
  const gain = context.createGain();
  gain.gain.value = 0.018;
  windSource.connect(filter).connect(gain).connect(musicBus);
  windSource.start();
}

function updateAmbience(): void {
  // crickets at night only
  if (mood.phase === "night" && running && crickets === null) {
    const chirp = () => {
      if (!isSfxEnabled() || mood.phase !== "night") return;
      for (let index = 0; index < 3; index += 1) {
        window.setTimeout(() => note(4200 + Math.random() * 600, 0.05, 0.012, "sine", 6000), index * 90);
      }
    };
    crickets = window.setInterval(chirp, 2400);
  } else if (mood.phase !== "night" && crickets !== null) {
    window.clearInterval(crickets);
    crickets = null;
  }
  void timer;
}
