"use client";

import { useState } from "react";

type TranscriptTurn = { start: number; end: number; speaker: string; text: string };

function formatTimestamp(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function speakerName(speaker: string, order: string[]) {
  const index = order.indexOf(speaker);
  return `Speaker ${index + 1}`;
}

function parseTranscript(transcript: string): TranscriptTurn[] {
  return transcript.split("\n").flatMap((line) => {
    const match = line.match(/^\[\[(\d+(?:\.\d+)?)\|(\d+(?:\.\d+)?)\|([^\]]+)\]\]\s*(.*)$/);
    if (!match || !match[4].trim()) return [];
    return [{ start: Number(match[1]), end: Number(match[2]), speaker: match[3], text: match[4] }];
  });
}

export function DiscoveryTranscript({ transcript }: { transcript: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const validSegments = parseTranscript(transcript);
  const speakers = [...new Set(validSegments.map((segment) => segment.speaker))];
  const copyText = validSegments.length
    ? validSegments.map((segment) => `${formatTimestamp(segment.start)} — ${speakerName(segment.speaker, speakers)}\n${segment.text.trim()}`).join("\n\n")
    : transcript;

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("failed");
    }
  }

  return <details className="card transcript-card">
    <summary><span>Full transcript</span><span className="transcript-summary-meta">{validSegments.length ? `${speakers.length} speakers · ${validSegments.length} turns` : "Plain text"}</span></summary>
    <button className="transcript-copy" onClick={copyAll} type="button">{copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy all"}</button>
    {validSegments.length ? <div className="transcript-turns">
      {validSegments.map((segment, index) => {
        const speakerIndex = speakers.indexOf(segment.speaker);
        return <article className="transcript-turn" data-speaker={speakerIndex % 4} key={`${segment.start}-${index}`}>
          <div className="transcript-turn-meta">
            <span className="transcript-speaker"><span className="transcript-speaker-dot" />{speakerName(segment.speaker, speakers)}</span>
            <time>{formatTimestamp(segment.start)}</time>
          </div>
          <p>{segment.text.trim()}</p>
        </article>;
      })}
    </div> : <div className="transcript-legacy"><p>{transcript}</p><p className="sub">This call was processed before speaker detection was added. Use “Reprocess transcript” to add speaker labels and timestamps.</p></div>}
  </details>;
}
