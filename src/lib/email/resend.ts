// Thin wrapper over Resend's API, shared by any transactional email the app
// sends (client invites, and whatever's added later) — separate from the
// Full Circle Labs contact-form email path in /api/leads, which has its own
// sender identity. Same "off until configured" convention: callers should
// treat a false return as expected, not an error, and fall back to
// whatever manual alternative makes sense (e.g. a copyable link).

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false };

  const from = process.env.EMAIL_FROM || "DJS CRM <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: input.to,
      reply_to: input.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { sent: false, error: `Resend API error (${res.status}): ${detail}` };
  }

  return { sent: true };
}
