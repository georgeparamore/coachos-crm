import { createServiceClient } from "@/lib/supabase/service";
import { logServerError } from "@/lib/log-server-error";
import { downloadZoomRecording, getFreshZoomRecording, getZoomAccessToken } from "@/lib/zoom/client";
import type { DiscoveryProjectBrief } from "@/lib/discovery-calls";
import { discoveryCallSegmentCount } from "@/lib/discovery-call-workflow-utils";
import ffmpegPath from "ffmpeg-static";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

// GPT-4o transcription performs its own voice-activity chunking. Keep a generous
// ceiling here to protect function memory without applying Whisper's legacy
// 25 MiB upload limit to newer transcription models.
const MAX_RECORDING_BYTES = 200 * 1024 * 1024;
const DIRECT_TRANSCRIPTION_BYTES = 24 * 1024 * 1024;
// Diarization can take several minutes for long audio. Five-minute pieces keep
// each durable workflow step comfortably below Vercel's five-minute ceiling.
const SEGMENT_SECONDS = 5 * 60;
const execFileAsync = promisify(execFile);

function resolveFfmpegPath() {
  // ffmpeg-static exports an absolute path from the build machine. Vercel
  // preserves the binary under the function's runtime working directory.
  if (process.env.VERCEL) return join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg");
  return ffmpegPath;
}

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

type DiarizedTranscription = {
  text?: string;
  segments?: { id: string; speaker: string; start: number; end: number; text: string }[];
  error?: { message?: string };
};

type AudioChunk = { audio: Blob; extension: string; offsetSeconds: number };

async function prepareAudioChunks(audio: Blob, extension: string): Promise<{ chunks: AudioChunk[]; cleanup: () => Promise<void> }> {
  if (audio.size <= DIRECT_TRANSCRIPTION_BYTES) {
    return { chunks: [{ audio, extension, offsetSeconds: 0 }], cleanup: async () => undefined };
  }
  const executable = resolveFfmpegPath();
  if (!executable) throw new Error("Long-recording conversion is unavailable on this server");

  const workingDirectory = await mkdtemp(join(tmpdir(), "full-circle-call-"));
  const inputPath = join(workingDirectory, `recording.${extension}`);
  const outputPattern = join(workingDirectory, "section-%03d.mp3");
  try {
    await writeFile(inputPath, Buffer.from(await audio.arrayBuffer()));
    await execFileAsync(executable, [
      "-hide_banner", "-loglevel", "error", "-i", inputPath,
      "-vn", "-map", "0:a:0", "-ac", "1", "-ar", "16000", "-b:a", "48k",
      "-f", "segment", "-segment_time", String(SEGMENT_SECONDS), "-reset_timestamps", "1", outputPattern,
    ], { timeout: 180_000, maxBuffer: 4 * 1024 * 1024 });
    const names = (await readdir(workingDirectory)).filter((name) => /^section-\d+\.mp3$/.test(name)).sort();
    if (!names.length) throw new Error("The long recording did not contain a readable audio track");
    const chunks = await Promise.all(names.map(async (name, index) => {
      const bytes = await readFile(join(workingDirectory, name));
      return { audio: new Blob([bytes], { type: "audio/mpeg" }), extension: "mp3", offsetSeconds: index * SEGMENT_SECONDS };
    }));
    console.info("[discovery-call] prepared long recording", { inputBytes: audio.size, chunks: chunks.map((chunk) => chunk.audio.size) });
    return { chunks, cleanup: () => rm(workingDirectory, { recursive: true, force: true }) };
  } catch (error) {
    await rm(workingDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function transcribeChunk(chunk: AudioChunk, apiKey: string) {
  const form = new FormData();
  form.set("model", "gpt-4o-transcribe-diarize");
  form.set("file", chunk.audio, `discovery-call.${chunk.extension}`);
  form.set("response_format", "diarized_json");
  form.set("chunking_strategy", "auto");
  form.set("language", "en");

  const result = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(240_000),
  });
  const body = await result.json() as DiarizedTranscription;
  if (!result.ok || !body.text) throw new Error(body.error?.message || "OpenAI could not transcribe the recording");
  return body;
}

async function transcribeRecording(response: Response, fileType: string | null) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_RECORDING_BYTES) throw new Error("Recording audio is larger than 200 MB. Download it from Zoom and upload a compressed audio-only copy.");

  const audio = await response.blob();
  if (audio.size > MAX_RECORDING_BYTES) throw new Error("Recording audio is larger than 200 MB. Download it from Zoom and upload a compressed audio-only copy.");
  const extension = (fileType || "m4a").toLowerCase();
  console.info("[discovery-call] transcribing recording", { bytes: audio.size, extension, model: "gpt-4o-transcribe-diarize" });
  const prepared = await prepareAudioChunks(audio, extension);
  try {
    const results = await Promise.all(prepared.chunks.map(async (chunk) => ({ chunk, body: await transcribeChunk(chunk, apiKey) })));
    const plainText = results.map(({ body }) => body.text?.trim()).filter(Boolean).join("\n\n");
    const structuredText = results.flatMap(({ chunk, body }) => {
      const speakers = [...new Set((body.segments ?? []).map((segment) => segment.speaker))];
      return (body.segments ?? []).map((segment) => {
        const speakerNumber = speakers.indexOf(segment.speaker) + 1;
        const start = segment.start + chunk.offsetSeconds;
        const end = segment.end + chunk.offsetSeconds;
        return `[[${start.toFixed(2)}|${end.toFixed(2)}|Speaker ${speakerNumber}]] ${segment.text.trim()}`;
      });
    }).join("\n") || plainText;
    return { plainText, structuredText };
  } finally {
    await prepared.cleanup();
  }
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

