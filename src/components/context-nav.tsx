"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONTEXT_NAV } from "@/components/nav-config";
import { NotificationCenter } from "@/components/notification-center";

type Notification = { id: string; event_type: string; payload: Record<string, unknown>; read_at: string | null; created_at: string };

export function ContextNav({ isClient, notifications = [] }: { isClient: boolean; notifications?: Notification[] }) {
  const pathname = usePathname();
  if (isClient) return null;
  const section = CONTEXT_NAV.find((entry) => entry.paths.some((path) => pathname.startsWith(path)));
  if (!section) return null;
  return (
    <nav className="context-nav" aria-label={`${section.label} pages`}>
      <div className="context-nav-name">{section.label}</div>
      <div className="context-nav-links">
        {section.items.map((item) => {
          const baseHref = item.href.split("#")[0];
          const active = pathname === baseHref && !item.href.includes("#");
          if (item.href.includes("#")) {
            return <a href={item.href} key={item.href}>{item.label}</a>;
          }
          return <Link className={active ? "active" : ""} href={item.href} key={item.href}>{item.label}</Link>;
        })}
        {"moreItems" in section && section.moreItems && (
          <details className="context-more">
            <summary className={section.moreItems.some((item) => pathname === item.href) ? "active" : ""}>More <span aria-hidden="true">⌄</span></summary>
            <div className="context-more-menu">
              {section.moreItems.map((item) => <Link className={pathname === item.href ? "active" : ""} href={item.href} key={item.href}>{item.label}</Link>)}
            </div>
          </details>
        )}
      </div>
      <NotificationCenter initialNotifications={notifications} />
    </nav>
  );
}
