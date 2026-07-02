/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required for Docker production build:
  // Generates .next/standalone so the Dockerfile production stage can copy it
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  },
};

module.exports = nextConfig;
