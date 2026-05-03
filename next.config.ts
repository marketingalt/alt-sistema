import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "img.clerk.com" },
      { hostname: "images.clerk.dev" },
      { hostname: "cdn.xbzbrindes.com.br" },
    ],
  },
};

export default nextConfig;
