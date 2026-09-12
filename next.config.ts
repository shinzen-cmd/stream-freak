import type { NextConfig } from "next";

const isExport = process.env.NEXT_EXPORT === "true";

const nextConfig: NextConfig = {
  ...(isExport ? { output: "export" as const } : {}),
  images: {
    // Keep unoptimized for Capacitor static export compatibility
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "artworks.thetvdb.com" },
      { protocol: "https", hostname: "via.placeholder.com" },
      { protocol: "https", hostname: "cdn.myanimelist.net" },
      { protocol: "https", hostname: "media.kitsu.app" },
      { protocol: "https", hostname: "media.kitsu.io" },
      { protocol: "https", hostname: "kitsu.io" },
    ],
  },

  // Performance: remove debug logs but preserve errors and warnings in production
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  ...(isExport
    ? {}
    : {
        async headers() {
          return [
            {
              source: "/api/:path*",
              headers: [
                { key: "Access-Control-Allow-Origin", value: "*" },
                { key: "Access-Control-Allow-Methods", value: "GET, HEAD, OPTIONS, POST, PUT, DELETE" },
                { key: "Access-Control-Allow-Headers", value: "*" },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
