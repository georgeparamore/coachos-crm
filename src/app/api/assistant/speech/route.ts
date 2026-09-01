import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const voiceStyles = {
  ama: {
    voice: "marin",
    instructions: "Speak as a warm, confident African-British woman. Use a natural contemporary British cadence with subtle West African warmth. Sound polished, encouraging, and conversational, never theatrical.",
  },
  nia: {
    voice: "coral",
    instructions: "Speak as a calm, thoughtful British woman with a soft, reassuring delivery. Sound like a capable personal assistant: clear, composed, and personable.",
  },
  clara: {
    voice: "shimmer",
    instructions: "Speak as an upbeat contemporary British woman. Keep the delivery bright, crisp, friendly, and professional without sounding overly energetic.",
  },
} as const;

type VoiceStyle = keyof typeof voiceStyles;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 4096) : "";
  const style: VoiceStyle = body?.style in voiceStyles ? body.style : "ama";
  const speed = [0.9, 1, 1.1].includes(body?.speed) ? body.speed : 1;
  if (!text) return Response.json({ error: "Nothing to read" }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: "Assistant voice is not configured" }, { status: 503 });

  const profile = voiceStyles[style];
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      input: text,
      voice: profile.voice,
      instructions: profile.instructions,
      response_format: "mp3",
      speed,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    return Response.json({ error: error?.error?.message || "Assistant could not create the voice briefing" }, { status: 502 });
  }

  return new Response(response.body, {
    headers: { "Cache-Control": "private, no-store", "Content-Type": "audio/mpeg" },
  });
}
