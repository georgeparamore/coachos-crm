"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONTEXT_NAV } from "@/components/nav-config";

export function ContextNav({ isClient }: { isClient: boolean }) {
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
          return <Link className={active ? "active" : ""} href={item.href} key={item.href}>{item.label}</Link>;
        })}
      </div>
    </nav>
  );
}