async function getRecordingAudio(call: Record<string, unknown>) {
  if (!call.recording_download_url) throw new Error("Zoom did not include a downloadable recording file");
  const zoomToken = await getZoomAccessToken();
  let recording: Response;
  let fileType = call.recording_file_type as string | null;
  try {
    recording = await downloadZoomRecording(call.recording_download_url as string, zoomToken);
  } catch {
    const fresh = await getFreshZoomRecording(call.zoom_meeting_uuid as string, call.recording_file_id as string | null, zoomToken);
    recording = await downloadZoomRecording(fresh.downloadUrl, fresh.downloadToken);
    fileType = fresh.fileType || fileType;
  }
  const declaredSize = Number(recording.headers.get("content-length") || 0);
  if (declaredSize > MAX_RECORDING_BYTES) throw new Error("Recording audio is larger than 200 MB. Download it from Zoom and upload a compressed audio-only copy.");
  const audio = await recording.blob();
  if (audio.size > MAX_RECORDING_BYTES) throw new Error("Recording audio is larger than 200 MB. Download it from Zoom and upload a compressed audio-only copy.");
  return { audio, extension: (fileType || "m4a").toLowerCase() };
}

export async function beginDiscoveryCallProcessing(callId: string) {
  const service = createServiceClient();
  const { data: call, error } = await service.from("discovery_calls").select("id,status,processing_attempts,duration_minutes,recording_file_size").eq("id", callId).maybeSingle();
  if (error || !call) throw error ?? new Error("Discovery call not found");
  if (call.status === "completed") return { completed: true, segmentCount: 0 };
  const attempts = (call.processing_attempts ?? 0) + 1;
  await service.from("discovery_calls").update({ status: "processing", processing_attempts: attempts, last_error: null }).eq("id", callId);
  const segmentCount = discoveryCallSegmentCount(call.duration_minutes, call.recording_file_size, SEGMENT_SECONDS, DIRECT_TRANSCRIPTION_BYTES);
  console.info("[discovery-call] durable processing started", { callId, attempts, segmentCount });
  return { completed: false, segmentCount };
}

