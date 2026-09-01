"use client";

import { AssistantSpeechControl } from "@/components/assistant-speech-control";
import type { DiscoveryProjectBrief } from "@/lib/discovery-calls";

function numberedSection(label: string, items: string[]) {
  if (!items.length) return "";
  return `${label}. ${items.slice(0, 5).map((item, index) => `${index + 1}, ${item}`).join(". ")}.`;
}

function makeAssistantBriefing(topic: string, brief: DiscoveryProjectBrief) {
  return [`Here is your Assistant briefing for ${topic}.`, `What to build. ${brief.what_to_build}`, `Summary. ${brief.executive_summary}`, numberedSection("The must-haves are", brief.must_haves), numberedSection("Questions still to answer", brief.open_questions), numberedSection("Recommended next steps", brief.next_steps), "That is the end of your briefing."].filter(Boolean).join(" ");
}

export function AssistantCallBriefing({ topic, brief }: { topic: string; brief: DiscoveryProjectBrief }) {
  return <div className="assistant-call-briefing"><AssistantSpeechControl detail="summary · requirements · next steps" idleLabel="Hear Assistant briefing" speakingLabel="Stop Assistant" text={makeAssistantBriefing(topic, brief)} /></div>;
}
