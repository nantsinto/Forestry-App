import React from 'react';
import { PWAInstallButton } from './PWAInstallButton';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export type NavTab = 'audit' | 'gis' | 'brain' | 'queue' | 'apk';

interface TopNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isOnline: boolean;
  isSyncing: boolean;
  unsyncedCount: number;
  onSync: () => void;
  onEmergencyBroadcast: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onTabChange,
  isOnline,
  isSyncing,
  unsyncedCount,
  onSync,
  onEmergencyBroadcast,
}) => {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-8 px-6 py-3.5 bg-[#05070a]/90 backdrop-blur-md border-b border-slate-800/80">
      {/* Zone 1: Single text wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => onTabChange('audit')}
          className="text-lg font-bold tracking-tight text-white hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 text-left"
        >
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm transform rotate-45 inline-block" />
          SilvaeGuard
        </button>
      </div>

      {/* Zone 2: 4-5 clean single-line nav links */}
      <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-slate-400">
        <button
          onClick={() => onTabChange('audit')}
          className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 ${
            activeTab === 'audit'
              ? 'text-white border-b-2 border-emerald-500 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          Operations Audit
        </button>

        <button
          onClick={() => onTabChange('gis')}
          className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 ${
            activeTab === 'gis'
              ? 'text-white border-b-2 border-emerald-500 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          GIS Telemetry
        </button>

        <button
          onClick={() => onTabChange('brain')}
          className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 ${
            activeTab === 'brain'
              ? 'text-white border-b-2 border-emerald-500 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          Central Brain
        </button>

        <button
          onClick={() => onTabChange('queue')}
          className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 flex items-center gap-1.5 ${
            activeTab === 'queue'
              ? 'text-white border-b-2 border-emerald-500 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          <span>Offline Queue</span>
          {unsyncedCount > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] font-mono bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
              {unsyncedCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('apk')}
          className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 ${
            activeTab === 'apk'
              ? 'text-white border-b-2 border-emerald-500 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          Native APK
        </button>
      </nav>

      {/* Zone 3: 1 primary action area */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Quick cloud sync status */}
        <button
          onClick={onSync}
          disabled={isSyncing || !isOnline}
          className={`p-1.5 rounded-md border text-xs transition-colors hidden sm:flex items-center gap-1.5 ${
            !isOnline
              ? 'border-slate-800 text-slate-500 cursor-not-allowed'
              : unsyncedCount > 0
              ? 'border-amber-700/60 bg-amber-950/40 text-amber-300 hover:bg-amber-900/40'
              : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
          title={isOnline ? 'Sync local Dexie telemetry to cloud' : 'Offline - queue buffered'}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
          <span className="font-mono text-[11px] hidden lg:inline">
            {isSyncing ? 'Syncing...' : unsyncedCount > 0 ? `${unsyncedCount} Unsynced` : 'Synced'}
          </span>
        </button>

        {/* Emergency Broadcast alert trigger */}
        <button
          onClick={onEmergencyBroadcast}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-300 bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/60 rounded-md transition-colors whitespace-nowrap shrink-0"
          title="Trigger emergency forestry alert"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden sm:inline">Broadcast Alert</span>
        </button>

        {/* PWA Install Button */}
        <PWAInstallButton />
      </div>
    </header>
  );
};
