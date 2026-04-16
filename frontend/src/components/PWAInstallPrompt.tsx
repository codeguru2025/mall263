'use client';

import { useEffect, useRef, useState } from 'react';
import { LogoMark } from './Logo';
import { X, Download } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function PWAInstallPrompt() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  /** When true, show browser-menu instructions (Firefox, etc.). False = native Install or iOS steps. */
  const [androidManual, setAndroidManual] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (standalone) {
      setIsInstalled(true);
      return;
    }

    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed && Date.now() - parseInt(dismissed, 10) < 7 * 24 * 60 * 60 * 1000) return;

    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const android = /Android/i.test(ua);

    if (ios) {
      setIsIOS(true);
      setIsAndroid(false);
      const t = window.setTimeout(() => setShow(true), 4000);
      return () => window.clearTimeout(t);
    }

    setIsAndroid(android);

    const handler = (e: Event) => {
      e.preventDefault();
      const bip = e as BeforeInstallPromptEvent;
      deferredPromptRef.current = bip;
      setDeferredPrompt(bip);
      setAndroidManual(false);
      if (android) {
        // Upgrade manual banner to native install if prompt arrives after the 4s tick.
        setShow(true);
      } else {
        window.setTimeout(() => setShow(true), 4000);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    let androidTimer: number | undefined;
    if (android) {
      androidTimer = window.setTimeout(() => {
        const hasNative = !!deferredPromptRef.current;
        setAndroidManual(!hasNative);
        setShow(true);
      }, 4000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      if (androidTimer !== undefined) window.clearTimeout(androidTimer);
    };
  }, []);

  const handleInstall = async () => {
    const p = deferredPromptRef.current ?? deferredPrompt;
    if (!p) return;
    await p.prompt();
    const { outcome } = await p.userChoice;
    if (outcome === 'accepted') setShow(false);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  if (isInstalled || !show) return null;

  const showNativeInstall = !isIOS && !androidManual && !!(deferredPromptRef.current ?? deferredPrompt);

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
            ) : isAndroid && androidManual ? (
              <p className="text-white/70 text-xs mt-0.5">
                Add this site to your home screen — works like an app in any browser.
              </p>
            ) : (
              <p className="text-white/70 text-xs mt-0.5">Get the full app experience — quick access from your home screen</p>
            )}
          </div>
          {showNativeInstall && (
            <button
              type="button"
              onClick={handleInstall}
              className="flex-shrink-0 bg-brand-orange hover:bg-orange-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Install
            </button>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-shrink-0 p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>
        {isIOS && (
          <div className="bg-white/5 border-t border-white/10 px-4 py-3 flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-white/60 flex-wrap">
              <span>1. Tap</span>
              <span className="bg-white/10 px-2 py-1 rounded">⬆️ Share</span>
              <span>2. Scroll to</span>
              <span className="bg-white/10 px-2 py-1 rounded">➕ Add to Home Screen</span>
            </div>
          </div>
        )}
        {isAndroid && androidManual && (
          <div className="bg-white/5 border-t border-white/10 px-4 py-3 space-y-2 text-xs text-white/70 leading-relaxed">
            <p className="font-semibold text-white/90">Try your browser menu (⋮ or ≡):</p>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>
                <span className="text-white/90">Chrome / Edge / Brave:</span> Install app, or Add to Home screen
              </li>
              <li>
                <span className="text-white/90">Samsung Internet:</span> Menu → Add page to → Home screen
              </li>
              <li>
                <span className="text-white/90">Firefox:</span> Menu → Install, or Add to Home screen
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
