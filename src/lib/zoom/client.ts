const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";

type ZoomTokenResponse = { access_token?: string; expires_in?: number; error?: string; reason?: string };

type ZoomRecordingFile = {
  id?: string;
  file_type?: string;
  file_size?: number;
  recording_type?: string;
  download_url?: string;
  status?: string;
};

type ZoomMeetingRecordingsResponse = {
  download_access_token?: string;
  recording_files?: ZoomRecordingFile[];
  message?: string;
};

export async function getZoomAccessToken() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!accountId || !clientId || !clientSecret) throw new Error("Zoom Server-to-Server OAuth credentials are not configured");

  const url = new URL(ZOOM_TOKEN_URL);
  url.searchParams.set("grant_type", "account_credentials");
  url.searchParams.set("account_id", accountId);
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` },
    cache: "no-store",
  });
  const body = await response.json() as ZoomTokenResponse;
  if (!response.ok || !body.access_token) throw new Error(body.reason || body.error || "Zoom rejected the Server-to-Server OAuth credentials");
  return body.access_token;
}

export async function downloadZoomRecording(downloadUrl: string, accessToken: string) {
  const response = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    redirect: "follow",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Zoom recording download failed (${response.status})`);
  return response;
}

export function encodeZoomMeetingUuid(uuid: string) {
  const encoded = encodeURIComponent(uuid);
  return uuid.startsWith("/") || uuid.includes("//") ? encodeURIComponent(encoded) : encoded;
}

function chooseRecording(files: ZoomRecordingFile[], preferredFileId?: string | null) {
  const ready = files.filter((file) => file.download_url && (!file.status || file.status === "completed"));
  return ready.find((file) => preferredFileId && file.id === preferredFileId)
    ?? ready.find((file) => file.recording_type === "audio_only" || file.file_type?.toUpperCase() === "M4A")
    ?? ready.filter((file) => file.file_type?.toUpperCase() === "MP4").sort((a, b) => (a.file_size ?? Infinity) - (b.file_size ?? Infinity))[0]
    ?? ready[0];
}

export async function getFreshZoomRecording(meetingUuid: string, preferredFileId: string | null, accessToken: string) {
  const response = await fetch(`https://api.zoom.us/v2/meetings/${encodeZoomMeetingUuid(meetingUuid)}/recordings`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const body = await response.json() as ZoomMeetingRecordingsResponse;
  if (!response.ok) throw new Error(body.message || `Zoom could not refresh the recording (${response.status})`);
  const file = chooseRecording(body.recording_files ?? [], preferredFileId);
  if (!file?.download_url) throw new Error("Zoom did not return a downloadable recording file");
  return {
    downloadUrl: file.download_url,
    downloadToken: body.download_access_token || accessToken,
    fileType: file.file_type ?? null,
  };
}
