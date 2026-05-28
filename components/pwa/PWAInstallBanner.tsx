'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!prompt || dismissed) return null;

  const handleInstall = async () => {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setDismissed(true);
    }
  };

  return (
    <div className="fixed bottom-20 inset-x-4 sm:bottom-6 sm:left-auto sm:right-6 sm:w-80 z-50">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 flex items-center gap-3">
        <span className="text-2xl shrink-0">💰</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Add to Home Screen</p>
          <p className="text-xs text-gray-500">Quick access to your dashboard</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => setDismissed(true)}
            className="text-xs text-gray-400 px-2 py-1 rounded-lg hover:bg-gray-50"
          >
            Not now
          </button>
          <button
            onClick={handleInstall}
            className="text-xs font-semibold bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
