import React, { useEffect, useMemo, useState } from 'react';
import { db, BreadcrumbRecord, TimberPassportRecord } from '../services/db';
import { useForestryTracking } from '../hooks/useForestryTracking';
import { Compass, Footprints, MapPin, Play, Square, WifiOff } from 'lucide-react';

interface Point {
  latitude: number;
  longitude: number;
}

const WIDTH = 880;
const HEIGHT = 460;
const PADDING = 40;

/**
 * Plot survey map.
 *
 * Drawn from the local Dexie ledger as SVG — no map tiles, no network request — so it
 * stays usable in a plantation with no signal, which is the whole point of the app.
 */
export const GisView: React.FC = () => {
  const { isTracking, trackingMode, setTrackingMode, currentPosition, totalRecorded, startTracking, stopTracking, triggerSingleBreadcrumb } =
    useForestryTracking();
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbRecord[]>([]);
  const [passports, setPassports] = useState<TimberPassportRecord[]>([]);

  useEffect(() => {
    const load = async () => {
      const [crumbs, records] = await Promise.all([
        db.breadcrumbs.orderBy('id').toArray(),
        db.passports.toArray(),
      ]);
      setBreadcrumbs(crumbs);
      setPassports(records);
    };
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, []);

  const bounds = useMemo(() => {
    const all: Point[] = [
      ...breadcrumbs.map((b) => ({ latitude: b.latitude, longitude: b.longitude })),
      ...passports.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    ];
    if (all.length === 0) {
      return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
    }
    const lats = all.map((p) => p.latitude);
    const lngs = all.map((p) => p.longitude);
    const padLat = Math.max((Math.max(...lats) - Math.min(...lats)) * 0.18, 0.0015);
    const padLng = Math.max((Math.max(...lngs) - Math.min(...lngs)) * 0.18, 0.0015);
    return {
      minLat: Math.min(...lats) - padLat,
      maxLat: Math.max(...lats) + padLat,
      minLng: Math.min(...lngs) - padLng,
      maxLng: Math.max(...lngs) + padLng,
    };
  }, [breadcrumbs, passports]);

  const project = (point: Point) => {
    const x = ((point.longitude - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * (WIDTH - PADDING * 2) + PADDING;
    const y = HEIGHT - (((point.latitude - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * (HEIGHT - PADDING * 2) + PADDING);
    return { x, y };
  };

  const trail = breadcrumbs.map((b) => project(b)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const live = project({ latitude: currentPosition.latitude, longitude: currentPosition.longitude });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-[#0a1017] p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-emerald-400">
            <Compass className="h-4 w-4" />
            <span>Offline plot survey</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">GIS Telemetry</h1>
          <p className="mt-1 max-w-xl text-xs text-slate-400">
            Rendered entirely from data already on this device — no tiles are fetched, so the map keeps working
            deep in the compartment where the signal dies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={trackingMode}
            onChange={(e) => setTrackingMode(e.target.value as 'hardware_gps' | 'simulated_patrol')}
            aria-label="Tracking source"
            className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            <option value="simulated_patrol">Simulated patrol</option>
            <option value="hardware_gps">Device GPS</option>
          </select>
          <button
            onClick={triggerSingleBreadcrumb}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700/80"
          >
            <Footprints className="h-3.5 w-3.5" />
            <span>Log point</span>
          </button>
          <button
            onClick={isTracking ? stopTracking : startTracking}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              isTracking
                ? 'border border-rose-800/70 bg-rose-950/60 text-rose-300 hover:bg-rose-900/60'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {isTracking ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span>{isTracking ? 'Stop patrol' : 'Start patrol'}</span>
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Breadcrumbs logged" value={String(totalRecorded)} />
        <Stat label="Passport points" value={String(passports.length)} />
        <Stat label="Current fix" value={`${currentPosition.latitude.toFixed(4)}, ${currentPosition.longitude.toFixed(4)}`} mono />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800 bg-[#0a1017]">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <WifiOff className="h-3.5 w-3.5 text-amber-400" />
            Local vector rendering · {breadcrumbs.length} points
          </span>
          <span className="font-mono">
            {bounds.minLat.toFixed(4)}…{bounds.maxLat.toFixed(4)} / {bounds.minLng.toFixed(4)}…{bounds.maxLng.toFixed(4)}
          </span>
        </div>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block w-full" role="img" aria-label="Patrol trail and timber passport locations">
          <defs>
            <pattern id="plot-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#16202b" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="#060a0f" />
          <rect width={WIDTH} height={HEIGHT} fill="url(#plot-grid)" />

          {trail && <polyline points={trail} fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round" strokeOpacity="0.8" />}

          {breadcrumbs.map((crumb, index) => {
            const { x, y } = project(crumb);
            return (
              <circle key={crumb.id ?? index} cx={x} cy={y} r={2.5} fill={crumb.synced ? '#34d399' : '#fbbf24'}>
                <title>{`${crumb.timestamp.slice(0, 16).replace('T', ' ')} · ±${crumb.accuracy}m · ${crumb.canopyDensity}`}</title>
              </circle>
            );
          })}

          {passports.map((passport) => {
            const { x, y } = project(passport);
            return (
              <g key={passport.passportId}>
                <circle cx={x} cy={y} r="7" fill="#0ea5e9" fillOpacity="0.18" />
                <circle cx={x} cy={y} r="3.5" fill="#38bdf8" stroke="#082f49" strokeWidth="1" />
                <title>{`${passport.passportId} · ${passport.speciesName} · ${passport.blockId}`}</title>
              </g>
            );
          })}

          <g className="beacon-ring" style={{ transformOrigin: `${live.x}px ${live.y}px` }}>
            <circle cx={live.x} cy={live.y} r="9" fill="none" stroke="#f43f5e" strokeWidth="2" />
          </g>
          <circle cx={live.x} cy={live.y} r="3" fill="#f43f5e" />
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-slate-400">
        <Legend color="#34d399" label="Synced breadcrumb" />
        <Legend color="#fbbf24" label="Queued breadcrumb" />
        <Legend color="#38bdf8" label="Timber passport" />
        <Legend color="#f43f5e" label="Live position" />
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3" />
          {trackingMode === 'hardware_gps' ? 'Device GPS' : 'Simulated patrol'}
        </span>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="rounded-lg border border-slate-800 bg-[#0a1017] p-4">
    <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`mt-1 text-lg font-semibold text-white ${mono ? 'font-mono text-sm' : ''}`}>{value}</div>
  </div>
);

const Legend: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span className="flex items-center gap-1.5">
    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    {label}
  </span>
);
