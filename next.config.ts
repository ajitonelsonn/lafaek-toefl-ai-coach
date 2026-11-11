import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname),
  // /vr is the VR landing page (app/vr). The 3D room is a static IWSDK build in public/vr/room
  // (source: vr/), served at /vr/room.
  async rewrites() {
    return [{ source: "/vr/room", destination: "/vr/room/index.html" }];
  },
};

export default nextConfig;
