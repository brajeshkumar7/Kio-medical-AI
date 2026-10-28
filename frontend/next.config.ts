import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/favicon.png",
        destination: "/favicon.ico",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
