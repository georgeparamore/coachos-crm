import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminNav } from "@/components/community-demo/admin-nav";

export default function CommunityAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <div className="sidebar">
        <div className="logo">
          <div className="logo-name">Ridgeline Admin</div>
          <div className="logo-sub">Coach control panel</div>
        </div>

        <div className="nav-section">Manage</div>
        <AdminNav />

        <ThemeToggle />

        <div className="sidebar-footer">
          <div className="user-row">
            <div className="user-avatar">JB</div>
            <div style={{ minWidth: 0 }}>
              <div className="user-name">Jordan Blake</div>
              <div className="user-plan">Head Coach</div>
            </div>
          </div>
          <Link href="/community-demo" className="btn btn-sm" style={{ width: "100%", justifyContent: "center", marginTop: 10 }}>
            ← Back to community
          </Link>
        </div>
      </div>
      <div className="main">{children}</div>
    </div>
  );
}
