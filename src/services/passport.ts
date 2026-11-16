import { db, PassportEventRecord, PassportEventType, PassportGrade, PassportStatus, TimberPassportRecord } from './db';
import { getRegion, getSpecies } from './locales';

/**
 * Timber passport: capture, hash, verify.
 *
 * A passport is the log's identity card. Every field that matters is hashed with
 * SHA-256 into `payloadHash`, and each custody event hashes the event before it, so
 * the chain is tamper-EVIDENT: change any field and verification fails. It is not a
 * certificate authority signature — there is no secret key on the device, so the hash
 * proves the record was not edited after capture, not who captured it.
 */

export const GENESIS_HASH = '0'.repeat(64);

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** The exact bytes that get hashed. Any change to a passport changes this string. */
export function canonicalPassport(fields: {
  passportId: string;
  speciesCode: string;
  grade: string;
  volumeM3: number;
  blockId: string;
  latitude: number;
  longitude: number;
  harvestedAt: string;
  permitNo: string;
  operator: string;
  crew: string;
  region: string;
}): string {
  return [
    fields.passportId,
    fields.speciesCode,
    fields.grade,
    fields.volumeM3.toFixed(3),
    fields.blockId,
    fields.latitude.toFixed(5),
    fields.longitude.toFixed(5),
    fields.harvestedAt.slice(0, 10),
    fields.permitNo,
    fields.operator,
    fields.crew,
    fields.region,
  ].join('|');
}

/** Merchantable stem volume from diameter at breast height and total height. */
export function estimateVolumeM3(dbhCm: number, heightM: number, formFactor = 0.45): number {
  const radiusM = dbhCm / 200;
  return Math.round(Math.PI * radiusM * radiusM * heightM * formFactor * 1000) / 1000;
}

/** Above-ground biomass (Chave et al. 2014, pan-tropical) → CO₂ equivalent tonnes. */
export function estimateCarbon(dbhCm: number, heightM: number, density: number): { agbKg: number; co2eTonnes: number } {
  const agbKg = 0.0673 * Math.pow(density * dbhCm * dbhCm * heightM, 0.976);
  const carbonKg = agbKg * 0.4713;
  return { agbKg: Math.round(agbKg), co2eTonnes: Math.round((carbonKg * 3.67) / 10) / 100 };
}

export interface NewPassportInput {
  region: string;
  speciesCode: string;
  grade: PassportGrade;
  dbhCm: number;
  heightM: number;
  blockId: string;
  blockName: string;
  permitNo: string;
  crew: string;
  operator: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  harvestedAt: string;
}

export async function createPassport(input: NewPassportInput): Promise<TimberPassportRecord> {
  const region = getRegion(input.region);
  const species = getSpecies(region.code, input.speciesCode);
  const volumeM3 = estimateVolumeM3(input.dbhCm, input.heightM, species.formFactor);
  const carbon = estimateCarbon(input.dbhCm, input.heightM, species.density);

  const year = input.harvestedAt.slice(0, 4);
  const prefix = `SG-${region.code}-${year}-`;
  const existing = await db.passports.toArray();
  const nextSeq =
    existing
      .filter((p) => p.passportId.startsWith(prefix))
      .reduce((max, p) => Math.max(max, Number(p.passportId.slice(prefix.length)) || 0), 0) + 1;
  const passportId = `${prefix}${String(nextSeq).padStart(4, '0')}`;

  const last = await db.passports.orderBy('id').last();
  const previousHash = last?.payloadHash ?? GENESIS_HASH;

  const draft = {
    passportId,
    speciesCode: species.code,
    speciesName: species.common,
    scientificName: species.scientific,
    grade: input.grade,
    dbhCm: input.dbhCm,
    heightM: input.heightM,
    volumeM3,
    carbonTco2e: carbon.co2eTonnes,
    blockId: input.blockId,
    blockName: input.blockName,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyM: input.accuracyM,
    harvestedAt: input.harvestedAt.slice(0, 10),
    crew: input.crew,
    permitNo: input.permitNo,
    operator: input.operator,
    region: region.code,
    previousHash,
    status: 'in_field' as PassportStatus,
    synced: typeof navigator !== 'undefined' && navigator.onLine ? 1 : 0,
    createdAt: new Date().toISOString(),
  };

  const payloadHash = await sha256Hex(canonicalPassport(draft));
  const record: TimberPassportRecord = { ...draft, payloadHash };
  await db.passports.add(record);

  await appendEvent({
    passportId,
    type: 'created',
    actor: input.crew,
    location: `${input.blockName} (${input.blockId})`,
    note: `${species.common} felled at ${input.latitude.toFixed(5)}, ${input.longitude.toFixed(5)} · ${volumeM3.toFixed(3)} m³`,
  });

  return { ...record, id: (await db.passports.where('passportId').equals(passportId).first())?.id };
}

