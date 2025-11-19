import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configurazione sperimentale
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Proxy gestito da middleware.ts

  // Configurazione webpack per polling in ambienti con problemi di HMR
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    // ✅ Aggiungi regola per gestire i file SVG come componenti React
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
};

export default nextConfig;
    