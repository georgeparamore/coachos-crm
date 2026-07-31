import type { Metadata } from "next";
import "./portfolio.css";
import FullCircleLabs from "./portfolio";
import { COMPANY } from "./projects";

export const metadata: Metadata = {
  title: `${COMPANY.name} — Software studio`,
  description:
    "Full Circle Labs is a software studio. We design, build, and ship custom software, websites, and mobile apps — from first sketch to launch.",
};

export default function Page() {
  return <FullCircleLabs />;
}