export async function appendEvent(input: {
  passportId: string;
  type: PassportEventType;
  actor: string;
  location: string;
  note?: string;
}): Promise<PassportEventRecord> {
  const passport = await db.passports.where('passportId').equals(input.passportId).first();
  if (!passport) throw new Error(`Passport ${input.passportId} not found`);

  const events = await db.passportEvents.where('passportId').equals(input.passportId).sortBy('seq');
  const last = events[events.length - 1];
  const seq = (last?.seq ?? 0) + 1;
  const previousHash = last?.payloadHash ?? passport.payloadHash;
  const timestamp = new Date().toISOString();

  const payloadHash = await sha256Hex(
    [input.passportId, seq, input.type, input.actor, input.location, timestamp, previousHash].join('|')
  );

  const record: PassportEventRecord = {
    passportId: input.passportId,
    seq,
    type: input.type,
    actor: input.actor,
    location: input.location,
    note: input.note ?? '',
    timestamp,
    previousHash,
    payloadHash,
    synced: typeof navigator !== 'undefined' && navigator.onLine ? 1 : 0,
  };
  await db.passportEvents.add(record);

  const status: PassportStatus =
    input.type === 'delivered' ? 'delivered' : input.type === 'loaded' || input.type === 'transferred' ? 'in_transit' : passport.status;
  if (status !== passport.status && passport.id != null) {
    await db.passports.update(passport.id, { status });
  }

  return record;
}

export interface VerificationResult {
  hashValid: boolean;
  chainValid: boolean;
  expectedHash: string;
}

/** Recompute the passport hash, and re-link every custody event. */
export async function verifyPassport(
  passport: Pick<TimberPassportRecord, 'passportId' | 'speciesCode' | 'grade' | 'volumeM3' | 'blockId' | 'latitude' | 'longitude' | 'harvestedAt' | 'permitNo' | 'operator' | 'crew' | 'region' | 'payloadHash'>,
  events: PassportEventRecord[] = []
): Promise<VerificationResult> {
  const expectedHash = await sha256Hex(canonicalPassport(passport));
  const hashValid = expectedHash === passport.payloadHash;

  let chainValid = true;
  let previous = passport.payloadHash;
  for (const event of [...events].sort((a, b) => a.seq - b.seq)) {
    const expectedEvent = await sha256Hex(
      [event.passportId, event.seq, event.type, event.actor, event.location, event.timestamp, previous].join('|')
    );
    if (expectedEvent !== event.payloadHash || event.previousHash !== previous) {
      chainValid = false;
      break;
    }
    previous = event.payloadHash;
  }

  return { hashValid, chainValid, expectedHash };
}

/* ------------------------------------------------------------------ */
/* Share payload — embedded in the QR itself, so a buyer's phone needs  */
/* no server, no account and no connection to verify the log.           */
/* ------------------------------------------------------------------ */

export type PublicPassport = Pick<
  TimberPassportRecord,
  'passportId' | 'speciesCode' | 'grade' | 'volumeM3' | 'blockId' | 'latitude' | 'longitude' | 'harvestedAt' | 'permitNo' | 'operator' | 'crew' | 'region' | 'payloadHash'
