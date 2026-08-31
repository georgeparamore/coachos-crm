import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { encodeZoomMeetingUuid } from "./client.ts";
import { zoomValidationResponse, zoomWebhookSignatureIsValid } from "./webhook.ts";

test("accepts an authentic Zoom webhook and rejects tampering", () => {
  process.env.ZOOM_WEBHOOK_SECRET_TOKEN = "test-zoom-secret";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ event: "recording.completed", payload: { account_id: "account-1" } });
  const signature = `v0=${createHmac("sha256", "test-zoom-secret").update(`v0:${timestamp}:${body}`).digest("hex")}`;
  assert.equal(zoomWebhookSignatureIsValid(body, timestamp, signature), true);
  assert.equal(zoomWebhookSignatureIsValid(`${body}x`, timestamp, signature), false);
});

test("creates Zoom's URL-validation challenge response", () => {
  process.env.ZOOM_WEBHOOK_SECRET_TOKEN = "test-zoom-secret";
  const response = zoomValidationResponse("plain-token");
  assert.equal(response.plainToken, "plain-token");
  assert.equal(response.encryptedToken, createHmac("sha256", "test-zoom-secret").update("plain-token").digest("hex"));
});

test("encodes Zoom meeting UUIDs for recording API paths", () => {
  assert.equal(encodeZoomMeetingUuid("meeting+uuid=="), "meeting%2Buuid%3D%3D");
  assert.equal(encodeZoomMeetingUuid("/meeting//uuid=="), "%252Fmeeting%252F%252Fuuid%253D%253D");
});
