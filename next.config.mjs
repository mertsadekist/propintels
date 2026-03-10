/** @type {import('next').NextConfig} */
const nextConfig = {
  // ⚠️ "standalone" removed — incompatible with Hostinger managed Node.js hosting
  // Hostinger expects: next build → next start  (standard mode)

  serverExternalPackages: ["puppeteer", "puppeteer-core", "@sparticuz/chromium"],

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
