import { NavIcon } from "@/components/nav-icon";

const FEATURES: { icon: string; label: string }[] = [
  { icon: "play", label: "Courses, lessons & client progress" },
  { icon: "message", label: "Community & real-time leads" },
  { icon: "bar-chart", label: "Ad performance, synced from Meta" },
];

export function AuthShell({ tagline, children }: { tagline: string; children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <div className="auth-hero-logo">DJS CRM</div>
        <div className="auth-hero-tagline">{tagline}</div>
        <ul className="auth-hero-features">
          {FEATURES.map((f) => (
            <li key={f.label}>
              <span className="auth-feature-icon">
                <NavIcon name={f.icon} />
              </span>
              {f.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="auth-panel">
        <div className="auth-card card" style={{ marginBottom: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
