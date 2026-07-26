// Plain (non-React) game engine. All mutable game state lives here so the
// React component never mutates ref-held objects during render — it only
// calls methods and receives updates through callbacks.

import {
  Chart,
  LANE_COLORS,
  LANE_COUNT,
  LANE_KEYS,
  Note,
  emptyChart,
} from "./types";
import { DetectOptions, analyzeArrayBuffer } from "./detect";

// Health ("rock meter") mechanics: hitting beats keeps the song intact,
// missing them breaks it up.
const HEALTH_START = 0.7;
const HEALTH_HIT: Record<"perfect" | "great" | "good" | "miss", number> = {
  perfect: 0.06,
  great: 0.05,
  good: 0.035,
  miss: 0,
};
// Softer than before: a single miss dips the star, but only a real streak
// drains it enough to break the track up.
const HEALTH_MISS = 0.07;
const HEALTH_OVERSTRUM = 0.025; // hitting a lane with no note there

// Timing windows in seconds (absolute distance from the note's target time).
const W_PERFECT = 0.045;
const W_GREAT = 0.09;
const W_GOOD = 0.14;
const W_MISS = 0.16; // pending + this far past time = miss

// Perfects are worth noticeably more than Greats/Goods to reward precision.
const POINTS = { perfect: 100, great: 60, good: 25, miss: 0 } as const;

// Hold ("comet") notes: extra points per second held, doubled for a
// dual-lane combo hold since it's harder to sustain two keys at once.
const HOLD_BONUS_PER_SEC = 40;
const HOLD_DUAL_MULT = 1.5;
// A dropped hold (released early) breaks the track harder than a plain miss.
const HEALTH_DROP_MULT = 1.3;
// How close to the hold's end time counts as "held it out".
const HOLD_END_TOLERANCE = 0.05;

// Star power: a dedicated charge meter, separate from song-integrity health,
// so misses on the way to a charge only cost a little rather than wiping out
// health-draining progress. Charge is deliberately slow — a flawless
// full-song clear banks enough for about three pops, so it stays a rare
// payoff rather than something you trigger every other note.
const STAR_POWER_READY_AT = 0.999;
const STAR_POWER_DURATION = 12; // seconds
const STAR_POWER_MULT = 2;
const POWER_PER_HIT: Record<Judgment, number> = { perfect: 0.006, great: 0.0045, good: 0.0025, miss: 0 };
const POWER_MISS_DRAIN = 0.008; // gentle — a couple of misses barely dent it
const POWER_DROP_DRAIN = 0.012; // a dropped hold costs a little more
const POWER_HOLD_BONUS = 0.02; // per completed hold, x HOLD_DUAL_MULT if dual

export type Judgment = "perfect" | "great" | "good" | "miss";
export type EngineMode = "idle" | "play" | "edit" | "finale";

// How long the end-of-song supernova plays before results show.
const FINALE_SECONDS = 5;

export type Hud = {
  score: number;
  combo: number;
  accuracy: number;
  recorded: number;
  health: number; // 0..1, drives how "intact" the song sounds
  starPowerReady: boolean;
  starPower: boolean;
  starPowerRemaining: number; // seconds left in the active window
};

export type Results = {
  score: number;
  maxCombo: number;
  counts: Record<Judgment, number>;
  accuracy: number;
  total: number;
};

export type EngineCallbacks = {
  onHud: (h: Hud) => void;
  onFinish: (r: Results) => void;
  onEnded: () => void;
  onStatus: (s: string) => void;
};

type LiveNote = Note & {
  state: "pending" | "hit" | "missed" | "holding" | "completed" | "dropped";
  judgment?: Judgment;
  // Transient engagement tracking for hold notes: which required lane(s)
  // have been pressed within the start window so far.
  lane1Armed?: boolean;
  lane2Armed?: boolean;
};
type Popup = { text: string; color: string; born: number; lane: number };

function judge(delta: number): Judgment | null {
  const a = Math.abs(delta);
  if (a <= W_PERFECT) return "perfect";
  if (a <= W_GREAT) return "great";
  if (a <= W_GOOD) return "good";
  return null;
}

function judgmentColor(j: Judgment): string {
  if (j === "perfect") return "#ffd34d";
  if (j === "great") return "#3f9142";
  if (j === "good") return "#2f7dd6";
  return "#e24b4a";
}

