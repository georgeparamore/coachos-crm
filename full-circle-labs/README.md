# Full Circle Labs

The Full Circle Labs studio site — a standalone Next.js app. Space-themed
landing page with services, a work showcase, and a contact form.

Self-contained: no database, no auth. The only optional integration is lead
delivery from the contact form (see below).

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Contact form → your inbox / CRM

The form posts to `/api/leads`. All delivery is optional and configured with
env vars (set them in your host, e.g. Vercel → Settings → Environment
Variables):

- **Email each lead to your inbox** (via [Resend](https://resend.com)):
  - `RESEND_API_KEY`
  - `LEADS_TO_EMAIL` — where leads should land
  - `LEADS_FROM_EMAIL` — optional; an address on your verified domain,
    e.g. `Full Circle Labs <leads@yourdomain.com>`
- **Forward each lead to your CRM** (later):
  - `LEADS_WEBHOOK_URL` — your CRM intake endpoint (receives the lead JSON)
  - `LEADS_WEBHOOK_SECRET` — optional; sent as the `x-webhook-secret` header

Also set `NEXT_PUBLIC_SITE_URL` to your domain so canonical/Open Graph links
resolve. Leads are always logged server-side, so nothing is lost.

## Deploy

Deploy to Vercel (or any Next.js host). Add the env vars above, then point
your domain at the project.
