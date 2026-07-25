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
    id: "osrs",
    name: "OSRS Tools & Plugins",
    tagline: "Plugins and web tools for Old School RuneScape",
    accent: "#e0a458",
    glyph: "⚔️",
    size: "lg",
    description:
      "A whole body of work around Old School RuneScape — a family of RuneLite plugins written in Java plus a suite of standalone web tools. Everything is built to run entirely on your own machine: the plugins never leave the game client, and the web tools are dependency-free HTML that pull live prices straight from the RuneScape Wiki API.",
    highlights: [
      "Instant Replay — a ShadowPlay-style clip recorder that keeps a rolling buffer of gameplay and auto-saves clips on personal bests, valuable drops and collection-log slots",
      "GE Trade Logger — logs every Grand Exchange fill and matches buys to sells (FIFO) to track flip profit over time, tax included",
      "Live-chat side panels that embed Twitch, Kick and YouTube stream chat directly inside the RuneLite client",
      "An in-client offline translation plugin",
      "OSRS Tool Suite — GE price tracker, skill-profit calculator, and farming / herblore / prayer / construction training planners",
    ],
    tech: ["Java", "RuneLite API", "Gradle", "HTML/CSS/JS", "RuneScape Wiki API"],
    shots: [],
    links: [
      { label: "Instant Replay", href: "https://github.com/georgeparamore/instant-replay" },
      { label: "GE Trade Logger", href: "https://github.com/georgeparamore/ge-trade-logger" },
      { label: "OSRS Tool Suite", href: "https://github.com/georgeparamore/osrs-planner-suite" },
      { label: "All repos", href: "https://github.com/georgeparamore" },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // TODO: two local projects to flesh out from George's description —
  // the screen-recorder app and the "Crystal" macOS app. Placeholder copy
  // below; replace description / highlights / tech / links once confirmed.
  // ───────────────────────────────────────────────────────────────────────
  {
    id: "screen-recorder",
    name: "Screen Recorder",
    tagline: "Desktop screen recording app",
    accent: "#e2685f",
    glyph: "🎬",
    size: "md",
    description:
      "A desktop screen-recording application. (Details to be filled in — this project lives locally and isn't on GitHub yet.)",
    highlights: [],
    tech: [],
    shots: [],
    links: [],
  },
  {
    id: "crystal",
    name: "Crystal",
    tagline: "macOS app",
    accent: "#4a89dc",
    glyph: "💎",
    size: "md",
    description:
      "A macOS application. (Details to be filled in — this project lives locally on Mac and isn't on GitHub yet.)",
    highlights: [],
    tech: [],
    shots: [],
    links: [],
  },
];
