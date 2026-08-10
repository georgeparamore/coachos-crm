"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_SECTIONS, CLIENT_NAV_SECTIONS } from "@/components/nav-config";
import { NavIcon } from "@/components/nav-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userName: string;
  userInitials: string;
  userPlan: string;
  isAdmin?: boolean;
  role?: string;
  hasClientAccess?: boolean;
};

export function Sidebar({ userName, userInitials, userPlan, isAdmin, role, hasClientAccess }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string) {
    if (href === "/clients") return pathname.startsWith("/clients") || pathname.startsWith("/crm");
    if (href === "/courses") return pathname.startsWith("/courses") || pathname.startsWith("/students");
    if (href === "/ads") {
      return ["/ads", "/analytics", "/subscriptions", "/invoices", "/contracts", "/deals"].some((path) =>
        pathname.startsWith(path),
      );
    }
    return pathname.startsWith(href);
  }

  let sections = role === "client" ? CLIENT_NAV_SECTIONS : NAV_SECTIONS;
  if (role !== "client" && hasClientAccess) {
    // A coach account that's *also* a client somewhere (accepting an invite
    // links the existing account rather than changing its role) still needs
    // a way into their own classroom — append whatever CLIENT_NAV_SECTIONS
    // items aren't already covered by the coach nav (e.g. Community).
    const existingHrefs = new Set(sections.flatMap((s) => s.items.map((i) => i.href)));
    const extraItems = CLIENT_NAV_SECTIONS.flatMap((s) => s.items).filter((i) => !existingHrefs.has(i.href));
    if (extraItems.length > 0) {
      sections = [...sections, { label: "Learn", items: extraItems }];
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="sidebar">
      <div className="logo">
        <div className="logo-name">DJS CRM</div>
        <div className="logo-sub">Your coaching platform</div>
      </div>

      {sections.map((section) => (
        <div key={section.label}>
          <div className="nav-section">{section.label}</div>
          {section.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${isActive(item.href) ? " active" : ""}`}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </div>
      ))}

      {isAdmin && (
        <div>
          <div className="nav-section">Admin</div>
          <Link href="/admin/errors" className={`nav-item${pathname.startsWith("/admin/errors") ? " active" : ""}`}>
            <NavIcon name="file-text" />
            Error log
          </Link>
        </div>
      )}

      <ThemeToggle />

      <div className="sidebar-footer">
        <div className="user-row">
          <div className="user-avatar">{userInitials}</div>
          <div style={{ minWidth: 0 }}>
            <div className="user-name">{userName}</div>
            <div className="user-plan">{userPlan}</div>
          </div>
        </div>
        <button
          className="btn btn-sm"
          style={{ width: "100%", justifyContent: "center", marginTop: 10 }}
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
