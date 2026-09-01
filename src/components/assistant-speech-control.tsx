"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type VoiceStyle = "ama" | "nia" | "clara";
type Speed = 0.9 | 1 | 1.1;

const PREFERENCE_KEY = "full-circle-assistant-voice-v1";
const PREFERENCE_EVENT = "full-circle-assistant-voice-changed";
const voices: { id: VoiceStyle; name: string; detail: string }[] = [
  { id: "ama", name: "Ama", detail: "Warm African-British" },
  { id: "nia", name: "Nia", detail: "Calm British" },
  { id: "clara", name: "Clara", detail: "Bright British" },
];

export function AssistantSpeechControl({ text, idleLabel, speakingLabel, detail }: { text: string; idleLabel: string; speakingLabel: string; detail: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const preferenceJson = useSyncExternalStore(
    (onChange) => {
      window.addEventListener(PREFERENCE_EVENT, onChange);
      window.addEventListener("storage", onChange);
      return () => { window.removeEventListener(PREFERENCE_EVENT, onChange); window.removeEventListener("storage", onChange); };
    },
    () => localStorage.getItem(PREFERENCE_KEY) || "{}",
    () => "{}",
  );
  let preference: { style?: VoiceStyle; speed?: Speed } = {};
  try { preference = JSON.parse(preferenceJson); } catch { /* Keep defaults. */ }
  const style = preference.style && voices.some((voice) => voice.id === preference.style) ? preference.style : "ama";
  const speed = preference.speed && [0.9, 1, 1.1].includes(preference.speed) ? preference.speed : 1;

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function savePreference(nextStyle: VoiceStyle, nextSpeed: Speed) {
    localStorage.setItem(PREFERENCE_KEY, JSON.stringify({ style: nextStyle, speed: nextSpeed }));
    window.dispatchEvent(new Event(PREFERENCE_EVENT));
  }

  function stop() {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setSpeaking(false);
  }

  async function toggleBriefing() {
    if (speaking) return stop();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/assistant/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, style, speed }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Assistant voice is unavailable");
      }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(await response.blob());
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setSpeaking(false);
      audio.onerror = () => { setSpeaking(false); setError("Audio could not play in this browser"); };
      await audio.play();
      setSpeaking(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Assistant voice is unavailable");
    } finally {
      setLoading(false);
    }
  }

  return <div className="voice-briefing">
    <div className="voice-briefing-actions">
      <button
        aria-label={speaking ? speakingLabel : idleLabel}
        aria-pressed={speaking}
        className={`voice-briefing-button${speaking ? " is-speaking" : ""}`}
        disabled={loading}
        onClick={toggleBriefing}
        type="button"
      >
        <span className="voice-briefing-icon" aria-hidden="true">
          {speaking || loading ? <span className="voice-briefing-bars"><i /><i /><i /></span> : <svg viewBox="0 0 24 24"><path d="M11 5 6.7 8.5H3v7h3.7L11 19V5Z" /><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" /></svg>}
        </span>
        <span>{loading ? "Preparing voice…" : speaking ? speakingLabel : idleLabel}</span>
      </button>
      <details className="voice-options">
        <summary aria-label="Assistant voice options" title="Assistant voice options">•••</summary>
        <div className="voice-options-popover">
          <label><span>Voice</span><select value={style} onChange={(event) => savePreference(event.target.value as VoiceStyle, speed)}>{voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name} — {voice.detail}</option>)}</select></label>
          <label><span>Speed</span><select value={speed} onChange={(event) => savePreference(style, Number(event.target.value) as Speed)}><option value={0.9}>Relaxed</option><option value={1}>Natural</option><option value={1.1}>Brisk</option></select></label>
          <p>Voice preferences are saved on this device.</p>
        </div>
      </details>
    </div>
    <small className={error ? "voice-briefing-error" : ""}>{error || `${voices.find((voice) => voice.id === style)?.name} · AI voice · ${detail}`}</small>
  </div>;
}
