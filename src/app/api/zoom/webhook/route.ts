import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logServerError } from "@/lib/log-server-error";
import { processDiscoveryCall } from "@/lib/discovery-call-processing";
import { zoomValidationResponse, zoomWebhookSignatureIsValid } from "@/lib/zoom/webhook";

export const runtime = "nodejs";
export const maxDuration = 300;

type ZoomRecordingFile = {
  id?: string;
  file_type?: string;
  file_size?: number;
  recording_type?: string;
  download_url?: string;
  play_url?: string;
  status?: string;
};

type ZoomWebhookBody = {
  event?: string;
  event_ts?: number;
  download_token?: string;
  payload?: {
    account_id?: string;
    plainToken?: string;
    object?: {
      uuid?: string;
      id?: string | number;
      topic?: string;
      host_email?: string;
      start_time?: string;
      duration?: number;
      recording_files?: ZoomRecordingFile[];
    };
  };
};

function chooseRecording(files: ZoomRecordingFile[]) {
  const ready = files.filter((file) => file.download_url && (!file.status || file.status === "completed"));
  return ready.find((file) => file.recording_type === "audio_only" || file.file_type?.toUpperCase() === "M4A")
    ?? ready.filter((file) => file.file_type?.toUpperCase() === "MP4").sort((a, b) => (a.file_size ?? Infinity) - (b.file_size ?? Infinity))[0]
    ?? ready[0];
}

async function findMatchingLead(coachId: string, businessId: string, topic: string) {
  const service = createServiceClient();
  const { data: leads } = await service.from("leads").select("id,name,email").eq("coach_id", coachId).eq("business_id", businessId).is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
  const normalizedTopic = topic.toLowerCase();
  const matches = (leads ?? []).filter((lead) => {
    const email = String(lead.email ?? "").trim().toLowerCase();
    const name = String(lead.name ?? "").trim().toLowerCase();
    return (email.length >= 5 && normalizedTopic.includes(email)) || (name.length >= 4 && normalizedTopic.includes(name));
  });
  return matches.length === 1 ? matches[0].id : null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-zm-request-timestamp");
  const signature = request.headers.get("x-zm-signature");
  if (!zoomWebhookSignatureIsValid(rawBody, timestamp, signature)) return Response.json({ error: "Invalid Zoom signature" }, { status: 401 });

  let body: ZoomWebhookBody;
  try { body = JSON.parse(rawBody) as ZoomWebhookBody; }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (body.event === "endpoint.url_validation") {
    const plainToken = body.payload?.plainToken;
    if (!plainToken) return Response.json({ error: "Missing validation token" }, { status: 400 });
    return Response.json(zoomValidationResponse(plainToken));
  }

  if (body.event !== "recording.completed") return Response.json({ received: true });
  const accountId = body.payload?.account_id;
  const meeting = body.payload?.object;
  if (!accountId || !meeting?.uuid) return Response.json({ received: true });

  const service = createServiceClient();
  const { data: integration } = await service.from("discovery_call_integrations").select("id,coach_id,business_id").eq("zoom_account_id", accountId).eq("enabled", true).maybeSingle();
  if (!integration) {
    await logServerError({ message: `No discovery-call integration is mapped to Zoom account ${accountId}` }, "zoom.discovery-call.unmapped");
    return Response.json({ received: true });
  }

  const topic = meeting.topic?.trim() || "Discovery call";
  const recording = chooseRecording(meeting.recording_files ?? []);
  const { data: existing } = await service.from("discovery_calls").select("id,status").eq("coach_id", integration.coach_id).eq("zoom_meeting_uuid", meeting.uuid).maybeSingle();
  let callId = existing?.id;

  if (!callId) {
    const leadId = await findMatchingLead(integration.coach_id, integration.business_id, topic);
    const { data: created, error } = await service.from("discovery_calls").insert({
      coach_id: integration.coach_id,
      business_id: integration.business_id,
      integration_id: integration.id,
      lead_id: leadId,
      zoom_event_id: request.headers.get("x-zm-trackingid") || (body.event_ts ? String(body.event_ts) : null),
      zoom_meeting_uuid: meeting.uuid,
      zoom_meeting_id: meeting.id != null ? String(meeting.id) : null,
      topic,
      host_email: meeting.host_email ?? null,
      started_at: meeting.start_time ?? null,
      duration_minutes: meeting.duration ?? null,
      recording_completed_at: body.event_ts ? new Date(body.event_ts).toISOString() : new Date().toISOString(),
      recording_file_id: recording?.id ?? null,
      recording_file_type: recording?.file_type ?? null,
      recording_file_size: recording?.file_size ?? null,
      recording_download_url: recording?.download_url ?? null,
      recording_play_url: recording?.play_url ?? null,
      status: "queued",
    }).select("id").single();
    if (error || !created) {
      await logServerError(error ?? { message: "Could not create discovery call" }, "zoom.discovery-call.insert");
      return Response.json({ received: true });
    }
    callId = created.id;
  } else if (existing?.status === "failed") {
    await service.from("discovery_calls").update({
      status: "queued",
      last_error: null,
      recording_download_url: recording?.download_url ?? null,
      recording_play_url: recording?.play_url ?? null,
      recording_file_id: recording?.id ?? null,
      recording_file_type: recording?.file_type ?? null,
      recording_file_size: recording?.file_size ?? null,
    }).eq("id", callId);
  }

  if (existing?.status !== "completed" && callId) after(() => processDiscoveryCall(callId, body.download_token));
  return Response.json({ received: true });
}
