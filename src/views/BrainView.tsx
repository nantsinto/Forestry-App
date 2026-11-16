import React, { useMemo, useState } from 'react';
import { estimateCarbon, estimateVolumeM3 } from '../services/passport';
import { formatVolume, getRegion, getSpecies, REGIONS } from '../services/locales';
import { Brain, CheckCircle2, Camera, Sparkles, TriangleAlert } from 'lucide-react';
import type { PassportGrade } from '../services/db';

const DEFECTS = ['Heart rot', 'Knot cluster', 'Split / check', 'Stain', 'Sweep', 'Borer damage'];

/**
 * On-device grading assistant.
 *
 * Deterministic rules over the measurements the crew already captures, running locally
 * so it works in the field. Photo-based species identification needs a server-side model
 * key and is not wired up (see the note in the panel).
 */
export const BrainView: React.FC = () => {
  const [regionCode, setRegionCode] = useState('ZA');
  const [speciesCode, setSpeciesCode] = useState(getRegion('ZA').species[0].code);
  const [dbhCm, setDbhCm] = useState(34);
  const [heightM, setHeightM] = useState(21);
  const [defects, setDefects] = useState<string[]>([]);

  const region = getRegion(regionCode);
  const species = getSpecies(regionCode, speciesCode);
  const volume = estimateVolumeM3(dbhCm, heightM, species.formFactor);
  const carbon = estimateCarbon(dbhCm, heightM, species.density);

  const recommendation = useMemo(() => {
    const reasons: string[] = [];
    let grade: PassportGrade = 'A';

    if (defects.includes('Heart rot')) {
      grade = 'Reject';
      reasons.push('Heart rot makes the stem unsound for structural use.');
    } else if (defects.length >= 3) {
      grade = 'Reject';
      reasons.push(`${defects.length} defect types on one stem exceeds the salvage threshold.`);
    } else if (defects.length === 2) {
      grade = 'C';
      reasons.push('Two defect types push the log into pulp / low-value recovery.');
    } else if (defects.length === 1) {
      grade = dbhCm >= 30 ? 'B' : 'C';
      reasons.push(`Single defect (${defects[0]}) with ${dbhCm} cm DBH.`);
    } else if (dbhCm >= 35 && heightM >= 20) {
      grade = 'A';
      reasons.push('Clean stem above the 35 cm / 20 m sawlog threshold.');
    } else if (dbhCm >= 25) {
      grade = 'B';
      reasons.push('Clean but below the grade-A diameter threshold.');
    } else {
      grade = 'C';
      reasons.push('Small-diameter clean stem — pulp or pole grade.');
    }

    const confidence = defects.length === 0 ? 'high' : 'medium';
    return { grade, reasons, confidence };
  }, [defects, dbhCm, heightM]);

  const gradeStyles: Record<PassportGrade, string> = {
    A: 'text-emerald-400 border-emerald-800/70 bg-emerald-950/50',
    B: 'text-sky-400 border-sky-800/70 bg-sky-950/50',
    C: 'text-amber-400 border-amber-800/70 bg-amber-950/50',
    Reject: 'text-rose-400 border-rose-800/70 bg-rose-950/50',
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="rounded-lg border border-slate-800 bg-[#0a1017] p-6">
        <div className="mb-1 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-emerald-400">
          <Brain className="h-4 w-4" />
          <span>On-device assistant</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Central Brain</h1>
        <p className="mt-1 max-w-2xl text-xs text-slate-400">
          Grade guidance from the measurements crews already take. Runs on the phone, so a grader still gets a
          consistent recommendation with no signal.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-3 rounded-lg border border-slate-800 bg-[#0a1017] p-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-400">Region</span>
              <select
                value={regionCode}
                onChange={(e) => {
                  setRegionCode(e.target.value);
                  setSpeciesCode(getRegion(e.target.value).species[0].code);
                }}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              >
                {REGIONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.code} — {r.name.split('—')[1]?.trim() ?? r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-400">Species</span>
              <select
                value={speciesCode}
                onChange={(e) => setSpeciesCode(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              >
                {region.species.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.common}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-400">DBH (cm)</span>
              <input
                type="range"
                min={10}
                max={80}
                value={dbhCm}
                onChange={(e) => setDbhCm(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <span className="font-mono text-xs text-slate-300">{dbhCm} cm</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-400">Height (m)</span>
              <input
                type="range"
                min={8}
                max={40}
                value={heightM}
                onChange={(e) => setHeightM(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <span className="font-mono text-xs text-slate-300">{heightM} m</span>
            </label>
          </div>

          <div>
            <span className="mb-1.5 block text-[11px] text-slate-400">Observed defects</span>
            <div className="flex flex-wrap gap-1.5">
              {DEFECTS.map((defect) => {
                const active = defects.includes(defect);
                return (
                  <button
                    key={defect}
                    onClick={() =>
                      setDefects((prev) => (prev.includes(defect) ? prev.filter((d) => d !== defect) : [...prev, defect]))
                    }
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                      active
                        ? 'border-rose-700/70 bg-rose-950/60 text-rose-300'
                        : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {defect}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-md border border-slate-800 bg-slate-900/50 p-3 text-[11px] text-slate-400">
            {species.common}{' '}
            <span className="italic">({species.scientific})</span> · wood density {species.density} g/cm³ ·{' '}
            {formatVolume(volume, 'm3')} · {carbon.co2eTonnes.toFixed(2)} t CO₂e stored
          </div>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <div className={`rounded-lg border p-5 ${gradeStyles[recommendation.grade]}`}>
            <div className="text-[10px] uppercase tracking-wider opacity-70">Recommended grade</div>
            <div className="mt-1 text-3xl font-bold">Grade {recommendation.grade}</div>
            <div className="mt-1 text-[11px] opacity-80">Confidence: {recommendation.confidence}</div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#0a1017] p-5">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">Why</div>
            <ul className="space-y-1.5 text-[11px] leading-relaxed text-slate-300">
              {recommendation.reasons.map((reason) => (
                <li key={reason} className="flex gap-1.5">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-300">
              <Camera className="h-3.5 w-3.5" />
              Photo species ID — not connected
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-amber-200/70">
              Bark and leaf identification needs a model key held on a server, so the key never ships in the app.
              Until that endpoint exists, identification stays a manual pick from the regional species list.
            </p>
          </div>

          <div className="flex items-start gap-1.5 rounded-lg border border-slate-800 bg-[#0a1017] p-3 text-[10px] leading-relaxed text-slate-500">
            <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              Guidance only. Volume uses the regional form factor and carbon uses Chave 2014 allometry — both are
              estimates, not a scale-house measurement.
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
        <Sparkles className="h-3 w-3" />
        Rules run locally; no data leaves the device.
      </div>
    </div>
  );
};
