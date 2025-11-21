/** @type {import('next').NextConfig} */
import path from 'path';

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: ['*']
    }
  },
  // Configure path resolution for deployment
  transpilePackages: [],
  webpack: (config, { isServer }) => {
    // Ensure path resolution works in deployment
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve('./'),
      '@/lib': path.resolve('./lib'),
      '@/components': path.resolve('./components'),
      '@/app': path.resolve('./app')
    };
    return config;
  }
};

export default nextConfig;


