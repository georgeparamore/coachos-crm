export type EventType = "call" | "meeting" | "session" | "reminder" | "other";

export type CalendarEvent = {
  id: string;
  coach_id: string;
  lead_id: string | null;
  client_id: string | null;
  title: string;
  description: string | null;
  event_type: EventType;
  start_time: string;
  end_time: string | null;
  location: string | null;
  created_at: string;
};

export const EVENT_TYPE_BADGE: Record<EventType, string> = {
  call: "badge-amber",
  meeting: "badge-blue",
  session: "badge-purple",
  reminder: "badge-teal",
  other: "badge-green",
};

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  call: "Call",
  meeting: "Meeting",
  session: "Coaching session",
  reminder: "Reminder",
  other: "Other",
};

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
