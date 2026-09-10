import React, { useState, useEffect } from 'react';
import { Download, X, Share2, PlusSquare } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function triggerPWAInstall() {
  window.dispatchEvent(new CustomEvent('splittrack:show-pwa-install'));
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // 1. Check if already installed / running standalone
    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standaloneMode);

    if (standaloneMode) return;

    // 2. Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua);
    // Exclude iOS Chrome/Firefox/CriOS which cannot install PWAs directly like Safari
    const isSafari = iosDevice && !/crios|fxios|opios|mercury/i.test(ua);
    setIsIOS(isSafari);

    // 3. Listen for Chromium/Android install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Check if user dismissed recently (within 3 days)
      const dismissedAt = localStorage.getItem('splittrack_pwa_dismissed');
      if (!dismissedAt || Date.now() - parseInt(dismissedAt, 10) > 3 * 24 * 60 * 60 * 1000) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If iOS Safari and not dismissed recently, show banner
    if (isSafari) {
      const dismissedAt = localStorage.getItem('splittrack_pwa_dismissed');
      if (!dismissedAt || Date.now() - parseInt(dismissedAt, 10) > 3 * 24 * 60 * 60 * 1000) {
        const timer = setTimeout(() => setShowBanner(true), 2500);
        return () => {
          clearTimeout(timer);
          window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
      }
    }

    // 4. Listen for manual trigger from Settings / Sidebar
    const handleManualTrigger = () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choice) => {
          if (choice.outcome === 'accepted') {
            setShowBanner(false);
            setDeferredPrompt(null);
          }
        });
      } else if (iosDevice) {
        setShowIOSModal(true);
      } else {
        setShowBanner(true);
      }
    };

    window.addEventListener('splittrack:show-pwa-install', handleManualTrigger);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('splittrack:show-pwa-install', handleManualTrigger);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setShowBanner(false);
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
      setShowBanner(false);
    } else {
      setShowIOSModal(true);
      setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('splittrack_pwa_dismissed', Date.now().toString());
  };

  if (isStandalone) {
    return null;
  }

  return (
    <>
      {/* Floating Install Banner */}
      {showBanner && (
        <aside
          aria-label="Install App"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
        >
          <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-2xl p-4 shadow-2xl shadow-black/80 flex items-center gap-3.5">
            <img
              src="/logo.webp"
              alt={APP_NAME}
              className="w-12 h-12 rounded-xl object-cover border border-zinc-700/50 shadow shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-white tracking-tight leading-snug">
                Install {APP_NAME}
              </h4>
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                Fast home-screen access & full screen.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="px-3 py-1.5 bg-[#C9FF55] hover:bg-[#b8f043] text-black font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded transition-colors cursor-pointer"
                >
                  Not now
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="w-7 h-7 -mr-1 -mt-5 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {/* iOS Safari "Add to Home Screen" Instructions Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.webp"
                  alt={APP_NAME}
                  className="w-12 h-12 rounded-xl object-cover border border-zinc-800 shadow"
                />
                <div>
                  <h3 className="text-lg font-semibold text-white">Install {APP_NAME}</h3>
                  <p className="text-xs text-zinc-400">Add to Home Screen on your device</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 py-1">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[#C9FF55] shrink-0 font-bold text-xs">
                  1
                </div>
                <div className="text-xs sm:text-sm text-zinc-300 flex-1">
                  Tap the <span className="font-semibold text-white">Share</span> button in Safari&apos;s bottom bar
                  <Share2 className="inline w-4 h-4 ml-1.5 text-zinc-300 align-text-bottom" />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[#C9FF55] shrink-0 font-bold text-xs">
                  2
                </div>
                <div className="text-xs sm:text-sm text-zinc-300 flex-1">
                  Scroll down and tap <span className="font-semibold text-white">Add to Home Screen</span>
                  <PlusSquare className="inline w-4 h-4 ml-1.5 text-zinc-300 align-text-bottom" />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[#C9FF55] shrink-0 font-bold text-xs">
                  3
                </div>
                <div className="text-xs sm:text-sm text-zinc-300 flex-1">
                  Tap <span className="font-semibold text-white">Add</span> in the top right corner to finish!
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full py-3 bg-[#C9FF55] hover:bg-[#b8f043] text-black font-semibold rounded-xl text-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
