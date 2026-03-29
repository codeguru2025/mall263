'use client';

import { useEffect, useState } from 'react';
import { LogoMark } from './Logo';
import { X, Download } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently (within 7 days)
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    // iOS detection
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;
    if (ios) {
      setIsIOS(true);
      setTimeout(() => setShow(true), 4000);
      return;
    }

    // Android/Chrome — listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
      setTimeout(() => setShow(true), 4000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') setShow(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  if (isInstalled || !show) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 z-[9998] animate-slide-up">
      <div className="bg-navy-700 text-white rounded-2xl shadow-2xl shadow-navy-900/50 overflow-hidden max-w-sm mx-auto">
        <div className="flex items-center gap-4 p-4">
          <div className="bg-white/10 rounded-xl p-2 flex-shrink-0">
            <LogoMark size={40} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm">Install Mall263</p>
            {isIOS ? (
              <p className="text-white/70 text-xs mt-0.5">
                Tap <span className="inline-block">⬆️</span> then <strong>Add to Home Screen</strong>
              </p>
            ) : (
              <p className="text-white/70 text-xs mt-0.5">Get the full app experience — works offline</p>
            )}
          </div>
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="flex-shrink-0 bg-brand-orange hover:bg-orange-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Install
            </button>
          )}
          <button onClick={handleDismiss} className="flex-shrink-0 p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>
        {isIOS && (
          <div className="bg-white/5 border-t border-white/10 px-4 py-3 flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-white/60">
              <span>1. Tap</span>
              <span className="bg-white/10 px-2 py-1 rounded">⬆️ Share</span>
              <span>2. Scroll to</span>
              <span className="bg-white/10 px-2 py-1 rounded">➕ Add to Home Screen</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
