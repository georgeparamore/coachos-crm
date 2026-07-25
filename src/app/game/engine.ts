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
export type EngineMode = "idle" | "play" | "edit";

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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
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

  constructor(cb: EngineCallbacks) {
    this.cb = cb;
    this.audio = typeof Audio !== "undefined" ? new Audio() : ({} as HTMLAudioElement);
    if (this.audio.addEventListener) {
      this.audio.addEventListener("ended", () => {
        if (this.mode === "play") this.finishPlay();
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

  private finishPlay(): void {
    if (this.audio.pause) this.audio.pause();
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
  }

  // --- loop ----------------------------------------------------------------

  private ensureLoop() {
    if (this.raf == null) this.raf = requestAnimationFrame(this.loop);
  }

  private loop = () => {
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
    }

    this.render(t);
    this.raf = requestAnimationFrame(this.loop);
  };

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

  private render(t: number) {
    const canvas = this.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = cssW;
    const H = cssH;
    const laneW = W / LANE_COUNT;
    const strikeY = H - 96;
    const approach = this.chart.approachSeconds || 1.8;
    const pxPerSec = strikeY / approach;
    const isEdit = this.mode === "edit";

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0e0e12";
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < LANE_COUNT; i++) {
      const x = i * laneW;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)";
      ctx.fillRect(x, 0, laneW, H);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    for (let i = 0; i < LANE_COUNT; i++) {
      const since = t - this.laneFlash[i];
      if ((since >= 0 && since < 0.14) || this.laneHeld[i]) {
        const alpha = this.laneHeld[i] ? 0.12 : 0.28 * (1 - since / 0.14);
        const grad = ctx.createLinearGradient(0, strikeY - 220, 0, strikeY);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, hexA(LANE_COLORS[i], alpha));
        ctx.fillStyle = grad;
        ctx.fillRect(i * laneW, strikeY - 220, laneW, 220);
      }
    }

    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, strikeY);
    ctx.lineTo(W, strikeY);
    ctx.stroke();

    for (let i = 0; i < LANE_COUNT; i++) {
      const cx = i * laneW + laneW / 2;
      ctx.beginPath();
      ctx.arc(cx, strikeY, Math.min(laneW, 90) / 2 - 6, 0, Math.PI * 2);
      ctx.strokeStyle = hexA(LANE_COLORS[i], 0.85);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "600 14px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(LANE_KEYS[i].toUpperCase(), cx, strikeY);
    }

    const drawNote = (note: Note, faded: boolean) => {
      const y = strikeY - (note.time - t) * pxPerSec;
      if (y < -40 || y > H + 40) return;
      const x = note.lane * laneW + laneW / 2;
      const r = Math.min(laneW, 90) / 2 - 8;
      ctx.beginPath();
      roundRect(ctx, x - r, y - 12, r * 2, 24, 12);
      ctx.fillStyle = faded ? hexA(LANE_COLORS[note.lane], 0.35) : LANE_COLORS[note.lane];
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    if (isEdit) {
      for (const n of this.chart.notes) drawNote(n, true);
      for (const n of this.recorded) drawNote(n, false);
    } else {
      for (const n of this.notes) {
        if (n.state === "hit") continue;
        drawNote(n, n.state === "missed");
      }
    }

    this.popups = this.popups.filter((p) => t - p.born < 0.6);
    for (const p of this.popups) {
      const age = t - p.born;
      const cx = p.lane * laneW + laneW / 2;
      ctx.globalAlpha = Math.max(0, 1 - age / 0.6);
      ctx.fillStyle = p.color;
      ctx.font = "800 22px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.text, cx, strikeY - 60 - age * 40);
      ctx.globalAlpha = 1;
    }
  }
}
