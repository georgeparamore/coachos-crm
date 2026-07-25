"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Starfield from "./starfield";
import { OWNER, projects, type Project } from "./projects";

// Deterministic pseudo-random from a string so window positions are stable
// across renders but feel scattered.
function hashSeed(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

const SIZE_MAP = {
  sm: { w: 210, dur: 26 },
  md: { w: 250, dur: 32 },
  lg: { w: 300, dur: 38 },
} as const;

/** Scatter windows across a loose grid so they don't overlap badly. */
function useLayout() {
  return useMemo(() => {
    const cols = 3;
    return projects.map((p, i) => {
      const seedX = hashSeed(p.id + "x");
      const seedY = hashSeed(p.id + "y");
      const col = i % cols;
      const row = Math.floor(i / cols);
      // Base cell position as a percentage, with gentle per-project jitter so
      // the grid reads as "scattered in space" without windows colliding.
      const left = (col + 0.5) / cols * 100 + (seedX - 0.5) * 7;
      const top = 16 + row * 40 + (seedY - 0.5) * 8;
      const size = SIZE_MAP[p.size ?? "md"];
      return {
        project: p,
        left: Math.max(4, Math.min(72, left)),
        top: Math.max(8, Math.min(84, top)),
        width: size.w,
        floatDur: size.dur + seedX * 8,
        floatDelay: -seedY * 12,
        drift: (seedX - 0.5) * 26,
      };
    });
  }, []);
}

/** A generated "screenshot" for projects that don't ship real images. */
function Placeholder({ project }: { project: Project }) {
  return (
    <div className="shot-placeholder" style={{ ["--accent" as string]: project.accent }}>
      <div className="shot-chrome">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
      <div className="shot-body">
        <div className="shot-glyph">{project.glyph}</div>
        <div className="shot-bars">
          <span style={{ width: "70%" }} />
          <span style={{ width: "45%" }} />
          <span style={{ width: "58%" }} />
        </div>
        <div className="shot-tiles">
          <span />
          <span />
          <span />
        </div>
      </div>
      <span className="shot-watermark">preview</span>
    </div>
  );
}

function ProjectWindow({
  data,
  onOpen,
}: {
  data: ReturnType<typeof useLayout>[number];
  onOpen: (p: Project) => void;
}) {
  const { project: p, left, top, width, floatDur, floatDelay, drift } = data;
  return (
    <button
      type="button"
      className="proj-window"
      onClick={() => onOpen(p)}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${width}px`,
        ["--accent" as string]: p.accent,
        ["--float-dur" as string]: `${floatDur}s`,
        ["--float-delay" as string]: `${floatDelay}s`,
        ["--drift" as string]: `${drift}px`,
      }}
      aria-label={`Open ${p.name}: ${p.tagline}`}
    >
      <span className="pw-titlebar">
        <span className="pw-lights">
          <span />
          <span />
          <span />
        </span>
        <span className="pw-glyph">{p.glyph}</span>
        <span className="pw-name">{p.name}</span>
      </span>
      <span className="pw-preview">
        <Placeholder project={p} />
      </span>
      <span className="pw-tagline">{p.tagline}</span>
      <span className="pw-hint">Click to open</span>
    </button>
  );
}

function ProjectModal({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const [shot, setShot] = useState(0);
  const shots = project.shots.length > 0 ? project.shots : [null];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setShot((s) => (s + 1) % shots.length);
      if (e.key === "ArrowLeft") setShot((s) => (s - 1 + shots.length) % shots.length);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, shots.length]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="pf-modal"
        style={{ ["--accent" as string]: project.accent }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-titlebar">
          <span className="pw-lights">
            <span />
            <span />
            <span />
          </span>
          <span className="modal-glyph">{project.glyph}</span>
          <span id="modal-title" className="modal-name">
            {project.name}
          </span>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-gallery">
            <div className="gallery-stage">
              {shots[shot] === null ? (
                <Placeholder project={project} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shots[shot] as string} alt={`${project.name} screenshot ${shot + 1}`} />
              )}
              {shots.length > 1 && (
                <>
                  <button
                    className="gallery-nav prev"
                    onClick={() => setShot((s) => (s - 1 + shots.length) % shots.length)}
                    aria-label="Previous screenshot"
                  >
                    ‹
                  </button>
                  <button
                    className="gallery-nav next"
                    onClick={() => setShot((s) => (s + 1) % shots.length)}
                    aria-label="Next screenshot"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            {shots.length > 1 && (
              <div className="gallery-dots">
                {shots.map((_, i) => (
                  <button
                    key={i}
                    className={i === shot ? "on" : ""}
                    onClick={() => setShot(i)}
                    aria-label={`Go to screenshot ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="modal-detail">
            <p className="modal-tagline">{project.tagline}</p>
            <p className="modal-desc">{project.description}</p>

            {project.highlights.length > 0 && (
              <>
                <h3>What it does</h3>
                <ul className="modal-highlights">
                  {project.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </>
            )}

            {project.tech.length > 0 && (
              <div className="modal-tech">
                {project.tech.map((t) => (
                  <span key={t} className="tech-chip">
                    {t}
                  </span>
                ))}
              </div>
            )}

            {project.links.length > 0 && (
              <div className="modal-links">
                {project.links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    className="modal-link"
                    target={l.href.startsWith("http") ? "_blank" : undefined}
                    rel={l.href.startsWith("http") ? "noreferrer" : undefined}
                  >
                    {l.label} →
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Portfolio() {
  const layout = useLayout();
  const [active, setActive] = useState<Project | null>(null);

  const open = useCallback((p: Project) => setActive(p), []);
  const close = useCallback(() => setActive(null), []);

  return (
    <main className="space-root">
      <Starfield />
      <div className="nebula" aria-hidden="true" />

      <header className="intro">
        <p className="intro-eyebrow">Portfolio</p>
        <h1 className="intro-name">{OWNER.name}</h1>
        <p className="intro-role">{OWNER.role}</p>
        <p className="intro-text">{OWNER.intro}</p>
      </header>

      <section
        className="window-field"
        aria-label="Projects"
        style={{
          // Height adapts to the number of rows so the field isn't sparse
          // with few projects. Routed through a CSS var so the mobile
          // stacked-layout media query can still override it.
          ["--field-min" as string]: `${Math.ceil(projects.length / 3) * 46 + 24}vh`,
        }}
      >
        {layout.map((d) => (
          <ProjectWindow key={d.project.id} data={d} onOpen={open} />
        ))}
      </section>

      <footer className="space-footer">
        <span>{projects.length} projects · drifting in orbit</span>
      </footer>

      {active && <ProjectModal project={active} onClose={close} />}
    </main>
  );
}