export async function transcribeDiscoveryCallSegment(callId: string, segmentIndex: number) {
  const service = createServiceClient();
  const { data: call, error } = await service.from("discovery_calls").select("*").eq("id", callId).maybeSingle();
  if (error || !call) throw error ?? new Error("Discovery call not found");
  const { audio, extension } = await getRecordingAudio(call as Record<string, unknown>);
  let chunk: AudioChunk = { audio, extension, offsetSeconds: 0 };
  let cleanup: () => Promise<void> = async () => undefined;

  const durationSeconds = Number(call.duration_minutes ?? 0) * 60;
  if (durationSeconds > SEGMENT_SECONDS || audio.size > DIRECT_TRANSCRIPTION_BYTES) {
    const executable = resolveFfmpegPath();
    if (!executable) throw new Error("Long-recording conversion is unavailable on this server");
    const workingDirectory = await mkdtemp(join(tmpdir(), "full-circle-segment-"));
    cleanup = () => rm(workingDirectory, { recursive: true, force: true });
    const inputPath = join(workingDirectory, `recording.${extension}`);
    const outputPath = join(workingDirectory, `segment-${segmentIndex}.mp3`);
    try {
      await writeFile(inputPath, Buffer.from(await audio.arrayBuffer()));
      await execFileAsync(executable, [
        "-hide_banner", "-loglevel", "error", "-ss", String(segmentIndex * SEGMENT_SECONDS), "-i", inputPath,
        "-t", String(SEGMENT_SECONDS), "-vn", "-map", "0:a:0", "-ac", "1", "-ar", "16000", "-b:a", "48k", outputPath,
      ], { timeout: 180_000, maxBuffer: 4 * 1024 * 1024 });
      const bytes = await readFile(outputPath);
      chunk = { audio: new Blob([bytes], { type: "audio/mpeg" }), extension: "mp3", offsetSeconds: segmentIndex * SEGMENT_SECONDS };
    } catch (segmentError) {
      await cleanup();
      throw segmentError;
    }
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    console.info("[discovery-call] transcribing durable segment", { callId, segmentIndex, bytes: chunk.audio.size });
    const body = await transcribeChunk(chunk, apiKey);
    const speakers = [...new Set((body.segments ?? []).map((segment) => segment.speaker))];
    const structuredText = (body.segments ?? []).map((segment) => {
      const speakerNumber = speakers.indexOf(segment.speaker) + 1;
      const start = segment.start + chunk.offsetSeconds;
      const end = segment.end + chunk.offsetSeconds;
      return `[[${start.toFixed(2)}|${end.toFixed(2)}|Speaker ${speakerNumber}]] ${segment.text.trim()}`;
    }).join("\n") || body.text?.trim() || "";
    return { plainText: body.text?.trim() || "", structuredText };
  } finally {
    await cleanup();
  }
}

export async function completeDiscoveryCallProcessing(callId: string, segments: { plainText: string; structuredText: string }[]) {
  const service = createServiceClient();
  const { data: call, error } = await service.from("discovery_calls").select("coach_id,lead_id").eq("id", callId).maybeSingle();
  if (error || !call) throw error ?? new Error("Discovery call not found");
  const plainText = segments.map((segment) => segment.plainText).filter(Boolean).join("\n\n");
  const structuredText = segments.map((segment) => segment.structuredText).filter(Boolean).join("\n");
  const projectBrief = await createProjectBrief(plainText);
  const { error: updateError } = await service.from("discovery_calls").update({ status: "completed", transcript: structuredText || plainText, project_brief: projectBrief, processed_at: new Date().toISOString(), last_error: null }).eq("id", callId);
  if (updateError) throw updateError;
  if (call.lead_id) {
    await service.from("lead_activities").insert({ coach_id: call.coach_id, lead_id: call.lead_id, activity_type: "consultation", note: "Discovery call transcribed and project brief created", metadata: { discovery_call_id: callId } });
  }
  console.info("[discovery-call] durable processing completed", { callId, segments: segments.length });
}

export async function failDiscoveryCallProcessing(callId: string, message: string) {
  const service = createServiceClient();
  await service.from("discovery_calls").update({ status: "failed", last_error: message.slice(0, 1000) }).eq("id", callId);
  await logServerError({ message }, `zoom.discovery-call.workflow:${callId}`);
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
    const projectBrief = await createProjectBrief(transcript.plainText);
    const { error } = await service.from("discovery_calls").update({ status: "completed", transcript: transcript.structuredText, project_brief: projectBrief, processed_at: new Date().toISOString(), last_error: null }).eq("id", callId);
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
