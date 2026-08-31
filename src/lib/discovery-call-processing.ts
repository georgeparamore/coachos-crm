import { createServiceClient } from "@/lib/supabase/service";
import { logServerError } from "@/lib/log-server-error";
import { downloadZoomRecording, getFreshZoomRecording, getZoomAccessToken } from "@/lib/zoom/client";
import type { DiscoveryProjectBrief } from "@/lib/discovery-calls";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const projectBriefSchema = {
  type: "object",
  additionalProperties: false,
  required: ["executive_summary", "what_to_build", "project_type", "vision", "target_audience", "core_features", "must_haves", "nice_to_haves", "design_direction", "references", "integrations", "content_needs", "budget", "timeline", "risks", "open_questions", "next_steps", "confidence_notes"],
  properties: {
    executive_summary: { type: "string" },
    what_to_build: { type: "string" },
    project_type: { type: "string" },
    vision: { type: "string" },
    target_audience: { type: "string" },
    core_features: { type: "array", items: { type: "string" } },
    must_haves: { type: "array", items: { type: "string" } },
    nice_to_haves: { type: "array", items: { type: "string" } },
    design_direction: { type: "array", items: { type: "string" } },
    references: { type: "array", items: { type: "string" } },
    integrations: { type: "array", items: { type: "string" } },
    content_needs: { type: "array", items: { type: "string" } },
    budget: { type: "string" },
    timeline: { type: "string" },
    risks: { type: "array", items: { type: "string" } },
    open_questions: { type: "array", items: { type: "string" } },
    next_steps: { type: "array", items: { type: "string" } },
    confidence_notes: { type: "string" },
  },
} as const;

async function transcribeRecording(response: Response, fileType: string | null) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_AUDIO_BYTES) throw new Error("Recording audio is larger than 25 MB. Shorten the recording or enable a smaller Zoom audio-only file.");

  const audio = await response.blob();
  if (audio.size > MAX_AUDIO_BYTES) throw new Error("Recording audio is larger than 25 MB. Shorten the recording or enable a smaller Zoom audio-only file.");
  const extension = (fileType || "m4a").toLowerCase();
  const form = new FormData();
  form.set("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-transcribe");
  form.set("file", audio, `discovery-call.${extension}`);
  form.set("prompt", "This is a website, app, or software discovery call. Preserve product names, URLs, budgets, timelines, feature requests, and design terminology accurately.");

  const result = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const body = await result.json() as { text?: string; error?: { message?: string } };
  if (!result.ok || !body.text) throw new Error(body.error?.message || "OpenAI could not transcribe the recording");
  return body.text;
}

function responseOutputText(body: { output_text?: string; output?: { content?: { type?: string; text?: string }[] }[] }) {
  if (body.output_text) return body.output_text;
  return body.output?.flatMap((item) => item.content ?? []).find((content) => content.type === "output_text")?.text;
}

async function createProjectBrief(transcript: string): Promise<DiscoveryProjectBrief> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const result = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_SUMMARY_MODEL || "gpt-4o-mini",
      store: false,
      instructions: "You are a senior product strategist turning a client discovery call into an implementation-ready brief for George, who builds websites, apps, and software. Use only facts supported by the transcript. Clearly distinguish explicit requirements from inferred suggestions. Use 'Not discussed' for missing budget or timeline. Make what_to_build concrete enough to guide design and development. Open questions must identify information George still needs before accurately scoping the build.",
      input: `DISCOVERY CALL TRANSCRIPT\n\n${transcript.slice(0, 110_000)}`,
      text: { format: { type: "json_schema", name: "discovery_project_brief", strict: true, schema: projectBriefSchema } },
    }),
  });
  const body = await result.json() as { output_text?: string; output?: { content?: { type?: string; text?: string }[] }[]; error?: { message?: string } };
  const output = responseOutputText(body);
  if (!result.ok || !output) throw new Error(body.error?.message || "OpenAI could not create the project brief");
  return JSON.parse(output) as DiscoveryProjectBrief;
}

export async function processDiscoveryCall(callId: string, webhookDownloadToken?: string | null) {
  const service = createServiceClient();
  const { data: call } = await service.from("discovery_calls").select("*").eq("id", callId).maybeSingle();
  if (!call || call.status === "completed") return;

  const attempts = (call.processing_attempts ?? 0) + 1;
  await service.from("discovery_calls").update({ status: "processing", processing_attempts: attempts, last_error: null }).eq("id", callId);
  try {
    if (!call.recording_download_url) throw new Error("Zoom did not include a downloadable recording file");
    const zoomToken = await getZoomAccessToken();
    let recording: Response;
    let fileType = call.recording_file_type;
    try {
      recording = await downloadZoomRecording(call.recording_download_url, webhookDownloadToken || zoomToken);
    } catch {
      const fresh = await getFreshZoomRecording(call.zoom_meeting_uuid, call.recording_file_id, zoomToken);
      recording = await downloadZoomRecording(fresh.downloadUrl, fresh.downloadToken);
      fileType = fresh.fileType || fileType;
    }
    const transcript = await transcribeRecording(recording, fileType);
    const projectBrief = await createProjectBrief(transcript);
    const { error } = await service.from("discovery_calls").update({ status: "completed", transcript, project_brief: projectBrief, processed_at: new Date().toISOString(), last_error: null }).eq("id", callId);
    if (error) throw error;
    if (call.lead_id) {
      await service.from("lead_activities").insert({ coach_id: call.coach_id, lead_id: call.lead_id, activity_type: "consultation", note: "Discovery call transcribed and project brief created", metadata: { discovery_call_id: callId } });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discovery-call processing failed";
    await service.from("discovery_calls").update({ status: "failed", last_error: message.slice(0, 1000) }).eq("id", callId);
    await logServerError({ message }, `zoom.discovery-call.process:${callId}`);
  }
}
