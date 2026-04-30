const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Monorepo: avoid picking a parent folder lockfile as the tracing root (Next 15+).
  outputFileTracingRoot: path.join(__dirname, '..'),
  transpilePackages: ['@mall263/shared'],
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2592000, // 30 days — mobile uploads rarely change
    remotePatterns: [
      {
        // CDN edge URL — preferred, used by web uploads and mobile after the fix.
        protocol: 'https',
        hostname: 'mall263-uploads.lon1.cdn.digitaloceanspaces.com',
      },
      {
        // Subdomain-style S3 origin — kept for legacy compatibility.
        protocol: 'https',
        hostname: 'mall263-uploads.lon1.digitaloceanspaces.com',
      },
      {
        // Path-style S3 origin (lon1.digitaloceanspaces.com/bucket/key).
        // Mobile uploaded images were stored with this URL before the
        // seller-api.ts fix that switched to cdnUrl. Required so those
        // already-persisted images still render in the web app.
        protocol: 'https',
        hostname: 'lon1.digitaloceanspaces.com',
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
      {
        // Apple universal links — must be served as application/json without redirect
        source: '/.well-known/apple-app-site-association',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        // Android app links
        source: '/.well-known/assetlinks.json',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
