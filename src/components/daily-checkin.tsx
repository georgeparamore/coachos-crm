"use client";

import { useMemo, useState } from "react";
import { NavIcon } from "@/components/nav-icon";

// A rotating pool of encouraging openers — index picked by day-of-year so it's
// stable through the day but changes daily, without needing a backend.
const DAILY_MESSAGES = [
  "I hope your morning gave you a moment to breathe — that calm is going to carry you through today.",
  "You're building something real here, one day at a time. The momentum is showing.",
  "Take a breath before you dive in — showing up consistently is already the hard part, and you're doing it.",
  "Every lead on your list today is someone who saw what you're building and wanted in. That's worth celebrating.",
  "However today goes, remember you're playing the long game — and you're winning it.",
  "Coffee in hand, mind clear — let's make today count.",
  "You've got a full pipeline and a full heart. Let's turn both into results today.",
  "Small, steady steps built everything you see in this dashboard. Keep going — it's working.",
];

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

function getGreeting(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DailyCheckin({
  firstName,
  todayEventCount,
  newLeadCount,
}: {
  firstName: string;
  todayEventCount: number;
  newLeadCount: number;
}) {
  const [dismissed, setDismissed] = useState(false);

  const now = useMemo(() => new Date(), []);
  const greeting = useMemo(() => getGreeting(now.getHours()), [now]);
  const message = useMemo(() => DAILY_MESSAGES[dayOfYear(now) % DAILY_MESSAGES.length], [now]);

  function dismiss() {
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div className="cp-welcome-card" role="status">
      <button className="cp-welcome-close" onClick={dismiss} aria-label="Dismiss">
        <NavIcon name="x" />
      </button>
      <div className="cp-welcome-eyebrow">
        <NavIcon name="sparkle" />
        Daily check-in
      </div>
      <div className="cp-welcome-greeting">
        {greeting}, {firstName}!
      </div>
      <p className="cp-welcome-message">{message}</p>
      <div className="cp-welcome-stats">
        <div className="cp-welcome-stat">
          <span className="cp-welcome-stat-value">{todayEventCount}</span>
          <span className="cp-welcome-stat-label">on today&apos;s schedule</span>
        </div>
        <div className="cp-welcome-stat">
          <span className="cp-welcome-stat-value">{newLeadCount}</span>
          <span className="cp-welcome-stat-label">new leads waiting</span>
        </div>
      </div>
    </div>
  );
}
