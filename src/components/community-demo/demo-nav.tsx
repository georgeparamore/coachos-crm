"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/nav-icon";

const DEMO_NAV = [
  { href: "/community-demo", label: "Home", icon: "home" },
  { href: "/community-demo/classroom", label: "Classroom", icon: "book-open" },
  { href: "/community-demo/community", label: "Community", icon: "message" },
  { href: "/community-demo/members", label: "Members", icon: "users" },
  { href: "/community-demo/calendar", label: "Calendar", icon: "calendar" },
];

export function DemoNav() {
  const pathname = usePathname();

  return (
    <nav className="cp-nav">
      {DEMO_NAV.map((item) => {
        const active = item.href === "/community-demo" ? pathname === item.href : pathname?.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={`cp-nav-link${active ? " cp-nav-link-active" : ""}`}>
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
