import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { DemoNav } from "@/components/community-demo/demo-nav";

export default function CommunitySiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cp-shell">
      <header className="cp-topbar">
        <div className="cp-brand">
          <span className="cp-brand-mark">R</span>
          <span>Ridgeline Coaching Co.</span>
          <span className="badge badge-purple cp-demo-badge">Concept preview</span>
        </div>
        <DemoNav />
        <div className="cp-topbar-actions">
          <Link href="/community-demo/admin" className="btn btn-sm">
            Admin panel
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="cp-main">{children}</main>
    </div>
  );
}
