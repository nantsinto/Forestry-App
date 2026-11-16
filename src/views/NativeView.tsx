import React from 'react';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { Smartphone, HardDrive, Package } from 'lucide-react';

/**
 * Native shell status. Kept deliberately factual: the PWA is installable today, a store
 * binary is not built.
 */
export const NativeView: React.FC = () => (
  <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
    <div className="rounded-lg border border-slate-800 bg-[#0a1017] p-6">
      <div className="mb-1 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-emerald-400">
        <Smartphone className="h-4 w-4" />
        <span>Device deployment</span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-white">Native shell</h1>
      <p className="mt-1 max-w-2xl text-xs text-slate-400">
        The app shell, fonts and workbox precache are already offline-capable, so the same build installs to a
        home screen today.
      </p>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-lg border border-slate-800 bg-[#0a1017] p-5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
          <HardDrive className="h-3.5 w-3.5 text-emerald-400" />
          Installable today
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          Add to home screen from the browser. Field data is stored locally, so the app opens and captures with no
          signal.
        </p>
        <div className="mt-3">
          <PWAInstallButton />
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-[#0a1017] p-5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
          <Package className="h-3.5 w-3.5 text-amber-400" />
          Store binary — not built
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          An APK / iOS build needs a native wrapper (Capacitor or similar) with camera and Bluetooth permissions
          for calipers. That is packaging work, and nothing here claims it exists yet.
        </p>
      </div>
    </div>
  </div>
);
