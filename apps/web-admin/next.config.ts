import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    // Monorepo pnpm: resolver dependencias desde la raíz del workspace
    root: path.join(__dirname, '../..'),
  },
};

export default nextConfig;
