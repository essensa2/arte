/** @type {import('next').NextConfig} */
import path from 'path';
import withPWA from 'next-pwa';

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

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],
});

export default pwaConfig(nextConfig);


