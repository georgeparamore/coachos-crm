"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useErrorToast } from "@/components/error-toast-provider";

type Notification = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export function NotificationCenter({ initialNotifications }: { initialNotifications: Notification[] }) {
  const { showError } = useErrorToast();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const unread = notifications.filter((notification) => !notification.read_at).length;

  async function markRead(id?: string) {
    const targets = id ? [id] : notifications.filter((item) => !item.read_at).map((item) => item.id);
    if (!targets.length) return;
    const readAt = new Date().toISOString();
    const previous = notifications;
    setNotifications((items) => items.map((item) => targets.includes(item.id) ? { ...item, read_at: readAt } : item));
    const supabase = createClient();
    const { error } = await supabase.from("notification_deliveries").update({ read_at: readAt }).in("id", targets);
    if (error) {
      setNotifications(previous);
      showError(error, "notifications.mark-read");
    }
  }

  return (
    <div className="notification-center">
      <button className="notification-trigger" type="button" aria-label={`${unread} unread notifications`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span aria-hidden="true">◌</span>{unread > 0 && <b>{unread > 9 ? "9+" : unread}</b>}
      </button>
      {open && (
        <div className="notification-popover">
          <div className="notification-head"><strong>Notifications</strong>{unread > 0 && <button type="button" onClick={() => void markRead()}>Mark all read</button>}</div>
          {notifications.length === 0 ? <div className="notification-empty">No notifications yet.</div> : notifications.map((notification) => {
            const name = typeof notification.payload.name === "string" ? notification.payload.name : "New lead";
            const leadId = typeof notification.payload.lead_id === "string" ? notification.payload.lead_id : null;
            const business = typeof notification.payload.business_name === "string" ? notification.payload.business_name : null;
            return (
              <Link href={leadId ? `/crm?lead=${leadId}` : "/crm"} className={`notification-item${notification.read_at ? "" : " unread"}`} key={notification.id} onClick={() => void markRead(notification.id)}>
                <span className="notification-dot" />
                <span><strong>{notification.event_type === "new_meta_lead" ? `New lead: ${name}` : name}</strong><small>{business ? `${business} · ` : ""}{new Date(notification.created_at).toLocaleString()}</small></span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
