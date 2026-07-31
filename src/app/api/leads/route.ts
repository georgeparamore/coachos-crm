import { NextResponse } from "next/server";

// Full Circle Labs contact form → lead intake.
//
// The form posts here. To route leads into your own CRM later, set the
// LEADS_WEBHOOK_URL env var to your CRM's intake endpoint (and optionally
// LEADS_WEBHOOK_SECRET, sent as `x-webhook-secret`); each lead is forwarded
// there as JSON. No rebuild needed — just set the env var. Until it's set,
// leads are validated and logged server-side so nothing errors out.

type LeadInput = {
  name?: string;
  email?: string;
  company?: string;
  projectType?: string;
  budget?: string;
  message?: string;
  website?: string; // honeypot — must be empty
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as LeadInput;

  // Honeypot: bots fill the hidden `website` field. Pretend success so they
  // don't retry, but drop the submission.
  if (body.website && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  const message = body.message?.trim();

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: "Please include your name, email, and a short message." },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
  }

  const lead = {
    name,
    email,
    company: body.company?.trim() || null,
    projectType: body.projectType?.trim() || null,
    budget: body.budget?.trim() || null,
    message,
    source: "fullcirclelabs-site",
    submittedAt: new Date().toISOString(),
  };

  const webhook = process.env.LEADS_WEBHOOK_URL;
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.LEADS_WEBHOOK_SECRET
            ? { "x-webhook-secret": process.env.LEADS_WEBHOOK_SECRET }
            : {}),
        },
        body: JSON.stringify(lead),
      });
      if (!res.ok) {
        console.error("[leads] webhook responded", res.status);
        // Still return success to the visitor — the lead is logged below and
        // the delivery failure is ours to chase, not theirs.
      }
    } catch (err) {
      console.error("[leads] webhook delivery failed", err);
    }
  }

  // Always leave a server-side trail so no lead is silently lost.
  console.log("[leads] new lead", JSON.stringify(lead));

  return NextResponse.json({ ok: true });
}
