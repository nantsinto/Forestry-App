/**
 * Regional data packs.
 *
 * Everything a timber passport needs that changes by country — species list, wood
 * density for the biomass estimate, the regulator and the compliance regime the
 * passport feeds — lives here as data, not as hardcoded branches in the UI.
 * Adding a region means adding an entry, not code.
 */

export interface SpeciesEntry {
  code: string;
  common: string;
  scientific: string;
  /** Oven-dry wood density in g/cm³, used by the Chave 2014 biomass estimate. */
  density: number;
  /** Merchantable volume form factor for the stem. */
  formFactor: number;
}

export interface Region {
  code: string;
  name: string;
  /** Regulator / certification scheme shown on the passport and the due-diligence pack. */
  regulator: string;
  /** Regulatory regime this region's exports fall under. */
  regime: string;
  countryCode: string;
  currency: string;
  species: SpeciesEntry[];
}

export const REGIONS: Region[] = [
  {
    code: 'ZA',
    name: 'South Africa — Mpumalanga',
    regulator: 'DAFF · FSC FM/CoC',
    regime: 'EUDR (EU 2023/1115) + FSC',
    countryCode: 'ZA',
    currency: 'ZAR',
    species: [
      { code: 'PINPAT', common: 'Patula pine', scientific: 'Pinus patula', density: 0.45, formFactor: 0.45 },
      { code: 'PINELL', common: 'Slash pine', scientific: 'Pinus elliottii', density: 0.53, formFactor: 0.44 },
      { code: 'EUGGRA', common: 'Saligna gum', scientific: 'Eucalyptus grandis', density: 0.55, formFactor: 0.42 },
      { code: 'ACAME', common: 'Black wattle', scientific: 'Acacia mearnsii', density: 0.62, formFactor: 0.42 },
    ],
  },
  {
    code: 'BR',
    name: 'Brazil — Mato Grosso',
    regulator: 'IBAMA · DOF',
    regime: 'EUDR (EU 2023/1115) + FSC',
    countryCode: 'BR',
    currency: 'BRL',
    species: [
      { code: 'TECGRA', common: 'Teak', scientific: 'Tectona grandis', density: 0.6, formFactor: 0.43 },
      { code: 'EUGURO', common: 'Urophylla eucalypt', scientific: 'Eucalyptus urophylla', density: 0.58, formFactor: 0.42 },
      { code: 'SWIMAC', common: 'Big-leaf mahogany', scientific: 'Swietenia macrophylla', density: 0.52, formFactor: 0.46 },
      { code: 'PINTAE', common: 'Loblolly pine', scientific: 'Pinus taeda', density: 0.51, formFactor: 0.44 },
    ],
  },
  {
    code: 'ID',
    name: 'Indonesia — Kalimantan',
    regulator: 'SVLK · Ministry of Environment and Forestry',
    regime: 'EUDR (EU 2023/1115) + SVLK',
    countryCode: 'ID',
    currency: 'IDR',
    species: [
      { code: 'SHOSPP', common: 'Meranti', scientific: 'Shorea spp.', density: 0.47, formFactor: 0.45 },
      { code: 'TECGRA', common: 'Teak', scientific: 'Tectona grandis', density: 0.6, formFactor: 0.43 },
      { code: 'ACAMAN', common: 'Mangium', scientific: 'Acacia mangium', density: 0.5, formFactor: 0.43 },
      { code: 'PARFAL', common: 'Falcataria', scientific: 'Falcataria moluccana', density: 0.35, formFactor: 0.44 },
    ],
  },
  {
    code: 'SE',
    name: 'Sweden — Norrland',
    regulator: 'Skogsstyrelsen · PEFC',
    regime: 'EUDR (EU 2023/1115) + PEFC',
    countryCode: 'SE',
    currency: 'SEK',
    species: [
      { code: 'PICABI', common: 'Norway spruce', scientific: 'Picea abies', density: 0.4, formFactor: 0.46 },
      { code: 'PINSYL', common: 'Scots pine', scientific: 'Pinus sylvestris', density: 0.48, formFactor: 0.46 },
      { code: 'BETPEN', common: 'Silver birch', scientific: 'Betula pendula', density: 0.51, formFactor: 0.44 },
      { code: 'QUEROB', common: 'Pedunculate oak', scientific: 'Quercus robur', density: 0.61, formFactor: 0.45 },
    ],
  },
];

export function getRegion(code: string): Region {
  return REGIONS.find((r) => r.code === code) ?? REGIONS[0];
}

export function getSpecies(regionCode: string, speciesCode: string): SpeciesEntry {
  const region = getRegion(regionCode);
  return region.species.find((s) => s.code === speciesCode) ?? region.species[0];
}

export type VolumeUnit = 'm3' | 'cft';

export const VOLUME_UNITS: { id: VolumeUnit; label: string; suffix: string }[] = [
  { id: 'm3', label: 'Cubic metres', suffix: 'm³' },
  { id: 'cft', label: 'Cubic feet', suffix: 'ft³' },
];

const CFT_PER_M3 = 35.3147;

export function formatVolume(volumeM3: number, unit: VolumeUnit): string {
  if (unit === 'cft') {
    return `${(volumeM3 * CFT_PER_M3).toFixed(2)} ft³`;
  }
  return `${volumeM3.toFixed(3)} m³`;
}

export function formatDate(isoDate: string, regionCode: string): string {
  const locale = regionCode === 'BR' ? 'pt-BR' : regionCode === 'ID' ? 'id-ID' : regionCode === 'SE' ? 'sv-SE' : 'en-ZA';
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
