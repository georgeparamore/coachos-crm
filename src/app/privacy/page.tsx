export const metadata = {
  title: "Privacy Policy — DJS CRM",
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", lineHeight: 1.6 }}>
      <h1>Privacy Policy</h1>
      <p>Last updated: {new Date().getFullYear()}</p>

      <p>
        DJS CRM is a coaching-business management platform. This page describes, at a high
        level, what data DJS CRM collects and how it is used. This is a placeholder policy
        for early development and testing — it will be replaced with a complete policy before
        the product is used by real clients.
      </p>

      <h2>What we collect</h2>
      <p>
        Account information (name, email) provided at signup, and business data you enter
        yourself (leads, calendar events, courses, contracts, invoices). If you connect a
        Meta (Facebook/Instagram) Ads account, we store an encrypted access token and cached
        campaign performance data (spend, impressions, clicks, and reported leads) so it can
        be shown in your dashboard without repeated logins.
      </p>

      <h2>How we use it</h2>
      <p>
        Solely to operate the product for the coach who owns the account — running your CRM,
        calendar, courses, and ad performance reporting. We do not sell your data or share it
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
