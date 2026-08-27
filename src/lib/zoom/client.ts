const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";

type ZoomTokenResponse = { access_token?: string; expires_in?: number; error?: string; reason?: string };

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

