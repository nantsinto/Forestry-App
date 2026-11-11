import { useEffect, useState, useCallback } from 'react';
import { db } from '../services/db';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [unsyncedCount, setUnsyncedCount] = useState<number>(0);

  const refreshUnsyncedCount = useCallback(async () => {
    try {
      const count = await db.breadcrumbs.where('synced').equals(0).count();
      setUnsyncedCount(count);
    } catch {
      // ignore
    }
  }, []);

  const syncQueueToCloud = useCallback(async () => {
    try {
      setIsSyncing(true);
      const unsynced = await db.breadcrumbs.where('synced').equals(0).toArray();
      if (unsynced.length > 0) {
        // Simulate network upload latency to Supabase / Backend Cloud
        await new Promise((resolve) => setTimeout(resolve, 800));
        const ids = unsynced.map((item) => item.id!).filter(Boolean);
        await db.breadcrumbs.where('id').anyOf(ids).modify({ synced: 1 });
      }
      setLastSyncTime(new Date());
      await refreshUnsyncedCount();
    } catch (err) {
      console.warn('[Sync Paused] Network unreachable or Dexie busy:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [refreshUnsyncedCount]);

  useEffect(() => {
    refreshUnsyncedCount();

    const handleOnline = () => {
      setIsOnline(true);
      syncQueueToCloud();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(refreshUnsyncedCount, 4000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshUnsyncedCount, syncQueueToCloud]);

  return {
    isOnline,
    isSyncing,
    lastSyncTime,
    unsyncedCount,
    syncQueueToCloud,
    refreshUnsyncedCount,
  };
}
