export const metadata = {
  title: "Privacy Policy — Full Circle CRM",
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", lineHeight: 1.6 }}>
      <h1>Privacy Policy</h1>
      <p>Last updated: {new Date().getFullYear()}</p>

      <p>
        Full Circle CRM is a private business management platform. This policy explains what
        information we collect and how it is used when you submit a website-project inquiry.
      </p>

      <h2>What we collect</h2>
      <p>
        Contact and project information you submit may include your name, email, phone number,
        business name, website, project requirements, preferred timeframe, and budget. Account
        information and business data may also be entered directly into the CRM. If the owner connects a
        Meta (Facebook/Instagram) Ads account, we store an encrypted access token and cached
        campaign performance data (spend, impressions, clicks, and reported leads) so it can
        be shown in your dashboard without repeated logins.
      </p>

      <h2>How we use it</h2>
      <p>
        To respond to inquiries, qualify website projects, schedule consultations, provide proposals,
        and operate the private CRM, calendar, courses, and ad reporting. Submitting an inquiry does
        not by itself opt you into unrelated marketing email or SMS. We do not sell your data or share it
        with third parties beyond the services you explicitly connect (e.g. Meta, Stripe).
      </p>

      <h2>Data deletion</h2>
      <p>
        To request deletion of your account and associated data, contact the account owner
        directly, or disconnect a connected service (e.g. Meta Ads) at any time from Settings
        — disconnecting revokes and deletes the stored access token.
      </p>

      <h2>Contact</h2>
      <p>Questions about this policy can be directed to the account owner.</p>
    </div>
  );
}
