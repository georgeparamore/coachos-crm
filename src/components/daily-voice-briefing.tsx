"use client";

import { useEffect, useState } from "react";

type BriefingItem = {
  title: string;
  detail: string;
};

type DailyVoiceBriefingProps = {
  firstName: string;
  formattedDate: string;
  appointments: BriefingItem[];
  priorities: BriefingItem[];
};

const FEMALE_VOICE_HINTS = /female|libby|martha|serena|sonia|susan|hazel|kate/i;

function chooseVoice(voices: SpeechSynthesisVoice[]) {
  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en-gb") && FEMALE_VOICE_HINTS.test(voice.name)) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en-gb")) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en") && FEMALE_VOICE_HINTS.test(voice.name)) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ??
    null
  );
}

function makeBriefing({ firstName, formattedDate, appointments, priorities }: DailyVoiceBriefingProps) {
  const parts = [`Good morning, ${firstName}. Here is your Full Circle briefing for ${formattedDate}.`];

  if (appointments.length === 0) {
    parts.push("You have no appointments on the calendar today.");
  } else {
    parts.push(`You have ${appointments.length} ${appointments.length === 1 ? "appointment" : "appointments"} on today's schedule.`);
    appointments.forEach((appointment, index) => {
      parts.push(`${index === 0 ? "First" : "Then"}, ${appointment.title}, at ${appointment.detail}.`);
    });
  }

  if (priorities.length === 0) {
    parts.push("Your priority queue is clear, so you are all caught up.");
  } else {
    parts.push(`You have ${priorities.length} ${priorities.length === 1 ? "priority" : "priorities"} to focus on.`);
    priorities.forEach((priority, index) => {
      parts.push(`Priority ${index + 1}: ${priority.title}. ${priority.detail}.`);
    });
  }

  parts.push("Take it one step at a time. You've got this.");
  return parts.join(" ");
}

export function DailyVoiceBriefing(props: DailyVoiceBriefingProps) {
  const [speaking, setSpeaking] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
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

    const utterance = new SpeechSynthesisUtterance(makeBriefing(props));
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

  return (
    <div className="voice-briefing">
      <button
        aria-label={speaking ? "Stop today's spoken briefing" : "Hear today's spoken briefing"}
        aria-pressed={speaking}
        className={`voice-briefing-button${speaking ? " is-speaking" : ""}`}
        onClick={toggleBriefing}
        title="Uses the best available British female voice on this device"
        type="button"
      >
        <span className="voice-briefing-icon" aria-hidden="true">
          {speaking ? (
            <span className="voice-briefing-bars"><i /><i /><i /></span>
          ) : (
            <svg viewBox="0 0 24 24"><path d="M11 5 6.7 8.5H3v7h3.7L11 19V5Z" /><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" /></svg>
          )}
        </span>
        <span>{speaking ? "Stop briefing" : "Hear today’s briefing"}</span>
      </button>
      <small>{unavailable ? "Voice unavailable in this browser" : "British voice · schedule + priorities"}</small>
    </div>
  );
}
