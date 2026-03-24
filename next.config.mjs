/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type checking runs during `tsc --noEmit` locally and in pre-push hooks.
    // Disabled here to prevent OOM / timeout kills during Docker builds on
    // resource-constrained CI containers (exit code 255 = container killed).
    ignoreBuildErrors: true,
  },
  // Next.js 14 syntax for external packages (not bundled by webpack)
  experimental: {
    serverComponentsExternalPackages: ["puppeteer", "puppeteer-core", "@sparticuz/chromium"],
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/api/public/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
};

export default nextConfig;