function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export class GameEngine {
  private cb: EngineCallbacks;
  private audio: HTMLAudioElement;
  private canvas: HTMLCanvasElement | null = null;
  private objectUrl: string | null = null;
  private file: File | null = null;
  private srcUrl: string | null = null;

  // Web Audio graph: source → lowpass → healthGain → duckGain → destination.
  // healthGain/lowpass follow the rock meter (slow); duckGain is the sharp
  // per-miss dropout.
  private actx: AudioContext | null = null;
  private srcNode: MediaElementAudioSourceNode | null = null;
  private lowpass: BiquadFilterNode | null = null;
  private healthGain: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private health = HEALTH_START;

  private mode: EngineMode = "idle";
  private chart: Chart = emptyChart();
  private notes: LiveNote[] = [];
  private recorded: Note[] = [];
  // Hold notes currently being actively held (state === "holding"), checked
  // each frame for a drop or a successful completion.
  private holdActive: LiveNote[] = [];

  private isStarPower = false;
  private starPowerStart = 0;
  private starPowerReady = false;
  // Independent of `health` — this is purely the star-power charge (0..1).
  private power = 0;
  // Stars pulling into the core during star power (the "black hole" effect).
  private vortex: { angle: number; radius: number; speed: number; color: string }[] = [];

  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private counts: Record<Judgment, number> = { perfect: 0, great: 0, good: 0, miss: 0 };
  private laneFlash: number[] = new Array(LANE_COUNT).fill(-1);
  private laneHeld: boolean[] = new Array(LANE_COUNT).fill(false);
  private popups: Popup[] = [];

  private raf: number | null = null;
  private lastHud = 0;

  // --- space visuals ---
  private view = { w: 0, h: 0, laneW: 0, strikeY: 0 };
  private bgStars: { x: number; y: number; r: number; ph: number; sp: number; depth: number }[] = [];
  private starsSig = "";
  private shooting: { x: number; y: number; vx: number; vy: number; life: number; len: number }[] = [];
  private nextShoot = 0;
  private particles: { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number; float: boolean }[] = [];
  private shockwaves: { x: number; y: number; born: number; color: string; max: number }[] = [];
  private flashAt = -10; // wall-clock seconds of last supernova flare
  private flashColor = "#ffffff";
  private nextMilestone = 25;
  private nowSec = 0;
  private lastNow = 0;
  private finaleStart = 0;

  constructor(cb: EngineCallbacks) {
    this.cb = cb;
    this.audio = typeof Audio !== "undefined" ? new Audio() : ({} as HTMLAudioElement);
    if (this.audio.addEventListener) {
      this.audio.addEventListener("ended", () => {
        if (this.mode === "play") this.beginFinale();
        else this.cb.onEnded();
      });
    }
  }

  attachCanvas(c: HTMLCanvasElement | null) {
    this.canvas = c;
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this.audio.pause) this.audio.pause();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    if (this.actx) void this.actx.close();
  }

  // --- audio ---------------------------------------------------------------

  loadAudio(file: File): string {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(file);
    this.file = file;
    this.srcUrl = this.objectUrl;
    this.audio.crossOrigin = "anonymous";
    this.audio.src = this.objectUrl;
    this.audio.load();
    return file.name;
  }

  // Load bundled/hosted audio by URL (e.g. the baked-in Super Nova track).
  loadAudioUrl(url: string): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.file = null;
    this.srcUrl = url;
    this.audio.crossOrigin = "anonymous";
    this.audio.src = url;
    this.audio.load();
  }

  // Decode + beat-detect the current audio into notes. Runs client-side.
  async analyze(opts: DetectOptions): Promise<Note[]> {
    let buf: ArrayBuffer;
    if (this.file) {
      buf = await this.file.arrayBuffer();
    } else if (this.srcUrl) {
      buf = await (await fetch(this.srcUrl)).arrayBuffer();
    } else {
      throw new Error("No audio loaded");
    }
    const { notes } = await analyzeArrayBuffer(buf, opts);
    return notes;
  }

  // --- Web Audio graph (miss = the song breaks) ----------------------------

  private ensureGraph() {
    if (this.actx || typeof window === "undefined") return;
    const Ctx: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    try {
      const actx = new Ctx();
      const src = actx.createMediaElementSource(this.audio);
      const lowpass = actx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 20000;
      const healthGain = actx.createGain();
      healthGain.gain.value = 1;
      const duckGain = actx.createGain();
      duckGain.gain.value = 1;
      src.connect(lowpass);
      lowpass.connect(healthGain);
      healthGain.connect(duckGain);
      duckGain.connect(actx.destination);
      this.actx = actx;
      this.srcNode = src;
      this.lowpass = lowpass;
      this.healthGain = healthGain;
      this.duckGain = duckGain;
    } catch {
      // createMediaElementSource throws if called twice on one element; ignore.
    }
  }

  private resumeGraph() {
    this.ensureGraph();
    if (this.actx && this.actx.state === "suspended") void this.actx.resume();
  }

  // Push the current health level to the slow audio params: low health means
  // quieter and muffled, so the track audibly falls apart.
  private applyHealthAudio() {
    if (!this.actx || !this.healthGain || !this.lowpass) return;
    const t = this.actx.currentTime;
    const h = this.health;
    // Volume: full down near zero health, full up when healthy.
    const vol = 0.15 + 0.85 * Math.max(0, Math.min(1, h));
    this.healthGain.gain.setTargetAtTime(vol, t, 0.08);
    // Muffle: open filter when healthy, closed (~450 Hz) when failing.
    const cutoff = 450 + 19550 * Math.pow(Math.max(0, Math.min(1, h)), 1.5);
    this.lowpass.frequency.setTargetAtTime(cutoff, t, 0.08);
  }

  // Momentary dip on a single miss — you hear it stumble, but it's not a full
  // cut. How deep the dip goes scales with how low the star's energy is, so a
  // clean run barely flinches while a collapsing one really breaks up.
  private duck() {
    if (!this.actx || !this.duckGain) return;
    const t = this.actx.currentTime;
    const g = this.duckGain.gain;
    const depth = 0.55 - 0.45 * this.health; // healthy→dip to ~0.55, failing→~0.1
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(Math.max(0.08, depth), t + 0.02);
    g.linearRampToValueAtTime(1, t + 0.13);
  }

  private changeHealth(delta: number) {
    this.health = Math.max(0, Math.min(1, this.health + delta));
    this.applyHealthAudio();
  }

  // Star-power charge is independent of health — hits build it slowly,
  // misses only dent it a little. Gated off while the power is already
  // active so the bar doesn't fight with its own timed drain.
  private changePower(delta: number) {
    if (this.isStarPower) return;
    // Once fully charged, it's locked in — misses can't drain it back down.
    // The only way to spend it is to actually activate it.
    if (this.starPowerReady && delta < 0) return;
    this.power = Math.max(0, Math.min(1, this.power + delta));
    this.starPowerReady = this.power >= STAR_POWER_READY_AT;
  }

  // Pop the charged star-power meter: a big flare, a score multiplier, and a
  // timed drain back down to empty. No-op if not charged.
  activateStarPower(): void {
    if (this.mode !== "play" || this.isStarPower || !this.starPowerReady) return;
    this.isStarPower = true;
    this.starPowerReady = false;
    this.starPowerStart = this.nowSec;
    this.power = 1;
    this.starPowerBurst();
  }

  // A grander, more colorful burst than a mid-song combo flare — this is the
  // headline moment, so it goes bigger: more debris, brighter flash, and a
  // few shooting stars converging in immediately for drama.
  private starPowerBurst() {
    this.flashAt = this.nowSec;
    this.flashColor = "#ffffff";
    const { w, h, strikeY } = this.view;
    const cx = w / 2 || 0;
    const pal = ["#7ef9ff", "#ffe9a8", "#ff9ad6", "#ffffff", "#9d6bff"];
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 420;
      this.particles.push({
        x: cx, y: strikeY,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1 + Math.random() * 1.2, max: 2.2,
        color: pal[(Math.random() * pal.length) | 0],
        r: 1.5 + Math.random() * 4, float: true,
      });
    }
    for (let i = 0; i < 4; i++) {
      const fromLeft = Math.random() < 0.5;
      const speed = 700 + Math.random() * 400;
      const ang = (fromLeft ? 0.1 : Math.PI - 0.1) + (Math.random() - 0.5) * 0.3;
      this.shooting.push({
        x: fromLeft ? -40 : w + 40,
        y: Math.random() * (h || 400) * 0.6,
        vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
        life: 1.2, len: 130 + Math.random() * 160,
      });
    }
    this.capParticles();
  }

  get isPaused(): boolean {
    return this.audio.paused ?? true;
  }

  togglePlay(): void {
    if (!this.audio.play) return;
    if (this.audio.paused) {
      this.resumeGraph();
      this.audio.play().catch(() => this.cb.onStatus("Tap the board once, then press play."));
    } else {
      this.audio.pause();
    }
  }

  // --- transport -----------------------------------------------------------

  private resetRuntime(chart: Chart) {
    this.chart = chart;
    this.notes = chart.notes.map((n) => ({ ...n, state: "pending" as const }));
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0 };
    this.laneFlash = new Array(LANE_COUNT).fill(-1);
    this.laneHeld = new Array(LANE_COUNT).fill(false);
    this.popups = [];
    this.particles = [];
    this.shockwaves = [];
    this.flashAt = -10;
    this.nextMilestone = 25;
    this.holdActive = [];
    this.isStarPower = false;
    this.starPowerReady = false;
    this.power = 0;
    this.vortex = [];
  }

  startPlay(chart: Chart): void {
    this.resetRuntime(chart);
    this.mode = "play";
    this.health = HEALTH_START;
    this.resumeGraph();
    this.applyHealthAudio();
    if (this.duckGain && this.actx) this.duckGain.gain.setValueAtTime(1, this.actx.currentTime);
    this.audio.currentTime = 0;
    this.emitHud(true);
    this.audio.play?.().catch(() => this.cb.onStatus("Tap the board once, then press play."));
    this.ensureLoop();
  }

  startEdit(chart: Chart): void {
    this.resetRuntime(chart);
    this.recorded = [];
    this.mode = "edit";
    // No fail mechanic while charting — keep the track clean.
    this.health = 1;
    this.resumeGraph();
    this.applyHealthAudio();
    this.audio.currentTime = 0;
    this.emitHud(true);
    this.ensureLoop();
  }

  stop(): void {
    if (this.audio.pause) this.audio.pause();
    this.mode = "idle";
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  // Song ended: detonate the star and let the debris drift before results.
  private beginFinale(): void {
    if (this.audio.pause) this.audio.pause();
    this.mode = "finale";
    this.finaleStart = this.nowSec;
    this.explode();
  }

  private finalizeResults(): void {
    const total = this.notes.length;
    const done = this.counts.perfect + this.counts.great + this.counts.good + this.counts.miss;
    const acc = done
      ? (this.counts.perfect + this.counts.great * 0.7 + this.counts.good * 0.4) / done
      : 0;
    this.cb.onFinish({
      score: this.score,
      maxCombo: this.maxCombo,
      counts: { ...this.counts },
      accuracy: Math.round(acc * 1000) / 10,
      total,
    });
    this.mode = "idle";
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  // --- editor --------------------------------------------------------------

  getRecorded(): Note[] {
    return [...this.recorded].sort((a, b) => a.time - b.time);
  }

  clearRecorded(): void {
    this.recorded = [];
    this.emitHud(true);
  }

  undoRecorded(): void {
    this.recorded.pop();
    this.emitHud(true);
  }

  // --- input ---------------------------------------------------------------

  keyDown(rawKey: string, repeat: boolean): boolean {
    if (this.mode === "idle") return false;
    const k = rawKey.toLowerCase();

    if (k === " " || k === "spacebar") {
      // Space is dedicated to star power during play; charting keeps the
      // old play/pause behavior since there's no meter to pop there.
      if (this.mode === "play") this.activateStarPower();
      else this.togglePlay();
      return true;
    }
    if (k === "p") {
      if (this.mode === "play") this.togglePlay();
      return true;
    }
    if (this.mode === "edit" && (k === "backspace" || k === "z")) {
      this.undoRecorded();
      return true;
    }

    const lane = LANE_KEYS.indexOf(k as (typeof LANE_KEYS)[number]);
    if (lane < 0) return false;
    if (repeat) return true;
    this.pressLane(lane);
    return true;
  }

  keyUp(rawKey: string): void {
    const lane = LANE_KEYS.indexOf(rawKey.toLowerCase() as (typeof LANE_KEYS)[number]);
    if (lane >= 0) this.laneHeld[lane] = false;
  }

  pointerAt(clientX: number, rectLeft: number, rectWidth: number): void {
    const rel = clientX - rectLeft;
    const lane = Math.max(0, Math.min(LANE_COUNT - 1, Math.floor(rel / (rectWidth / LANE_COUNT))));
    this.pressLane(lane);
  }

  // Shared scoring/effects for a judged hit — a tapped note or the moment a
  // hold note gets fully engaged.
  private registerHit(note: LiveNote, j: Judgment, primaryLane: number): number {
    const t = this.audio.currentTime ?? 0;
    note.judgment = j;
    this.counts[j] += 1;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const mult = (1 + Math.min(this.combo, 100) / 100) * (this.isStarPower ? STAR_POWER_MULT : 1);
    const gained = Math.round(POINTS[j] * mult);
    this.score += gained;
    this.changeHealth(HEALTH_HIT[j]);
    this.changePower(POWER_PER_HIT[j]);
    this.laneFlash[primaryLane] = t;
    this.popups.push({ text: `${j.toUpperCase()} +${gained}`, color: judgmentColor(j), born: t, lane: primaryLane });
    this.burst(primaryLane, LANE_COLORS[primaryLane], j === "perfect" ? 14 : 8);
    if (this.combo >= this.nextMilestone) {
      this.nextMilestone += 25;
      this.supernova(LANE_COLORS[primaryLane]);
    }
    return gained;
  }

  private pressLane(lane: number): void {
    const t = this.audio.currentTime ?? 0;
    this.laneHeld[lane] = true;

    if (this.mode === "edit") {
      if (!this.audio.paused) {
        this.recorded.push({ time: t, lane });
        this.laneFlash[lane] = t;
        this.emitHud(true);
      }
      return;
    }

    // Match the nearest pending note that wants this lane — either as its
    // primary lane, or as the second lane of a dual combo hold.
    let best: LiveNote | null = null;
    let bestDelta = Infinity;
    for (const n of this.notes) {
      if (n.state !== "pending") continue;
      if (n.lane !== lane && n.lane2 !== lane) continue;
      const d = n.time - t;
      if (d > W_GOOD) break; // sorted; nothing closer past here
      if (Math.abs(d) < Math.abs(bestDelta)) {
        bestDelta = d;
        best = n;
      }
    }
    const j = best ? judge(bestDelta) : null;
    if (!best || !j) {
      // Overstrum: pressed a lane with no note to hit — small break.
      this.combo = 0;
      this.changeHealth(-HEALTH_OVERSTRUM);
      this.duck();
      return;
    }

    if (best.holdDur == null) {
      best.state = "hit";
      this.registerHit(best, j, lane);
      return;
    }

    // Hold note: arm whichever side was just pressed.
    if (best.lane2 !== undefined && lane === best.lane2) best.lane2Armed = true;
    else best.lane1Armed = true;

    const needsBoth = best.lane2 !== undefined;
    const bothReady = !needsBoth || (best.lane1Armed && best.lane2Armed);
    if (!bothReady) {
      // Only one side of a combo hold is down so far — flash it and wait
      // for the other within the same timing window.
      this.laneFlash[lane] = t;
      return;
    }

    best.state = "holding";
    this.registerHit(best, j, lane);
    this.holdActive.push(best);
  }

  // --- loop ----------------------------------------------------------------

  private ensureLoop() {
    if (this.raf == null) this.raf = requestAnimationFrame(this.loop);
  }

  private loop = () => {
    const now = performance.now() / 1000;
    const dt = this.lastNow ? Math.min(0.05, now - this.lastNow) : 0;
    this.lastNow = now;
    this.nowSec = now;
    const t = this.audio.currentTime ?? 0;

    if (this.mode === "play") {
      for (const n of this.notes) {
        if (n.state === "pending" && t - n.time > W_MISS) {
          n.state = "missed";
          n.judgment = "miss";
          this.counts.miss += 1;
          this.combo = 0;
          this.changeHealth(-HEALTH_MISS);
          this.changePower(-POWER_MISS_DRAIN);
          this.duck();
          this.popups.push({ text: "MISS", color: judgmentColor("miss"), born: t, lane: n.lane });
        }
      }

      // Actively-held comets: drop them the instant a required key releases
      // early, or bank the completion bonus once held through to the end.
      for (const n of this.holdActive) {
        if (n.state !== "holding") continue;
        const endTime = n.time + (n.holdDur ?? 0);
        const stillHeld = this.laneHeld[n.lane] && (n.lane2 === undefined || this.laneHeld[n.lane2]);
        if (!stillHeld) {
          n.state = "dropped";
          this.counts.miss += 1;
          this.combo = 0;
          this.changeHealth(-HEALTH_MISS * HEALTH_DROP_MULT);
          this.changePower(-POWER_DROP_DRAIN);
          this.duck();
          this.popups.push({ text: "DROPPED", color: judgmentColor("miss"), born: t, lane: n.lane });
        } else if (t >= endTime - HOLD_END_TOLERANCE) {
          n.state = "completed";
          const mult = this.isStarPower ? STAR_POWER_MULT : 1;
          const bonus = Math.round(HOLD_BONUS_PER_SEC * (n.holdDur ?? 0) * (n.lane2 !== undefined ? HOLD_DUAL_MULT : 1) * mult);
          this.score += bonus;
          this.changePower(POWER_HOLD_BONUS * (n.lane2 !== undefined ? HOLD_DUAL_MULT : 1));
          this.laneFlash[n.lane] = t;
          if (n.lane2 !== undefined) this.laneFlash[n.lane2] = t;
          this.popups.push({ text: `HOLD +${bonus}`, color: "#ffd34d", born: t, lane: n.lane });
          this.burst(n.lane, LANE_COLORS[n.lane], 16);
          if (n.lane2 !== undefined) this.burst(n.lane2, LANE_COLORS[n.lane2], 16);
        }
      }
      this.holdActive = this.holdActive.filter((n) => n.state === "holding");

      // Star power's own charge drains on a fixed timer back to empty —
      // health is untouched, they're fully independent meters now.
      if (this.isStarPower) {
        const elapsed = now - this.starPowerStart;
        if (elapsed >= STAR_POWER_DURATION) {
          this.isStarPower = false;
          this.power = 0;
        } else {
          this.power = Math.max(0, 1 - elapsed / STAR_POWER_DURATION);
        }
      }

      this.emitHud(false);
    } else if (this.mode === "finale") {
      if (now - this.finaleStart > FINALE_SECONDS) {
        this.finalizeResults();
        return;
      }
    }

    this.updateAmbience(dt);
    this.render(t);
    this.raf = requestAnimationFrame(this.loop);
  };

  // --- particles, shooting stars, supernovae --------------------------------

  private capParticles() {
    if (this.particles.length > 460) this.particles.splice(0, this.particles.length - 460);
  }

  // Dust explosion at a lane receptor when a note is hit on the mark: a burst
  // of colored + white embers plus an expanding shockwave ring.
  private burst(lane: number, color: string, n: number) {
    const { laneW, strikeY } = this.view;
    if (!laneW) return;
    const cx = lane * laneW + laneW / 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 90 + Math.random() * 300;
      const white = Math.random() < 0.35;
      this.particles.push({
        x: cx, y: strikeY,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0.35 + Math.random() * 0.55, max: 0.9,
        color: white ? "#ffffff" : color,
        r: 1 + Math.random() * (white ? 1.8 : 3),
        float: false,
      });
    }
    this.shockwaves.push({ x: cx, y: strikeY, born: this.nowSec, color, max: n >= 12 ? 70 : 46 });
    this.capParticles();
  }

  // Mid-song combo flare from the star core.
  private supernova(color: string) {
    this.flashAt = this.nowSec;
    this.flashColor = color;
    const { w, strikeY } = this.view;
    const cx = w / 2 || 0;
    for (let i = 0; i < 44; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 260;
      this.particles.push({
        x: cx, y: strikeY,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.8 + Math.random() * 0.7, max: 1.5, color, r: 1.5 + Math.random() * 2.5, float: false,
      });
    }
    this.capParticles();
  }

  // End-of-song detonation: the star bursts into colorful, floating debris.
  private explode() {
    const { w, strikeY } = this.view;
    const cx = w / 2 || 0;
    const palette = [...LANE_COLORS, "#ffffff", "#ffe9a8", "#7ef9ff"];
    for (let i = 0; i < 220; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 340;
      this.particles.push({
        x: cx, y: strikeY,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 2.6 + Math.random() * 2.6, max: 5.2,
        color: palette[(Math.random() * palette.length) | 0],
        r: 1.5 + Math.random() * 3.5, float: true,
      });
    }
    this.flashAt = this.nowSec;
    this.flashColor = "#ffffff";
    this.capParticles();
  }

  private updateAmbience(dt: number) {
    const { w, h } = this.view;
    if (!w) return;

    const poweredNow = this.mode === "play" && this.isStarPower;

    // Shooting stars — a flurry of them during star power instead of the
    // usual occasional streak.
    if (this.nowSec > this.nextShoot) {
      this.nextShoot = this.nowSec + (poweredNow ? 0.2 + Math.random() * 0.4 : 1.4 + Math.random() * 3.2);
      const fromLeft = Math.random() < 0.5;
      const speed = (poweredNow ? 700 : 520) + Math.random() * 380;
      const ang = (fromLeft ? 0.15 : Math.PI - 0.15) + (Math.random() - 0.5) * 0.25;
      this.shooting.push({
        x: fromLeft ? -40 : w + 40,
        y: Math.random() * h * 0.5,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        life: 1.6, len: 90 + Math.random() * 120,
      });
    }
    for (const s of this.shooting) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
    }
    this.shooting = this.shooting.filter((s) => s.life > 0 && s.x > -80 && s.x < w + 80);

    if (poweredNow) {
      const { strikeY } = this.view;
      const cx = w / 2;

      // A steady drift of sparkles around the core.
      if (Math.random() < 0.6) {
        const a = Math.random() * Math.PI * 2;
        const r = 40 + Math.random() * 90;
        this.particles.push({
          x: cx + Math.cos(a) * r,
          y: strikeY + Math.sin(a) * r,
          vx: Math.cos(a) * 22,
          vy: Math.sin(a) * 22 - 12,
          life: 0.6 + Math.random() * 0.6,
          max: 1.2,
          color: Math.random() < 0.5 ? "#7ef9ff" : "#ffe9a8",
          r: 1 + Math.random() * 2,
          float: true,
        });
      }

      // Black-hole infall: stars spawn out at the edges and get pulled into
      // the core, accelerating as they fall in — "at the speed of light."
      if (Math.random() < 0.7) {
        const pal = ["#7ef9ff", "#ffe9a8", "#ff9ad6", "#ffffff", "#9d6bff"];
        this.vortex.push({
          angle: Math.random() * Math.PI * 2,
          radius: Math.max(w, h) * (0.55 + Math.random() * 0.35),
          speed: 60 + Math.random() * 60,
          color: pal[(Math.random() * pal.length) | 0],
        });
      }
      for (const v of this.vortex) {
        v.speed *= 1 + dt * 2.2; // accelerates as it falls in
        v.radius -= v.speed * dt;
      }
      this.vortex = this.vortex.filter((v) => v.radius > 6);
      if (this.vortex.length > 150) this.vortex.splice(0, this.vortex.length - 150);
    } else if (this.vortex.length) {
      this.vortex = [];
    }

    // Particles.
    for (const p of this.particles) {
      if (p.float) {
        p.vx *= 0.988;
        p.vy *= 0.988;
        p.vy += Math.sin(this.nowSec * 1.4 + p.x * 0.02) * 3 * dt; // gentle drift
      } else {
        p.vx *= 0.9;
        p.vy = p.vy * 0.9 + 120 * dt; // fall away
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private emitHud(force: boolean) {
    const now = performance.now();
    if (!force && now - this.lastHud < 80) return;
    this.lastHud = now;
    const done = this.counts.perfect + this.counts.great + this.counts.good + this.counts.miss;
    const acc = done
      ? (this.counts.perfect + this.counts.great * 0.7 + this.counts.good * 0.4) / done
      : 1;
    const starPowerRemaining = this.isStarPower
      ? Math.max(0, STAR_POWER_DURATION - (this.nowSec - this.starPowerStart))
      : 0;
    this.cb.onHud({
      score: this.score,
      combo: this.combo,
      accuracy: Math.round(acc * 1000) / 10,
      recorded: this.recorded.length,
      health: this.health,
      starPowerReady: this.starPowerReady,
      starPower: this.isStarPower,
      starPowerRemaining,
    });
  }

  // --- rendering -----------------------------------------------------------

  private initStars(w: number, h: number) {
    const sig = `${w}x${h}`;
    if (this.starsSig === sig && this.bgStars.length) return;
    this.starsSig = sig;
    const count = Math.min(240, Math.max(70, Math.round((w * h) / 6500)));
    const stars = [];
    for (let i = 0; i < count; i++) {
      const depth = Math.random();
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.4 + depth * 1.7,
        ph: Math.random() * Math.PI * 2,
        sp: 0.5 + Math.random() * 2,
        depth,
      });
    }
    this.bgStars = stars;
  }

  private render(t: number) {
    const canvas = this.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const laneW = W / LANE_COUNT;
    const strikeY = H - 96;
    const approach = this.chart.approachSeconds || 1.8;
    const pxPerSec = strikeY / approach;
    const isEdit = this.mode === "edit";
    const isFinale = this.mode === "finale";
    const now = this.nowSec;
    const health = this.health;
    this.view = { w: W, h: H, laneW, strikeY };
    this.initStars(W, H);

    // Deep-space backdrop.
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#05060f");
    bg.addColorStop(0.55, "#0a0a18");
    bg.addColorStop(1, "#0c0716");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = "lighter";

    // Nebula haze — breathes with the star's energy.
    const neb = (cx: number, cy: number, rad: number, color: string, a: number) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, hexA(color, a));
      g.addColorStop(1, hexA(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    };
    const nebA = 0.05 + 0.05 * health;
    neb(W * 0.25, H * 0.3, Math.max(W, H) * 0.5, "#3a2a7a", nebA);
    neb(W * 0.8, H * 0.5, Math.max(W, H) * 0.45, "#0b5c7a", nebA);

    // Star power: a shifting-hue glow wash across the whole screen while active.
    if (this.mode === "play" && this.isStarPower) {
      const hue = (now * 90) % 360;
      ctx.fillStyle = `hsla(${hue}, 85%, 60%, ${0.08 + 0.05 * Math.sin(now * 5)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Twinkling starfield.
    for (const s of this.bgStars) {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(now * s.sp + s.ph));
      ctx.fillStyle = hexA("#ffffff", tw * (0.35 + s.depth * 0.5));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shooting stars.
    for (const s of this.shooting) {
      const a = Math.max(0, Math.min(1, s.life)) * 0.9;
      const tx = s.x - (s.vx / Math.hypot(s.vx, s.vy)) * s.len;
      const ty = s.y - (s.vy / Math.hypot(s.vx, s.vy)) * s.len;
      const g = ctx.createLinearGradient(s.x, s.y, tx, ty);
      g.addColorStop(0, hexA("#ffffff", a));
      g.addColorStop(1, hexA("#7ec8ff", 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }

    // Lane energy columns (hold / recent hit).
    for (let i = 0; i < LANE_COUNT; i++) {
      const since = t - this.laneFlash[i];
      if ((since >= 0 && since < 0.16) || this.laneHeld[i]) {
        const alpha = this.laneHeld[i] ? 0.1 : 0.3 * (1 - since / 0.16);
        const grad = ctx.createLinearGradient(0, strikeY - 260, 0, strikeY);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, hexA(LANE_COLORS[i], alpha));
        ctx.fillStyle = grad;
        ctx.fillRect(i * laneW, strikeY - 260, laneW, 260);
      }
    }

    // Glowing star / ball-of-gas drawing helper. `seed` (0..1) desyncs each
    // star's pulse and drifting corona so they don't all breathe in lockstep.
    const drawStar = (x: number, y: number, r: number, color: string, intensity: number, seed = 0) => {
      const phase = seed * Math.PI * 2;
      const pulse = 0.88 + 0.12 * Math.sin(now * 2.6 + phase);
      const rr = r * pulse;

      // Soft outer halo.
      const glow = ctx.createRadialGradient(x, y, 0, x, y, rr * 3.6);
      glow.addColorStop(0, hexA(color, 0.55 * intensity));
      glow.addColorStop(0.45, hexA(color, 0.22 * intensity));
      glow.addColorStop(1, hexA(color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, rr * 3.6, 0, Math.PI * 2);
      ctx.fill();

      // Drifting gas-cloud turbulence: three soft lobes slowly orbiting the core.
      for (let i = 0; i < 3; i++) {
        const ang = now * 0.5 + phase + i * ((Math.PI * 2) / 3);
        const off = rr * 0.32;
        const bx = x + Math.cos(ang) * off, by = y + Math.sin(ang) * off;
        const bg = ctx.createRadialGradient(bx, by, 0, bx, by, rr * 1.4);
        bg.addColorStop(0, hexA(color, 0.38 * intensity));
        bg.addColorStop(1, hexA(color, 0));
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(bx, by, rr * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // White-hot core.
      const core = ctx.createRadialGradient(x, y, 0, x, y, rr * 0.85);
      core.addColorStop(0, hexA("#ffffff", 0.98 * intensity));
      core.addColorStop(0.55, hexA(color, 0.92 * intensity));
      core.addColorStop(1, hexA(color, 0));
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(x, y, rr * 0.85, 0, Math.PI * 2);
      ctx.fill();

      // Sparkle cross with a gentle length pulse.
      const rayLen = rr * (2 + 0.35 * Math.sin(now * 2.2 + phase));
      ctx.strokeStyle = hexA("#ffffff", 0.5 * intensity);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - rayLen, y); ctx.lineTo(x + rayLen, y);
      ctx.moveTo(x, y - rayLen); ctx.lineTo(x, y + rayLen);
      ctx.stroke();
    };

    // The star core / horizon that the notes feed into.
    const coreR = Math.min(W * 0.4, 140);
    const finaleElapsed = isFinale ? now - this.finaleStart : 0;
    const coreIntensity = isFinale ? 1 : 0.25 + 0.75 * health;
    const powered = this.mode === "play" && this.isStarPower;

    if (powered) {
      // A black hole devouring the light around it: a dark event horizon,
      // a bright shifting-hue rim, and tilted accretion rings spinning at
      // different speeds — the "galaxy pulling stars in" moment.
      const cx = W / 2, cy = strikeY;
      const hue = (now * 70) % 360;
      const prevOp = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#04030a";
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = prevOp;

      const rim = ctx.createRadialGradient(cx, cy, coreR * 0.4, cx, cy, coreR * 0.78);
      rim.addColorStop(0, "rgba(0,0,0,0)");
      rim.addColorStop(0.6, `hsla(${hue}, 95%, 65%, 0.9)`);
      rim.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 0.78, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < 3; i++) {
        const rot = now * (0.6 + i * 0.25) + i * 2.1;
        const rx = coreR * (1.0 + i * 0.45);
        const ry = rx * 0.32;
        const ringHue = (hue + i * 70) % 360;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.strokeStyle = `hsla(${ringHue}, 90%, 65%, ${0.5 - i * 0.12})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      const pulse = 1 + 0.06 * Math.sin(now * 4);
      const cg = ctx.createRadialGradient(W / 2, strikeY, 0, W / 2, strikeY, coreR * pulse * (isFinale ? 1.6 : 1));
      cg.addColorStop(0, hexA("#ffffff", 0.5 * coreIntensity));
      cg.addColorStop(0.35, hexA(isFinale ? "#ffd98a" : "#8f7bff", 0.32 * coreIntensity));
      cg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = cg;
      ctx.fillRect(0, strikeY - coreR * 2, W, coreR * 2 + H - strikeY);
    }

    // Horizon line — shifts through the star-power palette while active.
    const hg = ctx.createLinearGradient(0, 0, W, 0);
    if (powered) {
      const hue = (now * 90) % 360;
      hg.addColorStop(0, "rgba(0,0,0,0)");
      hg.addColorStop(0.5, `hsla(${hue}, 90%, 70%, 0.9)`);
      hg.addColorStop(1, "rgba(0,0,0,0)");
    } else {
      hg.addColorStop(0, "rgba(143,123,255,0)");
      hg.addColorStop(0.5, hexA("#b9aaff", 0.5 * coreIntensity));
      hg.addColorStop(1, "rgba(143,123,255,0)");
    }
    ctx.strokeStyle = hg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, strikeY);
    ctx.lineTo(W, strikeY);
    ctx.stroke();

    // Vortex particles: stars streaking inward and vanishing into the core.
    for (const v of this.vortex) {
      const x = W / 2 + Math.cos(v.angle) * v.radius;
      const y = strikeY + Math.sin(v.angle) * v.radius * 0.4;
      const trail = Math.min(60, v.speed * 3);
      const tx = W / 2 + Math.cos(v.angle) * (v.radius + trail);
      const ty = strikeY + Math.sin(v.angle) * (v.radius + trail) * 0.4;
      const g = ctx.createLinearGradient(tx, ty, x, y);
      g.addColorStop(0, hexA(v.color, 0));
      g.addColorStop(1, hexA(v.color, 0.9));
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    // Receptor rings — an ambient aura builds as the star-power meter
    // charges, then pulses through the palette once it's active.
    for (let i = 0; i < LANE_COUNT; i++) {
      const cx = i * laneW + laneW / 2;
      const rr = Math.min(laneW, 96) / 2 - 6;
      const held = this.laneHeld[i];

      if (this.mode === "play") {
        const glowA = powered ? 0.55 + 0.2 * Math.sin(now * 6 + i) : Math.max(0, this.power - 0.5) * 0.7;
        if (glowA > 0.02) {
          const glowHue = powered ? (now * 140 + i * 40) % 360 : 195;
          const rg = ctx.createRadialGradient(cx, strikeY, 0, cx, strikeY, rr * 2.4);
          rg.addColorStop(0, `hsla(${glowHue}, 90%, 65%, ${glowA})`);
          rg.addColorStop(1, `hsla(${glowHue}, 90%, 65%, 0)`);
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.arc(cx, strikeY, rr * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.strokeStyle = hexA(LANE_COLORS[i], held ? 1 : 0.7);
      ctx.lineWidth = held ? 4 : 2.5;
      ctx.beginPath();
      ctx.arc(cx, strikeY, rr, 0, Math.PI * 2);
      ctx.stroke();
      if (held) drawStar(cx, strikeY, rr * 0.4, LANE_COLORS[i], 0.8, i * 0.27);
    }

    // Falling note-stars.
    const drawNote = (note: Note, faded: boolean) => {
      const y = strikeY - (note.time - t) * pxPerSec;
      if (y < -60 || y > H + 60) return;
      const x = note.lane * laneW + laneW / 2;
      const r = Math.min(laneW, 96) / 2 - 12;
      const seed = (note.time * 0.61803398875) % 1; // deterministic per-note phase
      drawStar(x, y, r, LANE_COLORS[note.lane], faded ? 0.28 : 1, seed);
    };

    // Hold ("comet") notes: a streaking beam from the head (leading edge)
    // to the tail. While actively held, the head pins to the strike line and
    // the beam shrinks as the tail catches up. A dropped hold turns gray for
    // whatever's left of its run.
    const drawComet = (n: LiveNote) => {
      if (n.state === "completed") return;
      const start = n.time;
      const end = n.time + (n.holdDur ?? 0);
      const gray = n.state === "dropped";
      let headY: number;
      let tailY: number;
      if (n.state === "holding" && !gray) {
        headY = strikeY;
        tailY = strikeY - (end - t) * pxPerSec;
      } else {
        headY = strikeY - (start - t) * pxPerSec;
        tailY = strikeY - (end - t) * pxPerSec;
      }
      const top = Math.min(headY, tailY);
      const bottom = Math.max(headY, tailY);
      if (bottom < -80 || top > H + 80) return;

      const lanes = n.lane2 !== undefined ? [n.lane, n.lane2] : [n.lane];
      const beamW = Math.max(6, Math.min(laneW, 96) * 0.22);
      for (const lane of lanes) {
        const x = lane * laneW + laneW / 2;
        const color = gray ? "#6c6c74" : LANE_COLORS[lane];
        const grad = ctx.createLinearGradient(x, top, x, bottom);
        grad.addColorStop(0, hexA(color, gray ? 0.05 : 0.08));
        grad.addColorStop(1, hexA(color, gray ? 0.5 : 0.9));
        ctx.strokeStyle = grad;
        ctx.lineWidth = beamW;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
        if (!gray) {
          const glow = ctx.createRadialGradient(x, bottom, 0, x, bottom, Math.min(laneW, 96) * 0.5);
          glow.addColorStop(0, hexA("#ffffff", 0.9));
          glow.addColorStop(0.4, hexA(color, 0.6));
          glow.addColorStop(1, hexA(color, 0));
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x, bottom, Math.min(laneW, 96) * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (n.lane2 !== undefined && !gray) {
        const x1 = n.lane * laneW + laneW / 2;
        const x2 = n.lane2 * laneW + laneW / 2;
        ctx.strokeStyle = hexA("#ffffff", 0.25);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, Math.min(strikeY, bottom));
        ctx.lineTo(x2, Math.min(strikeY, bottom));
        ctx.stroke();
      }
    };

    if (isEdit) {
      for (const n of this.chart.notes) drawNote(n, true);
      for (const n of this.recorded) drawNote(n, false);
    } else if (!isFinale) {
      for (const n of this.notes) {
        if (n.holdDur != null) {
          drawComet(n);
          continue;
        }
        if (n.state === "hit") continue;
        drawNote(n, n.state === "missed");
      }
    }

    // Particles (sparkles + supernova debris).
    for (const p of this.particles) {
      const a = Math.max(0, Math.min(1, p.life / p.max));
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
      g.addColorStop(0, hexA(p.color, a));
      g.addColorStop(1, hexA(p.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hexA("#ffffff", a * 0.9);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hit shockwave rings — a fast expanding ring at the moment a note lands.
    this.shockwaves = this.shockwaves.filter((s) => now - s.born < 0.4);
    for (const s of this.shockwaves) {
      const age = now - s.born;
      const p = age / 0.4;
      const rad = s.max * p;
      const a = (1 - p) * 0.7;
      ctx.strokeStyle = hexA(s.color, a);
      ctx.lineWidth = 3 * (1 - p) + 0.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = hexA("#ffffff", a * 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rad * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Supernova flash rings.
    const flashAge = now - this.flashAt;
    if (flashAge >= 0 && flashAge < 0.7) {
      const a = (1 - flashAge / 0.7) * 0.55;
      const fg = ctx.createRadialGradient(W / 2, strikeY, 0, W / 2, strikeY, Math.max(W, H) * (0.3 + flashAge));
      fg.addColorStop(0, hexA(this.flashColor, a));
      fg.addColorStop(0.6, hexA(this.flashColor, a * 0.3));
      fg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, W, H);
    }

    // Finale: expanding supernova shockwave from the collapsing core.
    if (isFinale) {
      const frac = finaleElapsed / FINALE_SECONDS;
      const ringR = frac * Math.hypot(W, H) * 1.1;
      const ringA = Math.max(0, 1 - frac) * 0.6;
      const ring = ctx.createRadialGradient(W / 2, strikeY, ringR * 0.7, W / 2, strikeY, ringR);
      ring.addColorStop(0, "rgba(0,0,0,0)");
      ring.addColorStop(0.85, hexA("#ffd98a", ringA));
      ring.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ring;
      ctx.fillRect(0, 0, W, H);
      // early white-out flash
      if (finaleElapsed < 0.5) {
        ctx.fillStyle = hexA("#ffffff", (1 - finaleElapsed / 0.5) * 0.7);
        ctx.fillRect(0, 0, W, H);
      }
    }

    // Text overlays (normal blending).
    ctx.globalCompositeOperation = "source-over";

    for (let i = 0; i < LANE_COUNT; i++) {
      const cx = i * laneW + laneW / 2;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(LANE_KEYS[i].toUpperCase(), cx, strikeY);
    }

    // Star-power charge bar, right at the strike line where the action is —
    // easy to catch out of the corner of your eye without leaving the notes.
    if (this.mode === "play") {
      const barW = Math.min(360, W * 0.5);
      const barX = W / 2 - barW / 2;
      const barY = strikeY + 46;
      const barH = 7;
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(barX, barY, barW, barH);
      const fillW = barW * Math.max(0, Math.min(1, this.power));
      if (this.isStarPower) {
        const hue = (now * 90) % 360;
        const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        grad.addColorStop(0, `hsl(${hue}, 90%, 65%)`);
        grad.addColorStop(0.5, `hsl(${(hue + 80) % 360}, 90%, 65%)`);
        grad.addColorStop(1, `hsl(${(hue + 160) % 360}, 90%, 65%)`);
        ctx.fillStyle = grad;
        ctx.shadowColor = `hsl(${hue}, 90%, 65%)`;
        ctx.shadowBlur = 18;
      } else if (this.starPowerReady) {
        ctx.fillStyle = "#3ad6ff";
        ctx.shadowColor = "#3ad6ff";
        ctx.shadowBlur = 14;
      } else {
        ctx.fillStyle = "#8f7bff";
        ctx.shadowBlur = 0;
      }
      if (fillW > 0.5) ctx.fillRect(barX, barY, fillW, barH);
      ctx.shadowBlur = 0;

      if (this.isStarPower) {
        const remain = Math.max(0, STAR_POWER_DURATION - (now - this.starPowerStart));
        ctx.fillStyle = `hsl(${(now * 140) % 360}, 90%, 70%)`;
        ctx.font = "800 14px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`★ STAR POWER  ${remain.toFixed(1)}s`, W / 2, barY - 14);
      } else if (this.starPowerReady) {
        ctx.fillStyle = "#3ad6ff";
        ctx.font = "700 13px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("⚡ STAR POWER READY — SPACE", W / 2, barY - 14);
      }
    }

    this.popups = this.popups.filter((p) => t - p.born < 0.6);
    for (const p of this.popups) {
      const age = t - p.born;
      const cx = p.lane * laneW + laneW / 2;
      ctx.globalAlpha = Math.max(0, 1 - age / 0.6);
      ctx.fillStyle = p.color;
      ctx.font = "800 15px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.text, cx, strikeY - 70 - age * 40);
      ctx.globalAlpha = 1;
    }

    if (isFinale) {
      const titleSize = Math.min(64, Math.max(28, W * 0.06));
      const fade = Math.max(0, 1 - finaleElapsed / FINALE_SECONDS);
      ctx.fillStyle = hexA("#ffffff", fade);
      ctx.font = `800 ${titleSize}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("SUPER NOVA", W / 2, H * 0.35);
      const songLabel = this.chart.artist ? `${this.chart.artist} — ${this.chart.title}` : this.chart.title;
      ctx.fillStyle = hexA("#ffd98a", fade * 0.85);
      ctx.font = "600 16px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(songLabel, W / 2, H * 0.35 + titleSize * 0.62);
    }
  }
}
