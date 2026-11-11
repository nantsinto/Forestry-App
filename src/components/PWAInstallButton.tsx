import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, CheckCircle2 } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 rounded-md">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">PWA Installed</span>
      </div>
    );
  }

  if (isInstallable) {
    return (
      <>
        <button
          onClick={async () => {
            const success = await install();
            if (success) {
              setInstalledSuccess(true);
            }
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-all shadow-sm shadow-emerald-900/30 whitespace-nowrap shrink-0 active:scale-95"
          title="Install SilvaeGuard as Progressive Web App"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>

        {installedSuccess && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-950 border border-emerald-700 text-emerald-100 px-4 py-2 rounded-lg shadow-xl text-xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>SilvaeGuard installed to your device successfully.</span>
          </div>
        )}
      </>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
          <span>Install (iOS)</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-xl bg-[#0a1017] border border-slate-800 p-6 shadow-2xl text-slate-100 relative">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                Install SilvaeGuard on iOS
              </h3>
              <p className="mt-3 text-xs leading-relaxed text-slate-300">
                1. Tap the <strong className="text-white">Share</strong> icon in Safari's bottom toolbar.<br />
                2. Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.<br />
                3. Open SilvaeGuard directly from your home screen for offline field capability.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-md bg-emerald-600 hover:bg-emerald-500 py-2 text-xs font-medium text-white transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
