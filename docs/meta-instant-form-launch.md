# Meta Instant Form launch checklist

The CRM is configured for Page `1027598377108811` (Happy dejuan), ad account
`153302168076882`, and the Websites business. The mapping currently accepts all
Instant Forms on that Page; after the real form is created, add its numeric Form
ID in Settings to make the routing stricter.

## Required server environment variables

- `META_APP_ID`
- `META_APP_SECRET`
- `META_API_VERSION`
- `META_TOKEN_ENCRYPTION_KEY`
- `META_WEBHOOK_VERIFY_TOKEN`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY` and `EMAIL_FROM` for email alerts (optional)

Never prefix secrets with `NEXT_PUBLIC_`. Access tokens are encrypted with
AES-256-GCM before storage and are not logged or returned to the browser.

## Connect and test without publishing

1. Keep campaign `52531251837171`, ad set `52531251836771`, and ad
   `52531251836571` unpublished.
2. In Meta App Dashboard, add **Webhooks**, choose the **Page** object, and set:
   - Callback: `https://coachos-drab.vercel.app/api/meta/webhook`
   - Verify token: the production `META_WEBHOOK_VERIFY_TOKEN`
   - Field: `leadgen`
3. In Meta Business Settings, give the connected app/system user Leads Access
   to Page `1027598377108811`. The account needs `leads_retrieval`,
   `pages_show_list`, and `pages_manage_metadata` in addition to its ads scopes.
4. In Full Circle CRM → Settings → Instant Form lead intake, click **Subscribe
   Page**. This uses the official Graph API `/PAGE_ID/subscribed_apps` endpoint.
5. Click **Send test lead**. This is synthetic and creates no ad spend. Confirm
   one test record appears in Leads with all website-project fields.
6. Create the Instant Form on the Happy dejuan Page. Use the nine questions in
   the project handoff, link `https://coachos-drab.vercel.app/privacy`, and state
   that the information is used to contact and qualify the website inquiry.
7. Copy the real Form ID into the CRM mapping.
8. Use Meta's Lead Ads Testing Tool to submit one test lead for that Page/form.
9. Confirm it appears once in Leads, opens to a detail/timeline page, and remains
   single after sending the same test event again.

Do not publish the campaign until step 9 succeeds. No $900 minimum is encoded in
the CRM mapper, privacy disclosure, or test data.
