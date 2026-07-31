import type { Metadata } from "next";
import "./portfolio.css";
import { COMPANY } from "./projects";

// Set NEXT_PUBLIC_SITE_URL in your deployment to your real domain so the
// canonical URL and social-share (Open Graph) links resolve correctly.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://fullcirclelabs.com";
const DESCRIPTION =
  "Full Circle Labs is a software studio. We design, build, and ship custom software, websites, and mobile apps — from first sketch to launch.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${COMPANY.name} — Software studio`,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: COMPANY.name,
    title: `${COMPANY.name} — Software studio`,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${COMPANY.name} — Software studio`,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
