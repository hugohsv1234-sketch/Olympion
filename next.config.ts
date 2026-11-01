import type { NextConfig } from 'next';
const config: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  poweredByHeader: false,
  images: { unoptimized: true },
};
export default config;
