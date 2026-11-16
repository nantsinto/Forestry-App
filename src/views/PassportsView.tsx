import React, { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { db, PassportEventRecord, PassportEventType, PassportGrade, TimberPassportRecord } from '../services/db';
import {
  appendEvent,
  buildEudrPack,
  createPassport,
  eudrPackHtml,
  estimateCarbon,
  estimateVolumeM3,
  passportShareUrl,
  seedDemoPassports,
  verifyPassport,
} from '../services/passport';
import { formatDate, formatVolume, getRegion, getSpecies, REGIONS, VolumeUnit } from '../services/locales';
import { QrCode } from '../components/QrCode';
import {
  BadgeCheck,
  Copy,
  FileDown,
  Fingerprint,
  MapPin,
  Package,
  Plus,
  Printer,
  QrCode as QrIcon,
  ShieldCheck,
  ShieldX,
  Truck,
  X,
} from 'lucide-react';

const GRADES: PassportGrade[] = ['A', 'B', 'C', 'Reject'];

const statusStyles: Record<string, string> = {
  in_field: 'bg-slate-800/80 text-slate-300 border-slate-700',
  in_transit: 'bg-amber-950/50 text-amber-300 border-amber-800/60',
  delivered: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
};

export const PassportsView: React.FC = () => {
  const [passports, setPassports] = useState<TimberPassportRecord[]>([]);
  const [events, setEvents] = useState<PassportEventRecord[]>([]);
  const [region, setRegion] = useState('ZA');
  const [unit, setUnit] = useState<VolumeUnit>('m3');
  const [showNew, setShowNew] = useState(false);
  const [labelFor, setLabelFor] = useState<TimberPassportRecord | null>(null);
  const [custodyFor, setCustodyFor] = useState<TimberPassportRecord | null>(null);
  const [detailFor, setDetailFor] = useState<TimberPassportRecord | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ hashValid: boolean; chainValid: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const [rows, eventRows] = await Promise.all([
      db.passports.orderBy('id').reverse().toArray(),
      db.passportEvents.toArray(),
    ]);
    setPassports(rows);
    setEvents(eventRows);
  }, []);

  useEffect(() => {
    seedDemoPassports().then(load);
  }, [load]);

  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const event of events) counts[event.passportId] = (counts[event.passportId] ?? 0) + 1;
    return counts;
  }, [events]);

  const visible = passports.filter((p) => p.region === region);
  const regionMeta = getRegion(region);

  useEffect(() => {
    if (!detailFor) {
      setVerifyResult(null);
      return;
    }
    const passportEvents = events.filter((e) => e.passportId === detailFor.passportId);
    verifyPassport(detailFor, passportEvents).then((r) => setVerifyResult(r));
  }, [detailFor, events]);

  const handlePrintLabel = async (passport: TimberPassportRecord) => {
    const url = passportShareUrl(passport);
    const png = await QRCode.toDataURL(url, { width: 720, margin: 1, errorCorrectionLevel: 'L' });
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${passport.passportId} label</title>
      <style>
        body{font-family:ui-monospace,monospace;padding:24px;color:#111}
        .label{width:340px;border:1px solid #111;padding:16px;border-radius:6px}
        .id{font-size:16px;font-weight:700;letter-spacing:.02em}
        .meta{font-size:11px;line-height:1.55;margin-top:6px}
        img{width:260px;height:260px;display:block;margin:10px auto}
        .foot{font-size:9px;color:#555;margin-top:8px;word-break:break-all}
      </style></head><body>
      <div class="label">
        <div class="id">${passport.passportId}</div>
        <div class="meta">${passport.speciesName} · Grade ${passport.grade}<br>
        ${passport.volumeM3.toFixed(3)} m³ · ${passport.blockId}<br>
        ${passport.harvestedAt} · ${passport.permitNo}</div>
        <img src="${png}" alt="Passport QR">
        <div class="foot">Scan for provenance. SHA-256 ${passport.payloadHash.slice(0, 32)}</div>
      </div>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExportPack = () => {
    if (visible.length === 0) return;
    const pack = buildEudrPack(visible, eventCounts);
    const stamp = pack.statementId;

    const jsonBlob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = `${stamp}.json`;
    jsonLink.click();
    URL.revokeObjectURL(jsonUrl);

    const htmlBlob = new Blob([eudrPackHtml(pack)], { type: 'text/html' });
    const htmlUrl = URL.createObjectURL(htmlBlob);
    const htmlLink = document.createElement('a');
    htmlLink.href = htmlUrl;
    htmlLink.download = `${stamp}.html`;
    htmlLink.click();
    URL.revokeObjectURL(htmlUrl);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-5 rounded-lg border border-slate-800 bg-[#0a1017] p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-emerald-400">
            <Fingerprint className="h-4 w-4" />
            <span>Chain of custody</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Timber Passports</h1>
          <p className="mt-1 max-w-xl text-xs text-slate-400">
            Every log is captured at the stump, hashed on-device and labelled with a QR code that verifies
            offline — no signal, no account and no server needed to prove where the timber came from.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            aria-label="Region"
            className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.code} — {r.name.split('—')[1]?.trim() ?? r.name}
              </option>
            ))}
          </select>

          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as VolumeUnit)}
            aria-label="Volume unit"
            className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            <option value="m3">m³</option>
            <option value="cft">ft³</option>
          </select>

          <button
            onClick={handleExportPack}
            disabled={visible.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-emerald-800/80 bg-emerald-950/60 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-40"
            title="Export an EUDR due-diligence pack for this region"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>EUDR pack</span>
          </button>

          <button
            onClick={() => setShowNew(true)}
            data-testid="new-passport-btn"
            className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New passport</span>
          </button>
        </div>
      </div>

      {/* Region strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <span className="font-mono uppercase tracking-wider text-slate-500">{regionMeta.regime}</span>
        <span aria-hidden="true">·</span>
        <span>{regionMeta.regulator}</span>
        <span aria-hidden="true">·</span>
        <span>
          {visible.length} {visible.length === 1 ? 'log' : 'logs'} in ledger
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {formatVolume(visible.reduce((sum, p) => sum + p.volumeM3, 0), unit)} total
        </span>
      </div>

      {/* Ledger */}
      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-800 bg-[#0a1017] p-10 text-center">
          <Package className="mx-auto mb-3 h-7 w-7 text-slate-600" />
          <p className="text-sm text-slate-300">No passports for this region yet.</p>
          <button
            onClick={() => setShowNew(true)}
            className="mt-3 rounded-md border border-emerald-800/80 bg-emerald-950/60 px-3 py-1.5 text-xs font-medium text-emerald-300"
          >
            Capture the first log
          </button>
        </div>
      ) : (
        <div className="grid gap-3" data-testid="passport-list">
          {visible.map((passport) => (
            <div
              key={passport.passportId}
              className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-[#0a1017] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-white">{passport.passportId}</span>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${statusStyles[passport.status]}`}
                  >
                    {passport.status.replace('_', ' ')}
                  </span>
                  <span className="rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                    Grade {passport.grade}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {passport.speciesName} <span className="italic">({passport.scientificName})</span> ·{' '}
                  {formatVolume(passport.volumeM3, unit)} · {passport.carbonTco2e.toFixed(2)} t CO₂e
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                  <span>
                    {passport.blockName} ({passport.blockId})
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {passport.latitude.toFixed(5)}, {passport.longitude.toFixed(5)}
                  </span>
                  <span>{formatDate(passport.harvestedAt, passport.region)}</span>
                  <span className="font-mono">{eventCounts[passport.passportId] ?? 0} custody events</span>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setLabelFor(passport)}
                  data-testid={`label-${passport.passportId}`}
                  className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-slate-700/80"
                >
                  <QrIcon className="h-3.5 w-3.5" />
                  <span>Label</span>
                </button>
                <button
                  onClick={() => setCustodyFor(passport)}
                  className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-slate-700/80"
                >
                  <Truck className="h-3.5 w-3.5" />
                  <span>Custody</span>
                </button>
                <button
                  onClick={() => setDetailFor(passport)}
                  className="flex items-center gap-1.5 rounded-md border border-emerald-800/70 bg-emerald-950/50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-900/50"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Verify</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <NewPassportModal
          region={region}
          passports={passports}
          onClose={() => setShowNew(false)}
          onCreated={async () => {
            setShowNew(false);
            await load();
          }}
        />
      )}

      {/* QR label modal */}
      {labelFor && (
        <Modal onClose={() => setLabelFor(null)} title={`Field label · ${labelFor.passportId}`}>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="rounded-lg bg-white p-2.5">
              <QrCode value={passportShareUrl(labelFor)} size={188} />
            </div>
            <div className="min-w-0 flex-1 text-xs text-slate-300">
              <p className="mb-2 leading-relaxed">
                Anyone who scans this label opens the passport on their own device — the provenance travels
                inside the code, so it verifies with or without a connection.
              </p>
              <div className="space-y-1 rounded-md border border-slate-800 bg-slate-900/60 p-2.5 font-mono text-[10px] text-slate-400">
                <div>
                  <span className="text-slate-500">Passport</span> {labelFor.passportId}
                </div>
                <div className="truncate">
                  <span className="text-slate-500">Hash</span> {labelFor.payloadHash.slice(0, 32)}…
                </div>
                <div>
                  <span className="text-slate-500">Block</span> {labelFor.blockId}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
            <button
              onClick={() => handlePrintLabel(labelFor)}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print label</span>
            </button>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(passportShareUrl(labelFor));
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700/80"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>{copied ? 'Copied' : 'Copy link'}</span>
            </button>
            <a
              href={passportShareUrl(labelFor)}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-xs text-emerald-400 underline-offset-2 hover:underline"
            >
              Open buyer view
            </a>
          </div>
        </Modal>
      )}

      {/* Custody modal */}
      {custodyFor && (
        <CustodyModal
          passport={custodyFor}
          onClose={() => setCustodyFor(null)}
          onSaved={async () => {
            setCustodyFor(null);
            await load();
          }}
        />
      )}

      {/* Verification modal */}
      {detailFor && (
        <Modal onClose={() => setDetailFor(null)} title={`Provenance · ${detailFor.passportId}`}>
          <div className="space-y-4 text-xs">
            <div
              className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                verifyResult?.hashValid && verifyResult?.chainValid
                  ? 'border-emerald-800/70 bg-emerald-950/50 text-emerald-300'
                  : 'border-rose-800/70 bg-rose-950/50 text-rose-300'
              }`}
              data-testid="verify-badge"
            >
              {verifyResult?.hashValid && verifyResult?.chainValid ? (
                <BadgeCheck className="h-4 w-4" />
              ) : (
                <ShieldX className="h-4 w-4" />
              )}
              <span className="font-medium">
                {!verifyResult
                  ? 'Verifying…'
                  : verifyResult.hashValid && verifyResult.chainValid
                  ? 'Passport and custody chain verified'
                  : 'Verification failed — record was altered'}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Field label="Species" value={`${detailFor.speciesName} (${detailFor.scientificName})`} />
              <Field label="Grade" value={detailFor.grade} />
              <Field label="Volume" value={formatVolume(detailFor.volumeM3, unit)} />
              <Field label="CO₂e stored" value={`${detailFor.carbonTco2e.toFixed(2)} t`} />
              <Field label="Block" value={`${detailFor.blockName} (${detailFor.blockId})`} />
              <Field label="Harvested" value={formatDate(detailFor.harvestedAt, detailFor.region)} />
              <Field label="Permit" value={detailFor.permitNo} />
              <Field label="Crew" value={detailFor.crew} />
            </dl>

            <div>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Custody chain
              </div>
              <ol className="space-y-2">
                {events
                  .filter((e) => e.passportId === detailFor.passportId)
                  .sort((a, b) => a.seq - b.seq)
                  .map((event) => (
                    <li key={event.seq} className="rounded-md border border-slate-800 bg-slate-900/50 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium capitalize text-slate-200">
                          {event.seq}. {event.type}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {event.timestamp.slice(0, 16).replace('T', ' ')}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {event.actor} · {event.location}
                      </div>
                      {event.note && <div className="mt-0.5 text-[11px] text-slate-500">{event.note}</div>}
                      <div className="mt-1 truncate font-mono text-[10px] text-slate-600">
                        {event.payloadHash}
                      </div>
                    </li>
                  ))}
              </ol>
            </div>

            <div className="truncate rounded-md border border-slate-800 bg-slate-900/60 p-2.5 font-mono text-[10px] text-slate-500">
              SHA-256 {detailFor.payloadHash}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <dt className="text-[10px] uppercase tracking-wider text-slate-500">{label}</dt>
    <dd className="mt-0.5 text-slate-200">{value}</dd>
  </div>
);

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-800 bg-[#0a1017] p-6 text-slate-100 shadow-2xl">
      <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const NewPassportModal: React.FC<{
  region: string;
  passports: TimberPassportRecord[];
  onClose: () => void;
  onCreated: () => void;
}> = ({ region, passports, onClose, onCreated }) => {
  const regionMeta = getRegion(region);
  const lastBlock = passports[0];

  const [speciesCode, setSpeciesCode] = useState(regionMeta.species[0].code);
  const [grade, setGrade] = useState<PassportGrade>('A');
  const [dbhCm, setDbhCm] = useState(38);
  const [heightM, setHeightM] = useState(22);
  const [blockId, setBlockId] = useState(lastBlock?.blockId ?? 'ZN-14');
  const [blockName, setBlockName] = useState(lastBlock?.blockName ?? 'Zintlulam Block 14');
  const [permitNo, setPermitNo] = useState(lastBlock?.permitNo ?? 'MP-PERM-4471');
  const [crew, setCrew] = useState('Crew Delta');
  const [operator, setOperator] = useState(lastBlock?.operator ?? 'Mpumalanga Forestry Holdings');
  const [harvestedAt, setHarvestedAt] = useState(new Date().toISOString().slice(0, 10));
  const [latitude, setLatitude] = useState(lastBlock?.latitude ?? -25.68124);
  const [longitude, setLongitude] = useState(lastBlock?.longitude ?? 30.45127);
  const [accuracyM, setAccuracyM] = useState(4.0);
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const species = getSpecies(region, speciesCode);
  const volumePreview = estimateVolumeM3(dbhCm, heightM, species.formFactor);
  const carbonPreview = estimateCarbon(dbhCm, heightM, species.density);

  const captureGps = () => {
    if (!('geolocation' in navigator)) {
      setGpsNote('Device has no geolocation — using block reference point.');
      return;
    }
    setGpsNote('Locating…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setAccuracyM(Math.round(pos.coords.accuracy * 10) / 10);
        setGpsNote(`Fix acquired ±${pos.coords.accuracy.toFixed(1)} m`);
      },
      (err) => setGpsNote(`${err.message} — using block reference point.`),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createPassport({
        region,
        speciesCode,
        grade,
        dbhCm,
        heightM,
        blockId,
        blockName,
        permitNo,
        crew,
        operator,
        latitude,
        longitude,
        accuracyM,
        harvestedAt,
      });
      onCreated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-800 bg-[#0a1017] p-6 text-slate-100 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-semibold text-white">Capture harvested log</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-400">Species</span>
              <select
                value={speciesCode}
                onChange={(e) => setSpeciesCode(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              >
                {regionMeta.species.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.common}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-400">Grade</span>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as PassportGrade)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-400">Diameter at breast height (cm)</span>
              <input
                type="number"
                step="0.1"
                min="1"
                value={dbhCm}
                onChange={(e) => setDbhCm(Number(e.target.value))}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-400">Total height (m)</span>
              <input
                type="number"
                step="0.1"
                min="1"
                value={heightM}
                onChange={(e) => setHeightM(Number(e.target.value))}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </label>
          </div>

          <div className="flex items-center justify-between rounded-md border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-[11px] text-emerald-300">
            <span>
              Estimated volume <strong className="font-mono">{volumePreview.toFixed(3)} m³</strong>
            </span>
            <span>
              CO₂e <strong className="font-mono">{carbonPreview.co2eTonnes.toFixed(2)} t</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-400">Block ID</span>
              <input
                value={blockId}
                onChange={(e) => setBlockId(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-400">Block name</span>
              <input
                value={blockName}
                onChange={(e) => setBlockName(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-400">Harvest permit</span>
              <input
                value={permitNo}
                onChange={(e) => setPermitNo(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-400">Harvest date</span>
              <input
                type="date"
                value={harvestedAt}
                onChange={(e) => setHarvestedAt(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-400">Felling crew</span>
              <input
                value={crew}
                onChange={(e) => setCrew(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-400">Operator</span>
              <input
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </label>
          </div>

          <div className="rounded-md border border-slate-800 bg-slate-900/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Geolocation of the stump
              </span>
              <button
                type="button"
                onClick={captureGps}
                className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
              >
                <MapPin className="h-3 w-3" />
                Use GPS
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                aria-label="Latitude"
                type="number"
                step="0.00001"
                value={latitude}
                onChange={(e) => setLatitude(Number(e.target.value))}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
              <input
                aria-label="Longitude"
                type="number"
                step="0.00001"
                value={longitude}
                onChange={(e) => setLongitude(Number(e.target.value))}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
              <input
                aria-label="Accuracy in metres"
                type="number"
                step="0.1"
                value={accuracyM}
                onChange={(e) => setAccuracyM(Number(e.target.value))}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            {gpsNote && <p className="mt-1.5 text-[10px] text-slate-500">{gpsNote}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              data-testid="create-passport-submit"
              className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? 'Hashing…' : 'Capture & hash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CustodyModal: React.FC<{
  passport: TimberPassportRecord;
  onClose: () => void;
  onSaved: () => void;
}> = ({ passport, onClose, onSaved }) => {
  const [type, setType] = useState<PassportEventType>('loaded');
  const [actor, setActor] = useState('Haulage — Sipho M.');
  const [location, setLocation] = useState('Loading bay, Block yard');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await appendEvent({ passportId: passport.passportId, type, actor, location, note });
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Custody event · ${passport.passportId}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5">
        <label className="block">
          <span className="mb-1 block text-[11px] text-slate-400">Handover type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as PassportEventType)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            <option value="loaded">Loaded onto truck</option>
            <option value="transferred">Transferred to next custodian</option>
            <option value="inspected">Inspected</option>
            <option value="delivered">Delivered to mill</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-slate-400">Custodian / actor</span>
          <input
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-slate-400">Location</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-slate-400">Note</span>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Seal number, vehicle registration, moisture reading…"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            data-testid="append-custody-submit"
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? 'Linking…' : 'Append & link hash'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
