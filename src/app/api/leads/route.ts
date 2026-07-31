import { NextResponse } from "next/server";

// Full Circle Labs contact form → lead intake.
//
// Two optional delivery paths, both off until you set env vars:
//
//  • Email to your inbox (interim, before the CRM):
//      RESEND_API_KEY   — from https://resend.com (free tier)
//      LEADS_TO_EMAIL   — where leads should land (your inbox)
//      LEADS_FROM_EMAIL — optional; defaults to Resend's test sender
//                         ("Full Circle Labs <onboarding@resend.dev>").
//                         Swap for an address on your own verified domain later.
//
//  • Forward to your CRM (later):
//      LEADS_WEBHOOK_URL    — your CRM's intake endpoint (receives the lead JSON)
//      LEADS_WEBHOOK_SECRET — optional; sent as the `x-webhook-secret` header
//
// Whatever's configured runs; leads are always logged server-side too, so
// nothing is silently lost.

type LeadInput = {
  name?: string;
  email?: string;
  company?: string;
  projectType?: string;
  budget?: string;
  message?: string;
  website?: string; // honeypot — must be empty
};

type Lead = {
  name: string;
  email: string;
  company: string | null;
  projectType: string | null;
  budget: string | null;
  message: string;
  source: string;
  submittedAt: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeHtml = (s: string) =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);

async function emailLead(lead: Lead) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEADS_TO_EMAIL;
  if (!apiKey || !to) return;

  const from = process.env.LEADS_FROM_EMAIL || "Full Circle Labs <onboarding@resend.dev>";
  const fields: [string, string | null][] = [
    ["Name", lead.name],
    ["Email", lead.email],
    ["Company", lead.company],
    ["Needs", lead.projectType],
    ["Budget", lead.budget],
  ];
  const rows = fields
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666;">${k}</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(
          v as string,
        )}</td></tr>`,
    )
    .join("");
  const html = `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;">
      <h2 style="margin:0 0 12px;">New project brief</h2>
      <table style="border-collapse:collapse;font-size:14px;">${rows}</table>
      <p style="margin:18px 0 4px;color:#666;font-size:13px;">Message</p>
      <p style="font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(lead.message)}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
      <p style="color:#999;font-size:12px;">From the Full Circle Labs site · ${lead.submittedAt}</p>
    </div>`;
  const text =
    fields
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n") + `\n\nMessage:\n${lead.message}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      reply_to: lead.email, // replying goes straight to the prospect
      subject: `New project brief — ${lead.name}${lead.company ? ` (${lead.company})` : ""}`,
      html,
      text,
    }),
  });
  if (!res.ok) {
    console.error("[leads] email send failed", res.status, await res.text().catch(() => ""));
  }
}

async function forwardLead(lead: Lead) {
  const webhook = process.env.LEADS_WEBHOOK_URL;
  if (!webhook) return;
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
  if (!res.ok) console.error("[leads] webhook responded", res.status);
}

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

  const lead: Lead = {
    name,
    email,
    company: body.company?.trim() || null,
    projectType: body.projectType?.trim() || null,
    budget: body.budget?.trim() || null,
    message,
    source: "fullcirclelabs-site",
    submittedAt: new Date().toISOString(),
  };

  // Deliver via whatever's configured. Failures are logged, never surfaced to
  // the visitor — the lead is still captured in the server log below.
  await Promise.allSettled([emailLead(lead), forwardLead(lead)]);
  console.log("[leads] new lead", JSON.stringify(lead));

  return NextResponse.json({ ok: true });
}
