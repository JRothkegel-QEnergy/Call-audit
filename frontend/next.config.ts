import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents queda apagado mientras el front sea 100 % cliente (sesión y datos mock en el navegador).
  // Reactivarlo cuando la sesión y los datos vengan del backend y se rendericen en el servidor.
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
};

export default nextConfig;
