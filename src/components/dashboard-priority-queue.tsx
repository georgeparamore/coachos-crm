"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import styles from "@/app/(app)/dashboard/dashboard.module.css";

export type DashboardPriority = { id: string; title: string; detail: string; href: string; label: string; priority: "high" | "medium" | "low" };

const STORAGE_KEY = "full-circle-dismissed-priorities-v1";
const EVENT_NAME = "full-circle-priorities-changed";

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function loadDismissed() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as { date?: string; ids?: string[] } | null;
    return saved?.date === todayKey() ? saved.ids ?? [] : [];
  } catch { return []; }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT_NAME, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT_NAME, onChange); window.removeEventListener("storage", onChange); };
}

function useDismissedPriorities() {
  const value = useSyncExternalStore(subscribe, () => JSON.stringify(loadDismissed()), () => "[]");
  return JSON.parse(value) as string[];
}

export function DashboardPriorityQueue({ items }: { items: DashboardPriority[] }) {
  const dismissed = useDismissedPriorities();
  const visible = useMemo(() => items.filter((item) => !dismissed.includes(item.id)), [dismissed, items]);

  function save(ids: string[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey(), ids }));
    window.dispatchEvent(new Event(EVENT_NAME));
  }

  return <div className={`card ${styles.attentionCard}`}>
    <div className="card-title-row"><div className="card-title">Priority queue</div>{visible.length ? <button className={styles.clearPriorities} onClick={() => save(items.map((item) => item.id))} type="button">Clear for today</button> : <Link href="/crm">View leads →</Link>}</div>
    {visible.length === 0 ? <div className={styles.allClear}><span>✓</span><div><strong>You’re all caught up for today</strong><p>{items.length ? "Dismissed items return tomorrow if they still need attention." : "No overdue follow-ups or client actions right now."}</p>{items.length > 0 && <button className={styles.restorePriorities} onClick={() => save([])} type="button">Show them again</button>}</div></div> : <>
      {visible.slice(0, 5).map((item) => <div className={styles.attentionRow} key={item.id}><i className={styles[item.priority]} /><Link href={item.href}><strong>{item.title}</strong><span>{item.detail}</span></Link><b>{item.label}</b><button className={styles.dismissPriority} aria-label={`Dismiss ${item.title} until tomorrow`} onClick={() => save([...dismissed, item.id])} title="Dismiss until tomorrow" type="button">×</button></div>)}
      {visible.length > 5 && <p className={styles.morePriorities}>+{visible.length - 5} more priorities</p>}
    </>}
  </div>;
}

export function useVisiblePriorities<T extends { id: string }>(items: T[]) {
  const dismissed = useDismissedPriorities();
  return items.filter((item) => !dismissed.includes(item.id));
}
