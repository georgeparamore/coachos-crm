import type { Metadata } from "next";
import "./globals.css";
import { ErrorToastProvider } from "@/components/error-toast-provider";

export const metadata: Metadata = {
  title: "DJS CRM — Your platform",
  description: "Run your coaching business — CRM, subscriptions, contracts, courses, and community — from one place.",
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('coachos-theme');
    var theme = stored === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ErrorToastProvider>{children}</ErrorToastProvider>
      </body>
    </html>
  );
}
