import type { NextConfig } from "next";

// umami is proxied same-origin: the tracker script and its beacon go
// through /u/* so no separate stats domain (or adblock DNS entry) is
// involved. UMAMI_INTERNAL_URL only resolves in-cluster; local dev 404s.
const UMAMI = process.env.UMAMI_INTERNAL_URL
  ?? "http://umami-ef0c79.umami.svc.cluster.local:3000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/u/:path*", destination: `${UMAMI}/:path*` },
      { source: "/api/send", destination: `${UMAMI}/api/send` },
    ];
  },
};

export default nextConfig;
