// ─────────────────────────────────────────────────────────────────────────────
// Portfolio content lives here. Edit this file to add / change your projects.
//
// Each project becomes a floating "window" in space. Clicking it opens a panel
// with screenshots and details. To add screenshots, drop image files in
// `public/portfolio/` and reference them like `/portfolio/my-shot.png`.
// Leave `shots` empty to fall back to an auto-generated placeholder.
// ─────────────────────────────────────────────────────────────────────────────

export type ProjectLink = {
  label: string;
  href: string;
};

export type Project = {
  /** Stable id — used for React keys and modal routing. */
  id: string;
  /** Short name shown on the window title bar. */
  name: string;
  /** One-line tagline shown under the name. */
  tagline: string;
  /** Accent color (hex) — tints the window glow, badges and placeholder art. */
  accent: string;
  /** Emoji/glyph shown as the window "favicon". */
  glyph: string;
  /** Longer description shown in the detail panel. */
  description: string;
  /** Bullet points: what it does / notable features. */
  highlights: string[];
  /** Tech / tools used. */
  tech: string[];
  /** Screenshot image paths (place files in /public/portfolio/…). */
  shots: string[];
  /** External links (live site, source, etc). */
  links: ProjectLink[];
  /** Relative window size — "sm" | "md" | "lg". Affects the floating card. */
  size?: "sm" | "md" | "lg";
};

export const OWNER = {
  name: "George Paramore",
  role: "Software Engineer & Builder",
  intro:
    "A collection of programs, websites, and experiments I've built. Each window is a project drifting through space — click one to take a closer look.",
};

export const projects: Project[] = [
  {
    id: "coachos",
    name: "CoachOS",
    tagline: "The operating system for coaches",
    accent: "#7f77dd",
    glyph: "🧭",
    size: "lg",
    description:
      "An all-in-one platform that lets independent coaches run their entire business from one place — CRM, subscriptions, contracts, courses, invoicing and community. Built on Next.js 16 with Supabase and Stripe.",
    highlights: [
      "Pipeline CRM with drag-and-drop deal stages and analytics",
      "Stripe-powered subscriptions, invoices and checkout",
      "E-signature contracts with a full audit trail",
      "Calendar, reminders and a live client dashboard",
    ],
    tech: ["Next.js 16", "React 19", "TypeScript", "Supabase", "Stripe", "Tailwind"],
    shots: [],
    links: [{ label: "Dashboard", href: "/dashboard" }],
  },
  {
    id: "stargazer",
    name: "Stargazer",
    tagline: "Real-time sky map in the browser",
    accent: "#4a89dc",
    glyph: "🔭",
    size: "md",
    description:
      "A WebGL planetarium that renders the night sky for any location and time. Pan across constellations, track satellites and set reminders for meteor showers.",
    highlights: [
      "60fps WebGL star rendering of 100k+ catalogued stars",
      "Geolocation-aware sky positioning",
      "Satellite and ISS pass predictions",
    ],
    tech: ["TypeScript", "WebGL", "Three.js", "Vite"],
    shots: [],
    links: [],
  },
  {
    id: "trailmix",
    name: "TrailMix",
    tagline: "Playlists that match your run",
    accent: "#3fae76",
    glyph: "🎧",
    size: "md",
    description:
      "A music app that builds playlists whose tempo tracks your running cadence in real time, speeding up on hills and easing off on the cooldown.",
    highlights: [
      "Cadence detection from the phone accelerometer",
      "BPM-matched track sequencing",
      "Offline-first sync for dead zones on the trail",
    ],
    tech: ["React Native", "Expo", "Web Audio API"],
    shots: [],
    links: [],
  },
  {
    id: "inkwell",
    name: "Inkwell",
    tagline: "A calmer place to write",
    accent: "#e0a458",
    glyph: "✍️",
    size: "sm",
    description:
      "A distraction-free markdown editor with local-first storage, version history and a focus mode that dims everything but the sentence you're writing.",
    highlights: [
      "Local-first storage with conflict-free sync",
      "Typewriter + focus modes",
      "Instant full-text search across notes",
    ],
    tech: ["Svelte", "IndexedDB", "CRDT"],
    shots: [],
    links: [],
  },
  {
    id: "flux",
    name: "Flux",
    tagline: "Home energy, visualized",
    accent: "#e2685f",
    glyph: "⚡",
    size: "md",
    description:
      "A dashboard that pulls from smart meters and solar inverters to show exactly where your household energy goes — and what it costs — hour by hour.",
    highlights: [
      "Live streaming meter data over MQTT",
      "Cost forecasting against tariff schedules",
      "Anomaly alerts for phantom loads",
    ],
    tech: ["Go", "Postgres", "MQTT", "D3"],
    shots: [],
    links: [],
  },
  {
    id: "pixelpush",
    name: "PixelPush",
    tagline: "Collaborative pixel canvas",
    accent: "#c56cd6",
    glyph: "🎨",
    size: "sm",
    description:
      "A shared pixel-art canvas where thousands of people draw together in real time. Every placement is broadcast to all viewers with sub-100ms latency.",
    highlights: [
      "WebSocket fan-out to thousands of clients",
      "Rate-limited placements with a cooldown timer",
      "Timelapse replay of the whole canvas history",
    ],
    tech: ["Rust", "WebSockets", "Redis", "Canvas"],
    shots: [],
    links: [],
  },
];
