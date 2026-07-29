"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/nav-icon";

const DEMO_NAV = [
  { href: "/realestate-demo", label: "Home", icon: "home" },
  { href: "/realestate-demo/listings", label: "Listings", icon: "map-pin" },
  { href: "/realestate-demo/leads", label: "Leads", icon: "users" },
  { href: "/realestate-demo/calendar", label: "Calendar", icon: "calendar" },
];

export function DemoNav() {
  const pathname = usePathname();

  return (
    <nav className="rd-nav">
      {DEMO_NAV.map((item) => {
        const active = item.href === "/realestate-demo" ? pathname === item.href : pathname?.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={`rd-nav-link${active ? " rd-nav-link-active" : ""}`}>
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
