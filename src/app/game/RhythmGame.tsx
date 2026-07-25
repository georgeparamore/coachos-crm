"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine, Hud, Results } from "./engine";
import { DEFAULT_DETECT } from "./detect";
import { SUPER_NOVA_AUDIO_URL, SUPER_NOVA_CHART } from "./super-nova-chart";
import { Chart, parseChart } from "./types";

type Mode = "menu" | "play" | "edit";

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RhythmGame() {
  const [mode, setMode] = useState<Mode>("menu");
  const [chart, setChart] = useState<Chart>(SUPER_NOVA_CHART);
  const [audioName, setAudioName] = useState(SUPER_NOVA_CHART.audioName);
  const [hasAudio, setHasAudio] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [status, setStatus] = useState("");
  const [hud, setHud] = useState<Hud>({ score: 0, combo: 0, accuracy: 100, recorded: 0, health: 0.7 });
  const [sensitivity, setSensitivity] = useState(DEFAULT_DETECT.sensitivity);
  const [analyzing, setAnalyzing] = useState(false);

  const engineRef = useRef<GameEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modeRef = useRef<Mode>("menu");
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Create the engine once, on mount.
  useEffect(() => {
    const engine = new GameEngine({
      onHud: setHud,
      onFinish: (r) => {
        setResults(r);
        setPlaying(false);
        setMode("menu");
      },
      onEnded: () => setPlaying(false),
      onStatus: setStatus,
    });
    engineRef.current = engine;
    // Pre-load the baked-in Super Nova track so it's ready to launch.
    engine.loadAudioUrl(SUPER_NOVA_AUDIO_URL);
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Keyboard input → engine.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      if (!eng || modeRef.current === "menu") return;
      const handled = eng.keyDown(e.key, e.repeat);
      if (handled) {
        e.preventDefault();
        setPlaying(!eng.isPaused);
      }
    };
    const onUp = (e: KeyboardEvent) => engineRef.current?.keyUp(e.key);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  const onCanvasReady = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
    engineRef.current?.attachCanvas(el);
  }, []);

  const onPointer = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    engineRef.current?.pointerAt(e.clientX, rect.left, rect.width);
  }, []);

  // --- file loading ---
  const loadAudio = useCallback((file: File) => {
    const name = engineRef.current?.loadAudio(file) ?? file.name;
    setAudioName(name);
    setHasAudio(true);
    setChart((c) => ({
      ...c,
      audioName: name,
      title: c.title === "Untitled" ? name.replace(/\.[^.]+$/, "") : c.title,
    }));
    setStatus(`Loaded audio: ${name}`);
  }, []);

  const autoChart = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng) return;
    if (!hasAudio) {
      setStatus("Load your song first, then let me detect the beats.");
      return;
    }
    setAnalyzing(true);
    setStatus("Listening to the track and working out the beats…");
    try {
      const notes = await eng.analyze({ sensitivity, minGap: DEFAULT_DETECT.minGap });
      setChart((c) => ({ ...c, notes, audioName }));
      setStatus(
        notes.length
          ? `Detected ${notes.length} beats. Play it, or open the editor to fine-tune.`
          : "Couldn't find clear beats — try nudging sensitivity up.",
      );
    } catch (err) {
      setStatus(`Beat detection failed: ${(err as Error).message}`);
    } finally {
      setAnalyzing(false);
    }
  }, [hasAudio, sensitivity, audioName]);

  const loadChartFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseChart(JSON.parse(String(reader.result)));
        setChart(parsed);
        setStatus(`Loaded chart "${parsed.title}" — ${parsed.notes.length} notes`);
      } catch (err) {
        setStatus(`Could not read chart: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
  }, []);

  // --- transport ---
  const startPlay = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    if (!hasAudio) return setStatus("Load your song first.");
    if (chart.notes.length === 0) return setStatus("This chart has no notes yet — chart it first.");
    setResults(null);
    setMode("play");
    setPlaying(true);
    eng.startPlay(chart);
  }, [chart, hasAudio]);

  const startEdit = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    if (!hasAudio) return setStatus("Load your song first, then tap notes in time.");
    setMode("edit");
    setPlaying(false);
    eng.startEdit(chart);
    setStatus("Press Space to play, then tap D F J K in time. Backspace undoes the last note.");
  }, [chart, hasAudio]);

  const quitPlay = useCallback(() => {
    engineRef.current?.stop();
    setPlaying(false);
    setMode("menu");
  }, []);

  const togglePlay = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.togglePlay();
    setPlaying(!eng.isPaused);
  }, []);

  const saveTake = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const recorded = eng.getRecorded();
    setChart((c) => {
      const merged = [...c.notes, ...recorded].sort((a, b) => a.time - b.time);
      return { ...c, notes: merged, audioName };
    });
    eng.clearRecorded();
    setStatus(`Saved ${recorded.length} notes into the chart.`);
  }, [audioName]);

  const clearTake = useCallback(() => {
    engineRef.current?.clearRecorded();
    setStatus("Cleared this take.");
  }, []);

  const exitEdit = useCallback(() => {
    engineRef.current?.stop();
    setPlaying(false);
    setMode("menu");
  }, []);

  const exportChart = useCallback(() => {
    const safe = (chart.title || "chart").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    download(`${safe}.chart.json`, JSON.stringify(chart, null, 2));
  }, [chart]);

  if (mode === "menu") {
    return (
      <div style={S.root}>
        <Menu
          chart={chart}
          setChart={setChart}
          audioName={audioName}
          hasAudio={hasAudio}
          onAudio={loadAudio}
          onChartFile={loadChartFile}
          onPlay={startPlay}
          onEdit={startEdit}
          onExport={exportChart}
          onAutoChart={autoChart}
          analyzing={analyzing}
          sensitivity={sensitivity}
          setSensitivity={setSensitivity}
          results={results}
          status={status}
        />
      </div>
    );
  }

  return (
    <div style={S.root}>
      <div style={S.stage}>
        <div style={S.hudRow}>
          <div style={S.hudLeft}>
            <button style={S.ghostBtn} onClick={mode === "play" ? quitPlay : exitEdit}>
              ← {mode === "play" ? "Quit" : "Done"}
            </button>
            <button style={S.ghostBtn} onClick={togglePlay}>
              {playing ? "⏸ Pause" : "▶ Play"} <span style={S.kbd}>Space</span>
            </button>
          </div>
          {mode === "play" ? (
            <div style={S.hudStats}>
              <RockMeter health={hud.health} />
              <Stat label="Score" value={hud.score.toLocaleString()} />
              <Stat label="Combo" value={`${hud.combo}x`} />
              <Stat label="Accuracy" value={`${hud.accuracy}%`} />
            </div>
          ) : (
            <div style={S.hudStats}>
              <Stat label="Recording" value={`${hud.recorded} notes`} />
              <span style={S.editHint}>Tap D F J K in time · Backspace undo</span>
            </div>
          )}
        </div>

        <canvas ref={onCanvasReady} style={S.canvas} onPointerDown={onPointer} />

        {mode === "edit" && (
          <div style={S.editBar}>
            <button style={S.primaryBtn} onClick={saveTake}>Save take → chart</button>
            <button style={S.ghostBtn} onClick={clearTake}>Clear take</button>
            <button style={S.ghostBtn} onClick={exportChart}>Export chart .json</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Menu(props: {
  chart: Chart;
  setChart: (updater: (c: Chart) => Chart) => void;
  audioName: string;
  hasAudio: boolean;
  onAudio: (f: File) => void;
  onChartFile: (f: File) => void;
  onPlay: () => void;
  onEdit: () => void;
  onExport: () => void;
  onAutoChart: () => void;
  analyzing: boolean;
  sensitivity: number;
  setSensitivity: (n: number) => void;
  results: Results | null;
  status: string;
}) {
  const { chart, setChart, hasAudio, audioName, results, status } = props;

  return (
    <div style={S.menu}>
      <div style={S.hero}>
        <h1 style={S.title}>✦ SUPER NOVA</h1>
        <p style={S.sub}>
          Feed a dying star to make it go supernova. Glowing stars stream down four lanes —
          hit <b>D F J K</b> (or tap) on the beat to keep the star alive. Miss, and it
          collapses and the track breaks up. Survive to the end for the blast.
        </p>
      </div>

      {results && (
        <div style={S.results}>
          <div style={S.resultsTitle}>Last run</div>
          <div style={S.resultGrid}>
            <Stat label="Score" value={results.score.toLocaleString()} />
            <Stat label="Accuracy" value={`${results.accuracy}%`} />
            <Stat label="Max combo" value={`${results.maxCombo}x`} />
            <Stat label="Perfect" value={String(results.counts.perfect)} />
            <Stat label="Great" value={String(results.counts.great)} />
            <Stat label="Good" value={String(results.counts.good)} />
            <Stat label="Miss" value={String(results.counts.miss)} />
          </div>
        </div>
      )}

      <div style={S.cards}>
        <div style={S.card}>
          <div style={S.cardNum}>1</div>
          <h3 style={S.cardH}>Song loaded</h3>
          <p style={S.cardP}>
            <b>Super Nova</b> is built in and ready to play. Want to try a different track?
            Load any audio file — it stays on your device.
          </p>
          <label style={S.fileBtn}>
            {`♪ ${audioName}`}
            <input
              type="file"
              accept="audio/*"
              style={{ display: "none" }}
              onChange={(e) => e.target.files?.[0] && props.onAudio(e.target.files[0])}
            />
          </label>
        </div>

        <div style={S.card}>
          <div style={S.cardNum}>2</div>
          <h3 style={S.cardH}>Chart the notes</h3>
          <p style={S.cardP}>
            Super Nova comes with a choreographed chart — sparse verses, dense drops.
            Re-detect for a different feel, or open the editor to fine-tune.
          </p>
          <div style={S.cardBtns}>
            <button style={S.primaryBtn} onClick={props.onAutoChart} disabled={!hasAudio || props.analyzing}>
              {props.analyzing ? "Analyzing…" : "✨ Auto-detect beats"}
            </button>
            <label style={{ ...S.fieldLabel, marginTop: 4 }}>
              Density — {props.sensitivity <= 3 ? "sparse" : props.sensitivity >= 8 ? "busy" : "medium"}
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={props.sensitivity}
                onChange={(e) => props.setSensitivity(Number(e.target.value))}
                style={{ width: "100%", marginTop: 4 }}
              />
            </label>
            <button style={S.linkBtn} onClick={props.onEdit} disabled={!hasAudio}>
              Open chart editor
            </button>
            <label style={S.linkBtn}>
              Import chart .json
              <input
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && props.onChartFile(e.target.files[0])}
              />
            </label>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.cardNum}>3</div>
          <h3 style={S.cardH}>Ignite the star</h3>
          <p style={S.cardP}>
            {chart.notes.length > 0
              ? `"${chart.title}" — ${chart.notes.length} stars to hit. Take it to the supernova.`
              : "Chart is empty — detect or record some notes in step 2 first."}
          </p>
          <button
            style={S.bigPlay}
            onClick={props.onPlay}
            disabled={!hasAudio || chart.notes.length === 0}
          >
            ✦ Launch
          </button>
        </div>
      </div>

      <div style={S.settings}>
        <label style={S.field}>
          <span style={S.fieldLabel}>Song title</span>
          <input
            style={S.input}
            value={chart.title}
            onChange={(e) => setChart((c) => ({ ...c, title: e.target.value }))}
          />
        </label>
        <label style={S.field}>
          <span style={S.fieldLabel}>Artist</span>
          <input
            style={S.input}
            value={chart.artist}
            onChange={(e) => setChart((c) => ({ ...c, artist: e.target.value }))}
          />
        </label>
        <label style={S.field}>
          <span style={S.fieldLabel}>Note speed — {chart.approachSeconds.toFixed(1)}s fall</span>
          <input
            type="range"
            min={0.8}
            max={3}
            step={0.1}
            value={chart.approachSeconds}
            onChange={(e) => setChart((c) => ({ ...c, approachSeconds: Number(e.target.value) }))}
          />
        </label>
        <button style={S.linkBtn} onClick={props.onExport}>Export chart .json</button>
      </div>

      {status && <div style={S.status}>{status}</div>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={S.stat}>
      <div style={S.statValue}>{value}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}

function RockMeter({ health }: { health: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, health)) * 100);
  const color = health > 0.55 ? "#3f9142" : health > 0.28 ? "#ef9f27" : "#e24b4a";
  return (
    <div style={S.meterWrap} title="Miss the beats and the star collapses">
      <div style={S.meterTrack}>
        <div style={{ ...S.meterFill, width: `${pct}%`, background: color }} />
      </div>
      <div style={S.statLabel}>Star energy</div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100dvh",
    background: "linear-gradient(160deg,#111119,#0b0b10)",
    color: "#e8e6de",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  },
  menu: { maxWidth: 900, margin: "0 auto", padding: "48px 20px 80px" },
  hero: { textAlign: "center", marginBottom: 28 },
  title: { fontSize: 40, fontWeight: 800, margin: "0 0 8px", letterSpacing: -0.5 },
  sub: { color: "#a9a7a0", fontSize: 16, maxWidth: 560, margin: "0 auto", lineHeight: 1.5 },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16, marginBottom: 24 },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20, position: "relative" },
  cardNum: { position: "absolute", top: -12, left: 16, width: 26, height: 26, borderRadius: "50%", background: "#7f77dd", color: "#fff", fontWeight: 800, display: "grid", placeItems: "center", fontSize: 14 },
  cardH: { margin: "6px 0 6px", fontSize: 17 },
  cardP: { margin: "0 0 16px", color: "#a9a7a0", fontSize: 14, lineHeight: 1.5, minHeight: 60 },
  cardBtns: { display: "flex", flexDirection: "column", gap: 8 },
  fileBtn: { display: "block", textAlign: "center", padding: "11px 14px", borderRadius: 10, background: "rgba(127,119,221,0.18)", border: "1px solid rgba(127,119,221,0.5)", color: "#cecbf6", cursor: "pointer", fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  primaryBtn: { padding: "11px 14px", borderRadius: 10, background: "#7f77dd", border: "none", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14 },
  bigPlay: { width: "100%", padding: "14px", borderRadius: 12, background: "linear-gradient(135deg,#7f77dd,#5850c8)", border: "none", color: "#fff", cursor: "pointer", fontWeight: 800, fontSize: 18 },
  linkBtn: { display: "inline-block", textAlign: "center", padding: "10px 12px", borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.14)", color: "#cfcdd8", cursor: "pointer", fontWeight: 600, fontSize: 13 },
  ghostBtn: { padding: "8px 12px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#e8e6de", cursor: "pointer", fontWeight: 600, fontSize: 14 },
  settings: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, alignItems: "end", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 18 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 12, color: "#a9a7a0", fontWeight: 600 },
  input: { padding: "9px 11px", borderRadius: 9, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.14)", color: "#e8e6de", fontSize: 14 },
  status: { marginTop: 18, padding: "10px 14px", borderRadius: 10, background: "rgba(127,119,221,0.12)", border: "1px solid rgba(127,119,221,0.3)", color: "#cecbf6", fontSize: 13, textAlign: "center" },
  results: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 18, marginBottom: 24 },
  resultsTitle: { fontSize: 13, color: "#a9a7a0", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  resultGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 12 },
  stat: { textAlign: "center" },
  statValue: { fontSize: 22, fontWeight: 800, lineHeight: 1.1 },
  statLabel: { fontSize: 11, color: "#a9a7a0", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 3 },
  stage: { display: "flex", flexDirection: "column", height: "100dvh" },
  hudRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", gap: 12, flexWrap: "wrap" },
  hudLeft: { display: "flex", gap: 8 },
  hudStats: { display: "flex", gap: 22, alignItems: "center" },
  editHint: { fontSize: 12, color: "#a9a7a0" },
  meterWrap: { minWidth: 120, textAlign: "center" },
  meterTrack: { height: 10, borderRadius: 6, background: "rgba(255,255,255,0.12)", overflow: "hidden", marginBottom: 3 },
  meterFill: { height: "100%", borderRadius: 6, transition: "width 0.12s linear, background 0.2s linear" },
  kbd: { fontSize: 11, padding: "1px 5px", borderRadius: 4, background: "rgba(255,255,255,0.12)", marginLeft: 4 },
  canvas: { flex: 1, width: "100%", touchAction: "none", display: "block" },
  editBar: { display: "flex", gap: 10, padding: "12px 16px", justifyContent: "center", flexWrap: "wrap" },
};
