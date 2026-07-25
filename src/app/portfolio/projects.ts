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
    links: [],
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
    links: [],
  },

  // ───────────────────────────────────────────────────────────────────────
  // TODO: two local projects to flesh out from George's description —
  // the screen-recorder app and the "Crystal" macOS app. Placeholder copy
  // below; replace description / highlights / tech / links once confirmed.
  // ───────────────────────────────────────────────────────────────────────
  {
    id: "screen-recorder",
    name: "Screen Recorder",
    tagline: "A Streamlabs-style recorder for games and desktop",
    accent: "#e2685f",
    glyph: "🎬",
    size: "lg",
    description:
      "A Windows screen and game recorder built with WPF and .NET 9, styled after Streamlabs. Capture your display, a game window, a screen region or webcam, arrange scenes with layered sources, mix your audio, and record hardware-encoded H.264 MP4 — backed by a replay buffer, a trim editor, and one-click export presets for Discord and YouTube.",
    highlights: [
      "Scenes & sources — layered, reorderable captures (display, window, region, webcam, image/GIF overlays) switchable by global hotkey",
      "Audio mixer with per-channel input/output devices, gain, mute and live peak meters",
      "Replay buffer — keep the last N minutes and save a clip on demand (ShadowPlay-style, F10)",
      "Hardware-encoded H.264 MP4 recording via the GPU, with pause/resume and a 3-2-1 countdown",
      "Trim editor plus export presets that compress clips to fit Discord (10/25/50 MB) or YouTube",
      "Always-on-top Game Bar overlay and fully rebindable global hotkeys",
    ],
    tech: ["C#", ".NET 9", "WPF", "FFmpeg", "ScreenRecorderLib", "NAudio"],
    shots: [],
    links: [],
  },
  {
    id: "crystal",
    name: "Crystal Identifier",
    tagline: "Point your camera at a rock, find out what it is",
    accent: "#4a89dc",
    glyph: "💎",
    size: "md",
    description:
      "An iPhone app that identifies rocks and crystals from a photo. Snap a picture of a specimen and it recognizes what it is — turning your camera into a pocket geologist.",
    highlights: [
      "Camera capture — take a photo of any rock or crystal to identify it",
      "Recognizes the specimen and tells you what it is",
    ],
    tech: ["iOS"],
    shots: [],
    links: [],
  },
];
