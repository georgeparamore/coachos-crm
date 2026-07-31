"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Starfield from "./starfield";
import { COMPANY, projects, services, type Project } from "./projects";
import { LogoMark, LogoLockup } from "./logo";
import ContactForm from "./contact-form";

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
  sm: { w: 248, dur: 26 },
  md: { w: 292, dur: 32 },
  lg: { w: 344, dur: 38 },
} as const;

/** Scatter windows across a loose grid so they don't overlap badly. */
function useLayout() {
  return useMemo(() => {
    const cols = 3;
    return projects.map((p, i) => {
      const seedX = hashSeed(p.id + "x");
      const seedY = hashSeed(p.id + "y");
      const seedR = hashSeed(p.id + "r");
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
        // Each window wanders on its own slow, looping path. Per-project
        // amplitudes / duration / phase keep them desynced so they drift
        // freely rather than bobbing in lockstep.
        floatDur: 20 + seedX * 12, // 20–32s
        floatDelay: -seedY * 16,
        floatX: 16 + seedX * 18, // px of horizontal wander
        floatY: 18 + seedY * 16, // px of vertical wander
        floatRot: (0.8 + seedR * 1.4).toFixed(2), // deg of tilt
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
  const { project: p, left, top, width, floatDur, floatDelay, floatX, floatY, floatRot } = data;
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
        ["--fx" as string]: `${floatX}px`,
        ["--fy" as string]: `${floatY}px`,
        ["--rot" as string]: `${floatRot}deg`,
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
        {p.shots.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pw-shot" src={p.shots[0]} alt={`${p.name} preview`} />
        ) : (
          <Placeholder project={p} />
        )}
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
  // Currently enlarged screenshot (lightbox), or null.
  const [zoom, setZoom] = useState<string | null>(null);
  const shots = project.shots.length > 0 ? project.shots : [null];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Esc closes the lightbox first, then the modal.
        if (zoom) setZoom(null);
        else onClose();
        return;
      }
      if (zoom) return; // don't page through shots while one is enlarged
      if (e.key === "ArrowRight") setShot((s) => (s + 1) % shots.length);
      if (e.key === "ArrowLeft") setShot((s) => (s - 1 + shots.length) % shots.length);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, shots.length, zoom]);

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
                <img
                  className="zoomable"
                  src={shots[shot] as string}
                  alt={`${project.name} screenshot ${shot + 1}`}
                  title="Click to enlarge"
                  onClick={() => setZoom(shots[shot] as string)}
                />
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

        {zoom && (
          <div className="lightbox" onClick={() => setZoom(null)} role="dialog" aria-modal="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom} alt={`${project.name} screenshot, enlarged`} />
            <button className="lightbox-close" onClick={() => setZoom(null)} aria-label="Close enlarged view">
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const NAV_LINKS = [
  { href: "#services", label: "Services" },
  { href: "#work", label: "Work" },
  { href: "#about", label: "About" },
];

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <nav className={`site-nav ${scrolled ? "scrolled" : ""}`}>
      <a href="#top" className="nav-logo" aria-label="Full Circle Labs — home">
        <LogoLockup size={30} />
      </a>
      <div className="nav-links">
        {NAV_LINKS.map((l) => (
          <a key={l.href} href={l.href}>
            {l.label}
          </a>
        ))}
        <a href="#contact" className="btn-primary btn-sm">
          Start a project
        </a>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <header className="hero" id="top">
      <div className="hero-mark">
        <LogoMark size={104} animate />
      </div>
      <p className="hero-eyebrow">{COMPANY.eyebrow}</p>
      <h1 className="hero-headline">{COMPANY.headline}</h1>
      <p className="hero-subhead">{COMPANY.subhead}</p>
      <div className="hero-cta">
        <a href="#contact" className="btn-primary">
          Start a project
        </a>
        <a href="#work" className="btn-ghost">
          See our work
        </a>
      </div>
    </header>
  );
}

function Services() {
  return (
    <section className="services" id="services" aria-label="Services">
      <div className="section-head">
        <p className="section-eyebrow">What we do</p>
        <h2 className="section-title">Full-stack, full circle.</h2>
        <p className="section-lead">
          One studio for the whole build — strategy, design, and engineering across web, mobile,
          and everything in between.
        </p>
      </div>
      <div className="service-grid">
        {services.map((s) => (
          <article className="service-card" key={s.id}>
            <span className="service-glyph" aria-hidden="true">
              {s.glyph}
            </span>
            <h3>{s.title}</h3>
            <p>{s.blurb}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Work({
  layout,
  onOpen,
}: {
  layout: ReturnType<typeof useLayout>;
  onOpen: (p: Project) => void;
}) {
  return (
    <section className="work" id="work" aria-label="Our work">
      <div className="section-head">
        <p className="section-eyebrow">Selected work</p>
        <h2 className="section-title">Things we&apos;ve built.</h2>
        <p className="section-lead">
          A few projects drifting in orbit — click any window to take a closer look.
        </p>
      </div>
      <div
        className="window-field"
        style={{
          // Height adapts to the number of rows so the field isn't sparse.
          // Routed through a CSS var so the mobile stacked layout can override.
          ["--field-min" as string]: `${Math.ceil(projects.length / 3) * 46 + 20}vh`,
        }}
      >
        {layout.map((d) => (
          <ProjectWindow key={d.project.id} data={d} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="about" id="about" aria-label="About">
      <div className="about-inner">
        <p className="section-eyebrow">Who we are</p>
        <h2 className="section-title">{COMPANY.aboutTitle}</h2>
        <p className="about-body">{COMPANY.about}</p>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section className="contact" id="contact" aria-label="Contact">
      <div className="contact-inner">
        <div className="contact-copy">
          <p className="section-eyebrow">{COMPANY.contactEyebrow}</p>
          <h2 className="section-title">{COMPANY.contactTitle}</h2>
          <p className="section-lead">{COMPANY.contactBlurb}</p>
        </div>
        <ContactForm />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <LogoLockup size={26} />
      <span className="footer-copy">
        © {new Date().getFullYear()} {COMPANY.name}. Building software, full circle.
      </span>
    </footer>
  );
}

export default function FullCircleLabs() {
  const layout = useLayout();
  const [active, setActive] = useState<Project | null>(null);

  const open = useCallback((p: Project) => setActive(p), []);
  const close = useCallback(() => setActive(null), []);

  return (
    <main className="space-root">
      <Starfield />
      <div className="nebula" aria-hidden="true" />

      <Nav />
      <Hero />
      <Services />
      <Work layout={layout} onOpen={open} />
      <About />
      <Contact />
      <Footer />

      {active && <ProjectModal project={active} onClose={close} />}
    </main>
  );
}
