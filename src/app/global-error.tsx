"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: "root-layout-crash",
        message: error.message,
        stack: error.stack,
        url: typeof window !== "undefined" ? window.location.href : undefined,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f7f6f3",
            padding: 20,
          }}
        >
          <div
            style={{
              width: 420,
              textAlign: "center",
              background: "#fff",
              border: "0.5px solid rgba(0,0,0,0.1)",
              borderRadius: 12,
              padding: "28px 24px",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Full Circle CRM hit an unexpected error</div>
            <p style={{ fontSize: 13, color: "#5c5c58", marginBottom: 18 }}>
              It&apos;s been reported automatically. Try reloading the page.
            </p>
            <button
              onClick={reset}
              style={{
                background: "#1a1a18",
                color: "#f7f6f3",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
