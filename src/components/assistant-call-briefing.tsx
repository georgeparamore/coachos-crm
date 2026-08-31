"use client";

import { useEffect, useState } from "react";
import type { DiscoveryProjectBrief } from "@/lib/discovery-calls";

const FEMALE_VOICE_HINTS = /female|libby|martha|serena|sonia|susan|hazel|kate/i;

function chooseVoice(voices: SpeechSynthesisVoice[]) {
  return voices.find((voice) => voice.lang.toLowerCase().startsWith("en-gb") && FEMALE_VOICE_HINTS.test(voice.name))
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("en-gb"))
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("en") && FEMALE_VOICE_HINTS.test(voice.name))
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("en"))
    ?? null;
}

function numberedSection(label: string, items: string[]) {
  if (!items.length) return "";
  return `${label}. ${items.slice(0, 5).map((item, index) => `${index + 1}, ${item}`).join(". ")}.`;
}

function makeAssistantBriefing(topic: string, brief: DiscoveryProjectBrief) {
  return [
    `Here is your Assistant briefing for ${topic}.`,
    `What to build. ${brief.what_to_build}`,
    `Summary. ${brief.executive_summary}`,
    numberedSection("The must-haves are", brief.must_haves),
    numberedSection("Questions still to answer", brief.open_questions),
    numberedSection("Recommended next steps", brief.next_steps),
    "That is the end of your briefing.",
  ].filter(Boolean).join(" ");
}

export function AssistantCallBriefing({ topic, brief }: { topic: string; brief: DiscoveryProjectBrief }) {
  const [speaking, setSpeaking] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  function toggleBriefing() {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setUnavailable(true);
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(makeAssistantBriefing(topic, brief));
    utterance.lang = "en-GB";
    utterance.rate = 0.94;
    utterance.pitch = 0.98;
    utterance.voice = chooseVoice(window.speechSynthesis.getVoices());
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  return <div className="assistant-call-briefing">
    <button
      aria-label={speaking ? "Stop Assistant briefing" : "Hear Assistant briefing"}
      aria-pressed={speaking}
      className={`voice-briefing-button${speaking ? " is-speaking" : ""}`}
      onClick={toggleBriefing}
      title="Reads the call summary, not the full transcript"
      type="button"
    >
      <span className="voice-briefing-icon" aria-hidden="true">
        {speaking ? <span className="voice-briefing-bars"><i /><i /><i /></span> : <svg viewBox="0 0 24 24"><path d="M11 5 6.7 8.5H3v7h3.7L11 19V5Z" /><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" /></svg>}
      </span>
      <span>{speaking ? "Stop Assistant" : "Hear Assistant briefing"}</span>
    </button>
    <small>{unavailable ? "Voice unavailable in this browser" : "Summary · requirements · next steps"}</small>
  </div>;
}
