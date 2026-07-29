import { ThemeToggle } from "@/components/theme-toggle";
import { DemoNav } from "@/components/realestate-demo/demo-nav";
import { RealEstateDemoProvider } from "@/lib/realestate-demo-store";

export default function RealEstateDemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <RealEstateDemoProvider>
      <div className="rd-shell">
        <header className="rd-topbar">
          <div className="rd-brand">
            <span className="rd-brand-mark">R</span>
            <span>Reyes Realty Group</span>
            <span className="badge badge-purple rd-demo-badge">Concept preview</span>
          </div>
          <DemoNav />
          <ThemeToggle />
        </header>
        <main className="rd-main">{children}</main>
      </div>
    </RealEstateDemoProvider>
  );
}
