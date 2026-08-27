import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Desactivado temporalmente para diagnosticar un bug donde el onboarding
  // pierde su estado interno a mitad de flujo — sospecha de que el doble
  // mount/unmount de StrictMode en dev interactúa mal con el useRef que
  // evita el auto-redirect prematuro en /app/page.tsx.
  reactStrictMode: false,

  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [
      {
        source: "/api/cron/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
    ];
  },
};

export default nextConfig;