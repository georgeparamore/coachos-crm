import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ErrorToastProvider } from "@/components/error-toast-provider";

export const metadata: Metadata = {
  title: "DJS CRM — Your platform",
  description: "Run your coaching business — CRM, subscriptions, contracts, courses, and community — from one place.",
};

const THEME_INIT_SCRIPT = `
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem('coachos-theme');
  } catch (e) {}
  var cookieMatch = document.cookie.match(/(?:^|; )coachos-theme=(light|dark)(?:;|$)/);
  var cookieTheme = cookieMatch ? cookieMatch[1] : null;
  var theme = stored === 'dark' || stored === 'light'
    ? stored
    : cookieTheme === 'dark' || cookieTheme === 'light'
      ? cookieTheme
      : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <Script id="theme-init" strategy="beforeInteractive">
        {THEME_INIT_SCRIPT}
      </Script>
      <body>
        <ErrorToastProvider>{children}</ErrorToastProvider>
      </body>
    </html>
  );
}
