import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/discovery-calls/[id]": ["./node_modules/ffmpeg-static/ffmpeg"],
    "/api/zoom/webhook": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
};

export default nextConfig;
