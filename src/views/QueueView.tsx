import React, { useCallback, useEffect, useState } from 'react';
import { db, BreadcrumbRecord, PassportEventRecord, TimberPassportRecord } from '../services/db';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface QueueViewProps {
  isOnline: boolean;
  isSyncing: boolean;
  onSync: () => Promise<void>;
}

/**
 * Everything captured in the field lives here first. This is the view a crew supervisor
 * opens at the yard to confirm nothing was lost before the device connects.
 */
export const QueueView: React.FC<QueueViewProps> = ({ isOnline, isSyncing, onSync }) => {
  const [crumbs, setCrumbs] = useState<BreadcrumbRecord[]>([]);
  const [passports, setPassports] = useState<TimberPassportRecord[]>([]);
  const [events, setEvents] = useState<PassportEventRecord[]>([]);

  const load = useCallback(async () => {
    const [unsyncedCrumbs, unsyncedPassports, unsyncedEvents] = await Promise.all([
      db.breadcrumbs.where('synced').equals(0).toArray(),
      db.passports.where('synced').equals(0).toArray(),
      db.passportEvents.where('synced').equals(0).toArray(),
    ]);
    setCrumbs(unsyncedCrumbs);
    setPassports(unsyncedPassports);
    setEvents(unsyncedEvents);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [load, isSyncing]);

  const total = crumbs.length + passports.length + events.length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-[#0a1017] p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-emerald-400">
            <RefreshCw className="h-4 w-4" />
            <span>Offline queue</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Pending upload</h1>
          <p className="mt-1 max-w-xl text-xs text-slate-400">
            Field captures are written to the device first and only uploaded when a connection is available.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] ${
              isOnline ? 'border-emerald-800/70 bg-emerald-950/50 text-emerald-300' : 'border-amber-800/70 bg-amber-950/40 text-amber-300'
            }`}
          >
            {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {isOnline ? 'Online' : 'Offline field mode'}
          </span>
          <button
            onClick={() => onSync()}
            disabled={isSyncing || !isOnline}
            data-testid="queue-sync-btn"
            className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Uploading…' : 'Sync now'}</span>
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Breadcrumbs" value={crumbs.length} />
        <Stat label="Passports" value={passports.length} />
        <Stat label="Custody events" value={events.length} />
      </div>

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-800 bg-[#0a1017] p-10 text-center text-sm text-slate-400">
          Nothing pending — every capture on this device has been uploaded.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-[#0a1017]">
          <ul className="divide-y divide-slate-800/70 text-xs">
            {passports.map((p) => (
              <li key={`p-${p.passportId}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="font-mono text-slate-200">{p.passportId}</span>
                <span className="text-slate-500">{p.speciesName} · {p.blockId}</span>
                <span className="font-mono text-[10px] text-slate-600">{p.createdAt.slice(0, 16).replace('T', ' ')}</span>
              </li>
            ))}
            {events.map((e) => (
              <li key={`e-${e.passportId}-${e.seq}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="font-mono text-slate-200">
                  {e.passportId} #{e.seq}
                </span>
                <span className="capitalize text-slate-500">{e.type}</span>
                <span className="font-mono text-[10px] text-slate-600">{e.timestamp.slice(0, 16).replace('T', ' ')}</span>
              </li>
            ))}
            {crumbs.slice(-25).reverse().map((c) => (
              <li key={`c-${c.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="font-mono text-slate-300">
                  {c.latitude.toFixed(5)}, {c.longitude.toFixed(5)}
                </span>
                <span className="text-slate-500">±{c.accuracy}m · {c.canopyDensity}</span>
                <span className="font-mono text-[10px] text-slate-600">{c.timestamp.slice(0, 16).replace('T', ' ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-lg border border-slate-800 bg-[#0a1017] p-4">
    <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className="mt-1 font-mono text-lg font-semibold text-white">{value}</div>
  </div>
);
