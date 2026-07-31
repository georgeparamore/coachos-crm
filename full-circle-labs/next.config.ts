import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This project lives in a subfolder of the CoachOS repo, so pin the root
  // here — otherwise Next walks up to the parent lockfile and mis-detects the
  // workspace. When extracted to its own repo, this line is harmless.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
