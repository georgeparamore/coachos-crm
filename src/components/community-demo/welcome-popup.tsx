"use client";

import { useMemo, useState } from "react";
import { NavIcon } from "@/components/nav-icon";
import { useCommunityDemo, CURRENT_ADMIN_ID } from "@/lib/community-demo-store";
import { getMember } from "@/lib/community-demo-data";

// A rotating pool of encouraging openers — index picked by day-of-year so it's
// stable through the day but changes daily, without needing a backend.
const DAILY_MESSAGES = [
  "I hope your meditation was grounding this morning — that calm is going to carry you through today.",
  "You're building something real here, one day at a time. The momentum is showing.",
  "Take a breath before you dive in — showing up consistently is already the hard part, and you're doing it.",
  "Every lead on your list today is someone who saw what you're building and wanted in. That's worth celebrating.",
  "However today goes, remember you're playing the long game — and you're winning it.",
  "Coffee in hand, mind clear — let's make today count.",
  "You've got a full pipeline and a full heart. Let's turn both into results today.",
  "Small, steady steps built everything you see in this dashboard. Keep going — it's working.",
];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

export function WelcomePopup() {
  const [dismissed, setDismissed] = useState(false);
  const { leads, events } = useCommunityDemo();
  const admin = getMember(CURRENT_ADMIN_ID);

  const now = useMemo(() => new Date(), []);
  const greeting = useMemo(() => getGreeting(now.getHours()), [now]);
  const message = useMemo(() => DAILY_MESSAGES[dayOfYear(now) % DAILY_MESSAGES.length], [now]);

  const todayCount = useMemo(() => events.filter((e) => e.date === todayKey()).length, [events]);
  const newLeadCount = useMemo(() => leads.filter((l) => l.status === "new").length, [leads]);

  if (dismissed) return null;

  return (
    <div className="cp-welcome-card" role="status">
      <button className="cp-welcome-close" onClick={() => setDismissed(true)} aria-label="Dismiss">
        <NavIcon name="x" />
      </button>
      <div className="cp-welcome-eyebrow">
        <NavIcon name="sparkle" />
        Daily check-in
      </div>
      <div className="cp-welcome-greeting">
        {greeting}, {admin?.name.split(" ")[0] ?? "there"}!
      </div>
      <p className="cp-welcome-message">{message}</p>
      <div className="cp-welcome-stats">
        <div className="cp-welcome-stat">
          <span className="cp-welcome-stat-value">{todayCount}</span>
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
