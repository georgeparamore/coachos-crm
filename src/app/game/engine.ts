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
import { DetectOptions, analyzeFile } from "./detect";

// Health ("rock meter") mechanics: hitting beats keeps the song intact,
// missing them breaks it up.
const HEALTH_START = 0.6;
const HEALTH_HIT: Record<"perfect" | "great" | "good" | "miss", number> = {
  perfect: 0.05,
  great: 0.04,
  good: 0.025,
  miss: 0,
};
const HEALTH_MISS = 0.13;
const HEALTH_OVERSTRUM = 0.05; // hitting a lane with no note there

// Timing windows in seconds (absolute distance from the note's target time).
const W_PERFECT = 0.045;
const W_GREAT = 0.09;
const W_GOOD = 0.14;
const W_MISS = 0.16; // pending + this far past time = miss

const POINTS = { perfect: 100, great: 70, good: 40, miss: 0 } as const;

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

type LiveNote = Note & { state: "pending" | "hit" | "missed"; judgment?: Judgment };
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
    this.audio.crossOrigin = "anonymous";
    this.audio.src = this.objectUrl;
    this.audio.load();
    return file.name;
  }

  // Decode + beat-detect the loaded file into notes. Runs client-side.
  async analyze(opts: DetectOptions): Promise<Note[]> {
    if (!this.file) throw new Error("No audio loaded");
    const { notes } = await analyzeFile(this.file, opts);
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

  // Sharp momentary dropout on a single miss — you hear the beat cut out.
  private duck() {
    if (!this.actx || !this.duckGain) return;
    const t = this.actx.currentTime;
    const g = this.duckGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.05, t + 0.02);
    g.linearRampToValueAtTime(1, t + 0.16);
  }

  private changeHealth(delta: number) {
    this.health = Math.max(0, Math.min(1, this.health + delta));
    this.applyHealthAudio();
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
    this.flashAt = -10;
    this.nextMilestone = 25;
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
      this.togglePlay();
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

    // play mode: match nearest pending note in this lane
    let best: LiveNote | null = null;
    let bestDelta = Infinity;
    for (const n of this.notes) {
      if (n.lane !== lane || n.state !== "pending") continue;
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

    best.state = "hit";
    best.judgment = j;
    this.counts[j] += 1;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const mult = 1 + Math.min(this.combo, 100) / 100;
    this.score += Math.round(POINTS[j] * mult);
    this.changeHealth(HEALTH_HIT[j]);
    this.laneFlash[lane] = t;
    this.popups.push({ text: j.toUpperCase(), color: judgmentColor(j), born: t, lane });

    // Feed the star: sparkle burst at the receptor.
    this.burst(lane, LANE_COLORS[lane], j === "perfect" ? 14 : 8);

    // Supernova flare on each combo milestone.
    if (this.combo >= this.nextMilestone) {
      this.nextMilestone += 25;
      this.supernova(LANE_COLORS[lane]);
    }
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
          this.duck();
          this.popups.push({ text: "MISS", color: judgmentColor("miss"), born: t, lane: n.lane });
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

  // Sparkle burst at a lane receptor when a note is hit.
  private burst(lane: number, color: string, n: number) {
    const { laneW, strikeY } = this.view;
    if (!laneW) return;
    const cx = lane * laneW + laneW / 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 220;
      this.particles.push({
        x: cx, y: strikeY,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.5 + Math.random() * 0.5, max: 1, color, r: 1.5 + Math.random() * 2.5, float: false,
      });
    }
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

    // Shooting stars.
    if (this.nowSec > this.nextShoot) {
      this.nextShoot = this.nowSec + 1.4 + Math.random() * 3.2;
      const fromLeft = Math.random() < 0.5;
      const speed = 520 + Math.random() * 380;
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
    this.cb.onHud({
      score: this.score,
      combo: this.combo,
      accuracy: Math.round(acc * 1000) / 10,
      recorded: this.recorded.length,
      health: this.health,
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

    // Glowing-star drawing helper.
    const drawStar = (x: number, y: number, r: number, color: string, intensity: number) => {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
      glow.addColorStop(0, hexA(color, 0.9 * intensity));
      glow.addColorStop(0.4, hexA(color, 0.35 * intensity));
      glow.addColorStop(1, hexA(color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
      ctx.fill();
      // bright core
      ctx.fillStyle = hexA("#ffffff", 0.95 * intensity);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hexA(color, intensity);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      // 4-point sparkle
      ctx.strokeStyle = hexA("#ffffff", 0.5 * intensity);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - r * 2, y); ctx.lineTo(x + r * 2, y);
      ctx.moveTo(x, y - r * 2); ctx.lineTo(x, y + r * 2);
      ctx.stroke();
    };

    // The star core / horizon that the notes feed into.
    const coreR = Math.min(W * 0.4, 140);
    const finaleElapsed = isFinale ? now - this.finaleStart : 0;
    const coreIntensity = isFinale ? 1 : 0.25 + 0.75 * health;
    const pulse = 1 + 0.06 * Math.sin(now * 4);
    const cg = ctx.createRadialGradient(W / 2, strikeY, 0, W / 2, strikeY, coreR * pulse * (isFinale ? 1.6 : 1));
    cg.addColorStop(0, hexA("#ffffff", 0.5 * coreIntensity));
    cg.addColorStop(0.35, hexA(isFinale ? "#ffd98a" : "#8f7bff", 0.32 * coreIntensity));
    cg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = cg;
    ctx.fillRect(0, strikeY - coreR * 2, W, coreR * 2 + H - strikeY);

    // Horizon line.
    const hg = ctx.createLinearGradient(0, 0, W, 0);
    hg.addColorStop(0, "rgba(143,123,255,0)");
    hg.addColorStop(0.5, hexA("#b9aaff", 0.5 * coreIntensity));
    hg.addColorStop(1, "rgba(143,123,255,0)");
    ctx.strokeStyle = hg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, strikeY);
    ctx.lineTo(W, strikeY);
    ctx.stroke();

    // Receptor rings.
    for (let i = 0; i < LANE_COUNT; i++) {
      const cx = i * laneW + laneW / 2;
      const rr = Math.min(laneW, 96) / 2 - 6;
      const held = this.laneHeld[i];
      ctx.strokeStyle = hexA(LANE_COLORS[i], held ? 1 : 0.7);
      ctx.lineWidth = held ? 4 : 2.5;
      ctx.beginPath();
      ctx.arc(cx, strikeY, rr, 0, Math.PI * 2);
      ctx.stroke();
      if (held) drawStar(cx, strikeY, rr * 0.4, LANE_COLORS[i], 0.8);
    }

    // Falling note-stars.
    const drawNote = (note: Note, faded: boolean) => {
      const y = strikeY - (note.time - t) * pxPerSec;
      if (y < -60 || y > H + 60) return;
      const x = note.lane * laneW + laneW / 2;
      const r = Math.min(laneW, 96) / 2 - 12;
      drawStar(x, y, r, LANE_COLORS[note.lane], faded ? 0.28 : 1);
    };
    if (isEdit) {
      for (const n of this.chart.notes) drawNote(n, true);
      for (const n of this.recorded) drawNote(n, false);
    } else if (!isFinale) {
      for (const n of this.notes) {
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

    this.popups = this.popups.filter((p) => t - p.born < 0.6);
    for (const p of this.popups) {
      const age = t - p.born;
      const cx = p.lane * laneW + laneW / 2;
      ctx.globalAlpha = Math.max(0, 1 - age / 0.6);
      ctx.fillStyle = p.color;
      ctx.font = "800 22px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.text, cx, strikeY - 70 - age * 40);
      ctx.globalAlpha = 1;
    }

    if (isFinale) {
      const titleSize = Math.min(64, Math.max(28, W * 0.06));
      ctx.fillStyle = hexA("#ffffff", Math.max(0, 1 - finaleElapsed / FINALE_SECONDS));
      ctx.font = `800 ${titleSize}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("SUPER NOVA", W / 2, H * 0.35);
    }
  }
}