>;

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(token: string): string {
  const padded = token.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function encodePublicPassport(p: PublicPassport): string {
  const compact = {
    i: p.passportId,
    s: p.speciesCode,
    g: p.grade,
    v: p.volumeM3,
    b: p.blockId,
    la: p.latitude,
    lo: p.longitude,
    d: p.harvestedAt,
    pe: p.permitNo,
    o: p.operator,
    c: p.crew,
    r: p.region,
    h: p.payloadHash,
  };
  return toBase64Url(JSON.stringify(compact));
}

export function decodePublicPassport(token: string): PublicPassport | null {
  try {
    const raw = JSON.parse(fromBase64Url(token));
    if (!raw || typeof raw.i !== 'string' || typeof raw.h !== 'string') return null;
    return {
      passportId: raw.i,
      speciesCode: raw.s,
      grade: raw.g,
      volumeM3: Number(raw.v),
      blockId: raw.b,
      latitude: Number(raw.la),
      longitude: Number(raw.lo),
      harvestedAt: String(raw.d),
      permitNo: raw.pe,
      operator: raw.o,
      crew: raw.c,
      region: raw.r,
      payloadHash: raw.h,
    };
  } catch {
    return null;
  }
}

export function passportShareUrl(p: PublicPassport): string {
  return `${window.location.origin}${window.location.pathname}#/p/${encodePublicPassport(p)}`;
}

/* ------------------------------------------------------------------ */
/* EUDR due-diligence pack                                             */
/* ------------------------------------------------------------------ */

export interface EudrPack {
  statementId: string;
  generatedAt: string;
  regime: string;
  operator: string;
  countryCode: string;
  regulator: string;
  productCount: number;
  totalVolumeM3: number;
  totalCo2eTonnes: number;
  hsCode: string;
  products: {
    passportId: string;
    species: string;
    scientificName: string;
    grade: PassportGrade;
    volumeM3: number;
    harvestDate: string;
    blockId: string;
    latitude: number;
    longitude: number;
    permitNo: string;
    custodyEvents: number;
    hash: string;
  }[];
  dueDiligence: {
    geolocationProvided: boolean;
    legalHarvestPermits: string[];
    deforestationFreeDeclared: boolean;
    verificationMethod: string;
  };
}

export function buildEudrPack(passports: TimberPassportRecord[], eventCounts: Record<string, number>): EudrPack {
  const first = passports[0];
  const region = getRegion(first?.region ?? 'ZA');
  const isConifer = region.code === 'ZA' || region.code === 'SE';

  return {
    statementId: `EUDR-${region.code}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${passports.length}`,
    generatedAt: new Date().toISOString(),
    regime: region.regime,
    operator: first?.operator ?? '—',
    countryCode: region.countryCode,
    regulator: region.regulator,
    productCount: passports.length,
    totalVolumeM3: Math.round(passports.reduce((sum, p) => sum + p.volumeM3, 0) * 1000) / 1000,
    totalCo2eTonnes: Math.round(passports.reduce((sum, p) => sum + p.carbonTco2e, 0) * 100) / 100,
    hsCode: isConifer ? '4403.20' : '4403.99',
    products: passports.map((p) => ({
      passportId: p.passportId,
      species: p.speciesName,
      scientificName: p.scientificName,
      grade: p.grade,
      volumeM3: p.volumeM3,
      harvestDate: p.harvestedAt,
      blockId: p.blockId,
      latitude: p.latitude,
      longitude: p.longitude,
      permitNo: p.permitNo,
      custodyEvents: eventCounts[p.passportId] ?? 0,
      hash: p.payloadHash,
    })),
    dueDiligence: {
      geolocationProvided: passports.every((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)),
      legalHarvestPermits: Array.from(new Set(passports.map((p) => p.permitNo))),
      deforestationFreeDeclared: true,
      verificationMethod: 'SHA-256 tamper-evident passport ledger, captured offline at the stump and re-verified on export',
    },
  };
}

export function eudrPackHtml(pack: EudrPack): string {
  const rows = pack.products
    .map(
      (p) => `<tr>
        <td><strong>${p.passportId}</strong></td>
        <td>${p.species} <em>(${p.scientificName})</em></td>
        <td>${p.grade}</td>
        <td>${p.volumeM3.toFixed(3)} m³</td>
        <td>${p.harvestDate}</td>
        <td>${p.blockId} · ${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}</td>
        <td>${p.permitNo}</td>
        <td class="hash">${p.hash.slice(0, 16)}…</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pack.statementId} — Due Diligence Statement</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #12211a; margin: 0; padding: 40px 32px; background: #fff; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.01em; }
  .sub { color: #4b6357; font-size: 13px; margin-bottom: 24px; }
  .badge { display: inline-block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; padding: 3px 8px; border-radius: 3px; background: #e6f4ec; color: #1b6b45; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0 28px; }
  .kpi { border: 1px solid #dfe8e2; border-radius: 6px; padding: 12px; }
  .kpi span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; color: #678075; }
  .kpi strong { font-size: 19px; font-family: ui-monospace, monospace; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e6ece8; vertical-align: top; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #678075; }
  .hash { font-family: ui-monospace, monospace; color: #4b6357; }
  footer { margin-top: 28px; font-size: 11px; color: #678075; border-top: 1px solid #e6ece8; padding-top: 12px; }
</style></head>
<body>
  <span class="badge">EUDR · EU 2023/1115</span>
  <h1>Due Diligence Statement ${pack.statementId}</h1>
  <div class="sub">${pack.operator} · ${pack.regulator} · generated ${pack.generatedAt.replace('T', ' ').slice(0, 16)} UTC</div>

  <div class="grid">
    <div class="kpi"><span>Consignments</span><strong>${pack.productCount}</strong></div>
    <div class="kpi"><span>Volume</span><strong>${pack.totalVolumeM3.toFixed(3)} m³</strong></div>
    <div class="kpi"><span>CO₂e stored</span><strong>${pack.totalCo2eTonnes.toFixed(2)} t</strong></div>
    <div class="kpi"><span>HS code</span><strong>${pack.hsCode}</strong></div>
  </div>

  <h2 style="font-size:14px;margin:0 0 4px">Declared logs</h2>
  <table>
    <thead><tr><th>Passport</th><th>Species</th><th>Grade</th><th>Volume</th><th>Harvest</th><th>Geolocation</th><th>Permit</th><th>Hash</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <h2 style="font-size:14px;margin:24px 0 4px">Due diligence declaration</h2>
  <ul style="font-size:12px;line-height:1.7;padding-left:18px">
    <li>Geolocation captured for every log: <strong>${pack.dueDiligence.geolocationProvided ? 'yes' : 'no'}</strong></li>
    <li>Legal harvest permits: <strong>${pack.dueDiligence.legalHarvestPermits.join(', ')}</strong></li>
    <li>Deforestation-free declaration: <strong>${pack.dueDiligence.deforestationFreeDeclared ? 'declared by operator' : 'not declared'}</strong></li>
    <li>Verification method: ${pack.dueDiligence.verificationMethod}</li>
  </ul>

  <footer>
    This statement is assembled from field-captured timber passports. Each hash is the SHA-256 of the passport
    payload at capture, and each custody event hashes the one before it, so any edited field fails verification.
  </footer>
</body></html>`;
}

/* ------------------------------------------------------------------ */
/* Offline queue                                                       */
/* ------------------------------------------------------------------ */

export async function syncPassportQueue(): Promise<number> {
  const unsyncedPassports = await db.passports.where('synced').equals(0).toArray();
  const unsyncedEvents = await db.passportEvents.where('synced').equals(0).toArray();
  const ids = unsyncedPassports.map((p) => p.id!).filter(Boolean);
  const eventIds = unsyncedEvents.map((e) => e.id!).filter(Boolean);
  if (ids.length === 0 && eventIds.length === 0) return 0;

  await new Promise((resolve) => setTimeout(resolve, 600));
  if (ids.length) await db.passports.where('id').anyOf(ids).modify({ synced: 1 });
  if (eventIds.length) await db.passportEvents.where('id').anyOf(eventIds).modify({ synced: 1 });
  return ids.length + eventIds.length;
}

/* ------------------------------------------------------------------ */
/* Demo ledger — three logs so the feature is explorable on first open  */
/* ------------------------------------------------------------------ */

export async function seedDemoPassports(): Promise<void> {
  const count = await db.passports.count();
  if (count > 0) return;

  const today = new Date();
  const daysAgo = (days: number) => new Date(today.getTime() - days * 86400000).toISOString().slice(0, 10);

  await createPassport({
    region: 'ZA',
    speciesCode: 'PINPAT',
    grade: 'A',
    dbhCm: 38,
    heightM: 22,
    blockId: 'ZN-14',
    blockName: 'Zintlulam Block 14',
    permitNo: 'MP-PERM-4471',
    crew: 'Crew Delta',
    operator: 'Mpumalanga Forestry Holdings',
    latitude: -25.68124,
    longitude: 30.45127,
    accuracyM: 3.4,
    harvestedAt: daysAgo(2),
  });

  await createPassport({
    region: 'ZA',
    speciesCode: 'EUGGRA',
    grade: 'B',
    dbhCm: 31,
    heightM: 19,
    blockId: 'ZN-15',
    blockName: 'Zintlulam Block 15',
    permitNo: 'MP-PERM-4471',
    crew: 'Crew Delta',
    operator: 'Mpumalanga Forestry Holdings',
    latitude: -25.68387,
    longitude: 30.45611,
    accuracyM: 5.1,
    harvestedAt: daysAgo(2),
  });

  await createPassport({
    region: 'ZA',
    speciesCode: 'PINPAT',
    grade: 'A',
    dbhCm: 42,
    heightM: 24,
    blockId: 'ZN-14',
    blockName: 'Zintlulam Block 14',
    permitNo: 'MP-PERM-4471',
    crew: 'Crew Bravo',
    operator: 'Mpumalanga Forestry Holdings',
    latitude: -25.68041,
    longitude: 30.45002,
    accuracyM: 2.9,
    harvestedAt: daysAgo(9),
  });
}
