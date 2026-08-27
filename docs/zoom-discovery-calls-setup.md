# Zoom discovery-call automation setup

The CRM side is implemented at:

- Webhook: `https://coachos-drab.vercel.app/api/zoom/webhook`
- Coach inbox: `https://coachos-drab.vercel.app/calls`
- Routing form: Settings → Zoom discovery calls

## 1. Create the Zoom app

In the Zoom App Marketplace, create an internal **Server-to-Server OAuth** app for the Zoom account that hosts discovery calls.

Add the recording read scope Zoom requires for the `recording.completed` event:

- `cloud_recording:read:recording:admin` (account-level), or the equivalent account recording-read scope Zoom presents in the app builder.

Copy the Account ID, Client ID, and Client Secret into the matching Vercel Production environment variables. Never paste those secrets into source code or a public message.

## 2. Configure the webhook

Add an event notification endpoint using the CRM webhook URL above. Copy Zoom's webhook **Secret Token** into `ZOOM_WEBHOOK_SECRET_TOKEN` in Vercel, redeploy, then use Zoom's Validate button.

Subscribe the endpoint to **Recording → All Recordings have completed** (`recording.completed`). Activate the Server-to-Server OAuth app.

## 3. Configure transcription

Add `OPENAI_API_KEY` to Vercel Production and redeploy. Optional model overrides are documented in `.env.example`.

## 4. Route calls inside Full Circle CRM

Open Settings → Zoom discovery calls. Enter the same Zoom Account ID and route recordings to the **Websites** business. The Zoom Account ID is not secret; it tells the webhook which coach and business own the recording.

## 5. Zoom meeting defaults

In the Zoom web portal:

- enable automatic cloud recording for the host;
- leave "Only authenticated users can join" disabled;
- allow browser joining so prospects do not need an account or app;
- tell invitees that the call is recorded and obtain any consent required in their location.

## 6. End-to-end test

Create a short Zoom meeting, record it to the cloud, say a few concrete project requirements, and end the meeting. After Zoom finishes processing the recording, it should appear under People → Discovery calls. Confirm the transcript, brief, recording link, and lead assignment.

The webhook acknowledges Zoom immediately and processes the recording afterward. Failed calls remain visible with their exact error and a Retry processing button.
