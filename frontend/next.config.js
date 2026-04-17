const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Monorepo: avoid picking a parent folder lockfile as the tracing root (Next 15+).
  outputFileTracingRoot: path.join(__dirname, '..'),
  transpilePackages: ['@mall263/shared'],
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mall263-uploads.lon1.digitaloceanspaces.com',
      },
      {
        protocol: 'https',
        hostname: 'mall263-uploads.lon1.cdn.digitaloceanspaces.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ];
  },
};

module.exports = nextConfig;
