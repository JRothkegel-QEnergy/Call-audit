import type { NextConfig } from "next";

// Backend FastAPI para NEXT_PUBLIC_API_MODE=http. El navegador llama a /api/* en el mismo origen y Next lo reenvía.
const apiUrl = process.env.API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // cacheComponents queda apagado mientras el front sea 100 % cliente (sesión y datos en el navegador).
  // Reactivarlo cuando la sesión y los datos se rendericen en el servidor.
  // El indicador de desarrollo tapa la sidebar y la barra de acciones fija; los errores igual se muestran.
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
