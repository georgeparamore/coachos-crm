import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./node_modules/ffmpeg-static/ffmpeg"],
    "/api/discovery-calls/[id]": ["./node_modules/ffmpeg-static/ffmpeg"],
    "/api/zoom/webhook": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
};

export default withWorkflow(nextConfig);
