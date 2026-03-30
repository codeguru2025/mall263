'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { LogoMark } from '@/components/Logo';
import BottomNav from '@/components/BottomNav';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,
      gcTime: 300000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-navy-700">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-white/10 blur-xl scale-110" />
          <div className="relative bg-white/10 rounded-3xl p-5">
            <LogoMark size={80} />
          </div>
        </div>
        <div className="text-center">
          <div className="flex items-baseline gap-0.5">
            <span className="text-white font-black text-4xl tracking-tight">MALL</span>
            <span className="font-black text-4xl tracking-tight">
              <span className="text-brand-green">2</span>
              <span className="text-brand-orange">6</span>
              <span className="text-brand-red">3</span>
            </span>
          </div>
          <p className="text-white/60 text-sm mt-1 font-medium">Find it. Bid on it. Collect it.</p>
        </div>
        <div className="flex gap-1.5 mt-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-white/40"
              style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AuthLoader({ children }: { children: React.ReactNode }) {
  const loadUser = useAuthStore((s) => s.loadUser);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  if (isLoading) return <SplashScreen />;

  return <>{children}</>;
}

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Mall263 — Find it. Bid on it. Collect it.</title>
        <meta name="description" content="Zimbabwe's marketplace connecting buyers with sellers across the country. Post demands, get live offers from sellers, and collect your items in person." />
        <meta name="keywords" content="Zimbabwe marketplace, buy and sell Zimbabwe, Harare shopping, online market Zimbabwe, demands marketplace, Mall263" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://mall263.com" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Mall263" />
        <meta property="og:title" content="Mall263 — Find it. Bid on it. Collect it." />
        <meta property="og:description" content="Zimbabwe's marketplace connecting buyers with sellers. Post what you need, get live offers, collect in person." />
        <meta property="og:url" content="https://mall263.com" />
        <meta property="og:image" content="https://mall263.com/icons/icon-512.png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:locale" content="en_ZW" />

        {/* Twitter / X */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Mall263 — Find it. Bid on it. Collect it." />
        <meta name="twitter:description" content="Zimbabwe's marketplace. Post demands, get live offers from sellers, collect in person." />
        <meta name="twitter:image" content="https://mall263.com/icons/icon-512.png" />

        {/* Viewport */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />

        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1B2A4A" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* iOS PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Mall263" />
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png" />

        {/* Favicon */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/icons/icon-96.png" sizes="96x96" type="image/png" />
        <link rel="shortcut icon" href="/icons/icon-96.png" />

        {/* MS Tiles */}
        <meta name="msapplication-TileColor" content="#1B2A4A" />
        <meta name="msapplication-TileImage" content="/icons/icon-144.png" />

        {/* JSON-LD — Organization + WebSite */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'Organization',
                '@id': 'https://mall263.com/#organization',
                name: 'Mall263',
                url: 'https://mall263.com',
                logo: 'https://mall263.com/icons/icon-512.png',
                contactPoint: {
                  '@type': 'ContactPoint',
                  telephone: '+263-77-366-5350',
                  contactType: 'customer service',
                  areaServed: 'ZW',
                  availableLanguage: 'English',
                },
                sameAs: [],
              },
              {
                '@type': 'WebSite',
                '@id': 'https://mall263.com/#website',
                url: 'https://mall263.com',
                name: 'Mall263',
                description: "Zimbabwe's marketplace connecting buyers with sellers.",
                publisher: { '@id': 'https://mall263.com/#organization' },
                potentialAction: {
                  '@type': 'SearchAction',
                  target: 'https://mall263.com/marketplace?q={search_term_string}',
                  'query-input': 'required name=search_term_string',
                },
              },
            ],
          })}}
        />
      </head>
      <body className={`${inter.className} font-sans`}>
        <QueryClientProvider client={queryClient}>
          <AuthLoader>
            {children}
            <BottomNav />
            <PWAInstallPrompt />
          </AuthLoader>
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3500,
              style: { borderRadius: '14px', fontWeight: '600', fontSize: '14px', maxWidth: '340px' },
            }}
          />
        </QueryClientProvider>
      </body>
    </html>
  );
}
