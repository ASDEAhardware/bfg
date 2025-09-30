import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configurazione sperimentale
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Forza polling in ambienti con problemi di HMR
  webpackDevMiddleware: (config: any) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    };
    return config;
  },
};

export default nextConfig;
    