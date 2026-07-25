import type { Metadata } from "next";
import "./portfolio.css";
import Portfolio from "./portfolio";
import { OWNER } from "./projects";

export const metadata: Metadata = {
  title: `${OWNER.name} — Projects in Space`,
  description:
    "A space-themed portfolio of programs, websites and things I've built. Each project floats as a window — click one to explore screenshots and details.",
};

export default function PortfolioPage() {
  return <Portfolio />;
}
