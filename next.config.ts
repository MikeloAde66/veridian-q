import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // /public files (like draw-engine.js) are plain static assets with no
  // content hash in their filename, so both browsers and Vercel's edge cache
  // are free to keep serving an old cached copy even after a brand new
  // deploy goes live -- which is exactly what happened: the preset fix
  // shipped, but the browser kept running yesterday's draw-engine.js.
  // Forcing revalidation on every request closes that gap for good.
  async headers() {
    return [
      {
        source: '/draw-engine.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
