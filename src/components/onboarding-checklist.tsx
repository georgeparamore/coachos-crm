import Link from "next/link";

export type OnboardingStep = { label: string; detail: string; href: string; complete: boolean };

export function OnboardingChecklist({ firstName, steps }: { firstName: string; steps: OnboardingStep[] }) {
  const completed = steps.filter((step) => step.complete).length;
  if (completed === steps.length) return null;
  const percent = Math.round((completed / steps.length) * 100);

  return (
    <section className="onboarding-card" aria-labelledby="onboarding-title">
      <div className="onboarding-intro">
        <div className="modal-eyebrow">Getting started</div>
        <h2 id="onboarding-title">Let’s set up your workspace, {firstName}.</h2>
        <p>Four quick steps turn Full Circle CRM into your daily business command center.</p>
        <div className="onboarding-progress"><div style={{ width: `${percent}%` }} /></div>
        <span>{completed} of {steps.length} complete</span>
      </div>
      <div className="onboarding-steps">
        {steps.map((step, index) => (
          <Link className={step.complete ? "is-complete" : ""} href={step.href} key={step.label} aria-label={`${step.label}${step.complete ? " completed" : ""}`}>
            <i>{step.complete ? "✓" : index + 1}</i>
            <div><strong>{step.label}</strong><span>{step.detail}</span></div>
            <b>{step.complete ? "Done" : "Start →"}</b>
          </Link>
        ))}
      </div>
    </section>
  );
}
