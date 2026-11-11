import React from 'react';
import { WifiOff, CloudUpload, RefreshCw } from 'lucide-react';

interface OfflineIndicatorProps {
  isOnline: boolean;
  unsyncedCount: number;
  isSyncing: boolean;
  onSync: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOnline,
  unsyncedCount,
  isSyncing,
  onSync,
}) => {
  if (isOnline && unsyncedCount === 0) {
    return null;
  }

  return (
    <aside aria-label="Connectivity and sync status" className="fixed bottom-4 left-4 z-40 flex items-center gap-2.5 rounded-lg border border-slate-700/80 bg-[#0a1017]/95 px-3.5 py-2 text-xs font-medium text-slate-200 shadow-xl backdrop-blur-md">
      {!isOnline ? (
        <>
          <div className="flex items-center gap-1.5 text-amber-400">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline Field Mode</span>
          </div>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span className="text-slate-300">
            {unsyncedCount} {unsyncedCount === 1 ? 'breadcrumb' : 'breadcrumbs'} queued in Dexie
          </span>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CloudUpload className="w-3.5 h-3.5" />
            <span>Online</span>
          </div>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span className="text-slate-300">
            {unsyncedCount} unsynced points pending
          </span>
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 border border-emerald-500/40 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </>
      )}
    </aside>
  );
};
