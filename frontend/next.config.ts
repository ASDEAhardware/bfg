import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configurazione sperimentale
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Configurazione webpack per polling in ambienti con problemi di HMR
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default nextConfig;
    