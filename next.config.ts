import type { NextConfig } from 'next';
const config: NextConfig = {
  reactStrictMode: true,
  experimental: { agentUpgrade: 'security' },
  output: 'export',
  poweredByHeader: false,
  images: { unoptimized: true },
};
export default config;
