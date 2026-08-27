import { createHmac, timingSafeEqual } from "crypto";

export function zoomWebhookSignatureIsValid(rawBody: string, timestamp: string | null, signature: string | null) {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  if (!secret || !timestamp || !signature) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;

  const expected = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(signature);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function zoomValidationResponse(plainToken: string) {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  if (!secret) throw new Error("ZOOM_WEBHOOK_SECRET_TOKEN is not configured");
  return {
    plainToken,
    encryptedToken: createHmac("sha256", secret).update(plainToken).digest("hex"),
  };
}

