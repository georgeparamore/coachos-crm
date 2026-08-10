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
};

export function Sidebar({ userName, userInitials, userPlan, isAdmin, role }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const sections = role === "client" ? CLIENT_NAV_SECTIONS : NAV_SECTIONS;

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
              className={`nav-item${pathname.startsWith(item.href) ? " active" : ""}`}
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
