// Automatic beat / onset detection → a playable chart.
//
// The DSP core (`detectNotesFromPCM`) works on a plain mono Float32Array so it
// can be unit-tested in Node without the Web Audio API. `decodeFile` and
// `analyzeFile` are the browser-only wrappers that decode an audio File and
// run the core.

import { LANE_COUNT, Note } from "./types";

export type DetectOptions = {
  // 1 (sparse, only strong beats) … 10 (dense). Maps to the peak threshold.
  sensitivity: number;
  // Minimum seconds between two notes overall (refractory period).
  minGap: number;
};

export const DEFAULT_DETECT: DetectOptions = { sensitivity: 5, minGap: 0.11 };

const HOP = 512; // ~11.6 ms at 44.1 kHz
const WIN = 1024;
// The energy envelope peaks slightly before the transient's perceived hit;
// nudge detected times forward to center them on the beat.
const ONSET_LAG = 0.012;

// Downmix an AudioBuffer-like object to a single mono channel.
export function toMono(channels: Float32Array[], length: number): Float32Array {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(length);
  for (const ch of channels) {
    for (let i = 0; i < length; i++) out[i] += ch[i];
  }
  const inv = 1 / channels.length;
  for (let i = 0; i < length; i++) out[i] *= inv;
  return out;
}

// Core detector. Returns notes sorted by time.
export function detectNotesFromPCM(mono: Float32Array, sampleRate: number, opts: DetectOptions): Note[] {
  const n = mono.length;
  if (n < WIN * 2) return [];

  const frames = Math.floor((n - WIN) / HOP);
  const energy = new Float32Array(frames); // broadband loudness
  const bright = new Float32Array(frames); // high-frequency ratio → note "color"

  for (let f = 0; f < frames; f++) {
    const start = f * HOP;
    let sumSq = 0;
    let diffSq = 0;
    let prev = mono[start];
    for (let i = 1; i < WIN; i++) {
      const x = mono[start + i];
      sumSq += x * x;
      const d = x - prev; // first difference ≈ crude high-pass
      diffSq += d * d;
      prev = x;
    }
    const e = Math.sqrt(sumSq / WIN);
    energy[f] = e;
    bright[f] = e > 1e-6 ? Math.sqrt(diffSq / WIN) / e : 0;
  }

  // Spectral-flux-style onset envelope: positive energy increases only.
  const flux = new Float32Array(frames);
  for (let f = 1; f < frames; f++) {
    const d = energy[f] - energy[f - 1];
    flux[f] = d > 0 ? d : 0;
  }

  // Adaptive threshold: local mean + k·std over a moving window.
  const winFrames = Math.max(4, Math.round((0.35 * sampleRate) / HOP));
  const s = Math.min(10, Math.max(1, opts.sensitivity));
  const k = 2.1 - (s - 1) * (1.7 / 9); // s=1 → 2.1 (sparse), s=10 → 0.4 (dense)
  const minGapFrames = Math.max(1, Math.round((opts.minGap * sampleRate) / HOP));

  const onsets: { frame: number; bright: number }[] = [];
  let lastOnset = -Infinity;

  for (let f = 1; f < frames - 1; f++) {
    const lo = Math.max(0, f - winFrames);
    const hi = Math.min(frames, f + winFrames);
    let mean = 0;
    for (let i = lo; i < hi; i++) mean += flux[i];
    mean /= hi - lo;
    let varSum = 0;
    for (let i = lo; i < hi; i++) {
      const dv = flux[i] - mean;
      varSum += dv * dv;
    }
    const std = Math.sqrt(varSum / (hi - lo));
    const threshold = mean + k * std;

    const isPeak = flux[f] > flux[f - 1] && flux[f] >= flux[f + 1];
    if (isPeak && flux[f] > threshold && flux[f] > 1e-4 && f - lastOnset >= minGapFrames) {
      onsets.push({ frame: f, bright: bright[f] });
      lastOnset = f;
    }
  }

  if (onsets.length === 0) return [];

  // Map "brightness" to lanes via quantiles so lanes are used evenly:
  // dark/bass onsets → lane 0, bright/treble → lane LANE_COUNT-1.
  const sortedBright = onsets.map((o) => o.bright).sort((a, b) => a - b);
  const quantile = (q: number) => sortedBright[Math.min(sortedBright.length - 1, Math.floor(q * sortedBright.length))];
  const cuts: number[] = [];
  for (let i = 1; i < LANE_COUNT; i++) cuts.push(quantile(i / LANE_COUNT));

  const notes: Note[] = [];
  let prevLane = -1;
  for (const o of onsets) {
    let lane = 0;
    while (lane < cuts.length && o.bright > cuts[lane]) lane++;
    // Nudge off an immediate repeat so runs feel more playable.
    if (lane === prevLane) lane = (lane + 1) % LANE_COUNT;
    prevLane = lane;
    notes.push({ time: (o.frame * HOP) / sampleRate + ONSET_LAG, lane });
  }
  return notes;
}

// Browser: decode an audio File into an AudioBuffer.
export async function decodeFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const Ctx: typeof AudioContext =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    return await ctx.decodeAudioData(arrayBuffer);
  } finally {
    ctx.close();
  }
}

// Browser: decode + detect. Returns notes plus the detected duration.
export async function analyzeFile(
  file: File,
  opts: DetectOptions,
): Promise<{ notes: Note[]; duration: number }> {
  const buffer = await decodeFile(file);
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
  const mono = toMono(channels, buffer.length);
  const notes = detectNotesFromPCM(mono, buffer.sampleRate, opts);
  return { notes, duration: buffer.duration };
}
