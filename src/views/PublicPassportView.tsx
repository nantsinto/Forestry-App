import React, { useEffect, useMemo, useState } from 'react';
import { decodePublicPassport, passportShareUrl, PublicPassport, verifyPassport } from '../services/passport';
import { formatDate, formatVolume, getRegion, getSpecies } from '../services/locales';
import { BadgeCheck, Compass, Leaf, ShieldAlert, ShieldCheck, TreePine } from 'lucide-react';

/**
 * Buyer-facing passport. Everything it shows comes from the QR payload itself and is
 * re-hashed in the browser, so this page works on a phone with no signal and no account.
 */
export const PublicPassportView: React.FC<{ token: string }> = ({ token }) => {
  // Decoded once per token: a fresh object each render would re-trigger the verify effect.
  const passport: PublicPassport | null = useMemo(() => decodePublicPassport(token), [token]);
  const [verification, setVerification] = useState<{ hashValid: boolean; expectedHash: string } | null>(null);

  useEffect(() => {
    if (!passport) return;
    verifyPassport(passport).then((result) =>
      setVerification({ hashValid: result.hashValid, expectedHash: result.expectedHash })
    );
  }, [passport]);

  if (!passport) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-rose-400" />
        <h1 className="text-lg font-semibold text-white">Unreadable passport</h1>
        <p className="mt-2 text-xs text-slate-400">
          This label's payload could not be decoded. Re-scan the QR code or ask the issuer for a fresh label.
        </p>
        <a href="#/" className="mt-5 inline-block rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white">
          Open SilvaeGuard
        </a>
      </div>
    );
  }

  const region = getRegion(passport.region);
  const species = getSpecies(passport.region, passport.speciesCode);
  const valid = verification?.hashValid === true;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-sm bg-emerald-500" />
          <span className="text-sm font-semibold text-white">SilvaeGuard</span>
        </div>
        <a href="#/" className="text-[11px] text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline">
          Field app
        </a>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0a1017] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Timber passport</div>
            <h1 className="mt-1 font-mono text-xl font-semibold text-white" data-testid="public-passport-id">
              {passport.passportId}
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              {species.common} <span className="italic">({species.scientific})</span>
            </p>
          </div>
          <div
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium ${
              valid
                ? 'border-emerald-800/70 bg-emerald-950/60 text-emerald-300'
                : 'border-rose-800/70 bg-rose-950/60 text-rose-300'
            }`}
            data-testid="public-verify-badge"
          >
            {valid ? <BadgeCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
            <span>{verification === null ? 'Verifying…' : valid ? 'Verified offline' : 'Hash mismatch'}</span>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3">
          <Field label="Grade" value={passport.grade} />
          <Field label="Volume" value={formatVolume(passport.volumeM3, 'm3')} />
          <Field label="Harvest date" value={formatDate(passport.harvestedAt, region.code)} />
          <Field label="Block" value={passport.blockId} />
          <Field label="Crew" value={passport.crew} />
          <Field label="Permit" value={passport.permitNo} />
        </dl>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-slate-800 bg-slate-900/50 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
              <Compass className="h-3 w-3" />
              Harvest geolocation
            </div>
            <div className="font-mono text-xs text-slate-200">
              {passport.latitude.toFixed(5)}, {passport.longitude.toFixed(5)}
            </div>
            <a
              className="mt-1 inline-block text-[11px] text-emerald-400 underline-offset-2 hover:underline"
              href={`https://www.openstreetmap.org/?mlat=${passport.latitude}&mlon=${passport.longitude}#map=16/${passport.latitude}/${passport.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in map
            </a>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-900/50 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
              <Leaf className="h-3 w-3" />
              Compliance
            </div>
            <div className="text-[11px] leading-relaxed text-slate-300">
              {region.regime}
              <br />
              <span className="text-slate-500">{region.regulator}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-slate-800 bg-slate-900/50 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
            <ShieldCheck className="h-3 w-3" />
            How this is verified
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            The issuer's device hashed these fields with SHA-256 at the stump. Your browser just recomputed the
            same hash from the code it scanned — no network request was made.
          </p>
          <div className="mt-2 break-all rounded border border-slate-800 bg-black/40 p-2 font-mono text-[10px] text-slate-500">
            <div>
              <span className="text-slate-600">embedded</span> {passport.payloadHash}
            </div>
            {verification && (
              <div className={valid ? 'text-emerald-500' : 'text-rose-400'}>
                <span className="text-slate-600">computed</span>{' '}
                <span data-testid="computed-hash">{verification.expectedHash}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <TreePine className="h-3.5 w-3.5" />
            {passport.operator}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(passportShareUrl(passport))}
            className="rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-slate-300 hover:bg-slate-700/80"
          >
            Copy label link
          </button>
        </div>
      </div>

      <p className="mt-4 text-center text-[10px] leading-relaxed text-slate-600">
        Tamper-evident, not certificate-signed: the hash proves the record was not edited after capture.
      </p>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <dt className="text-[10px] uppercase tracking-wider text-slate-500">{label}</dt>
    <dd className="mt-0.5 text-slate-200">{value}</dd>
  </div>
);
