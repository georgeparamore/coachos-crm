"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/nav-icon";

const ADMIN_NAV = [
  { href: "/community-demo/admin", label: "Overview", icon: "grid" },
  { href: "/community-demo/admin/courses", label: "Courses", icon: "book-open" },
  { href: "/community-demo/admin/live", label: "Live streaming", icon: "video" },
  { href: "/community-demo/admin/students", label: "Student progress", icon: "trending-up" },
  { href: "/community-demo/admin/leads", label: "Leads", icon: "mail" },
  { href: "/community-demo/admin/calendar", label: "Calendar", icon: "calendar" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <>
      {ADMIN_NAV.map((item) => {
        const active = item.href === "/community-demo/admin" ? pathname === item.href : pathname?.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={`nav-item${active ? " active" : ""}`}>
            <NavIcon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
