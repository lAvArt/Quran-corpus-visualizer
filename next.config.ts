import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin(
  './i18n/request.ts'
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    // One canonical host. The project answered on three (the legacy
    // quran.pluragate.org, the .com twin, and .org), each serving a full copy —
    // duplicate content for crawlers, and a different `location.origin` for
    // every visitor, which is what broke OAuth: Supabase only allow-lists
    // callbacks it has been told about. Everything funnels to www.…org.
    const canonical = "https://www.quranobservatory.org";
    const aliases = ["quran.pluragate.org", "quranobservatory.com", "www.quranobservatory.com"];
    return aliases.map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: `${canonical}/:path*`,
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        // Embed routes: allow framing from anywhere
        source: "/embed/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
      {
        // All other routes: prevent framing
        source: "/((?!embed).*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
