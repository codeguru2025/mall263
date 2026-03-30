import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/marketplace', '/demands', '/auth/login', '/auth/register'],
        disallow: [
          '/dashboard',
          '/wallet/',
          '/pos',
          '/inventory/',
          '/admin',
          '/notifications',
          '/api/',
        ],
      },
    ],
    sitemap: 'https://mall263.com/sitemap.xml',
  };
}
