import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname),
  // The VR study room is a static IWSDK build in public/vr (source: vr/). Serve it at /vr.
  async rewrites() {
    return [{ source: "/vr", destination: "/vr/index.html" }];
  },
};

export default nextConfig;
