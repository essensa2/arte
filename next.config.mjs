/** @type {import('next').NextConfig} */
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
      '@': './'
    };
    return config;
  }
};

export default nextConfig;


