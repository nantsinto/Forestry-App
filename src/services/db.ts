import Dexie, { Table } from 'dexie';

export interface BreadcrumbRecord {
  id?: number;
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  speed?: number | null;
  timestamp: string;
  synced: number; // 0 = unsynced, 1 = synced
  rangerId: string;
  rangerName: string;
  canopyDensity: 'Dense' | 'Moderate' | 'Sparse' | 'Clear';
  batteryLevel: number;
  mode: 'hardware_gps' | 'simulated_patrol';
}

export interface SensorEventRecord {
  id?: number;
  nodeId: string;
  zone: string;
  readingType: 'acoustic' | 'thermal' | 'smoke' | 'moisture' | 'tamper';
  value: number;
  unit: string;
  threshold: number;
  status: 'nominal' | 'warning' | 'critical';
  timestamp: string;
  synced: number;
}

export interface AuditFindingRecord {
  id?: number;
  auditId: string;
  module: string;
  scope: string;
  status: 'Compliant' | 'Moderate' | 'Critical';
  resolutionDays: string;
  notes: string;
  auditor: string;
  lastVerified: string;
}

export interface DispatchAlertRecord {
  id?: number;
  alertId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  location: string;
  coordinates: [number, number];
  timestamp: string;
  status: 'Active' | 'Dispatched' | 'Resolved';
  unitAssigned?: string;
}

class SilvaeGuardDatabase extends Dexie {
  breadcrumbs!: Table<BreadcrumbRecord, number>;
  sensorEvents!: Table<SensorEventRecord, number>;
  auditFindings!: Table<AuditFindingRecord, number>;
  dispatchAlerts!: Table<DispatchAlertRecord, number>;

  constructor() {
    super('SilvaeGuardTelemetry');
    this.version(1).stores({
      breadcrumbs: '++id, latitude, longitude, accuracy, timestamp, synced, rangerId',
      sensorEvents: '++id, nodeId, zone, readingType, status, timestamp, synced',
      auditFindings: '++id, auditId, module, status',
      dispatchAlerts: '++id, alertId, severity, status, timestamp',
    });
  }
}

export const db = new SilvaeGuardDatabase();

// Initial seed data for Operations Audit SGA-2026-081
export const DEFAULT_AUDIT_FINDINGS: Omit<AuditFindingRecord, 'id'>[] = [
  {
    auditId: 'SGA-2026-081',
    module: 'Perimeter Monitoring',
    scope: 'Sensor node health, LoRaWAN heartbeat, mesh latency',
    status: 'Compliant',
    resolutionDays: 'N/A',
    notes: 'All 34 solar perimeter nodes communicating within 45s heartbeat window with 99.8% packet delivery.',
    auditor: 'Sarah Jenkins, Operations & Compliance',
    lastVerified: '2026-11-10 14:30',
  },
  {
    auditId: 'SGA-2026-081',
    module: 'Incident Response & Dispatch',
    scope: 'Automated drone escalation and ground ranger dispatch time',
    status: 'Moderate',
    resolutionDays: '14 Days',
    notes: 'Canopy radio relay node Beta-04 had 4.2 min dispatch delay during simulated smoke alert test. Buffer capacitor upgrade scheduled.',
    auditor: 'Sarah Jenkins, Operations & Compliance',
    lastVerified: '2026-11-10 11:15',
  },
  {
    auditId: 'SGA-2026-081',
    module: 'Access & Identity (IAM)',
    scope: 'MFA enforcement, biometric field tokens, role-based boundaries',
    status: 'Compliant',
    resolutionDays: 'N/A',
    notes: 'FIDO2 hardware security keys enforced across all ranger telemetry units and base station admin consoles.',
    auditor: 'Sarah Jenkins, Operations & Compliance',
    lastVerified: '2026-11-09 16:45',
  },
  {
    auditId: 'SGA-2026-081',
    module: 'Data Continuity & Offline Dexie Queue',
    scope: 'Offsite telemetry log backups and deep-canopy breadcrumb retention',
    status: 'Moderate',
    resolutionDays: '30 Days',
    notes: 'IndexedDB local queue successfully retains up to 72 hours of coordinates; secondary cold S3 archive replication requires daily snapshot cron.',
    auditor: 'Sarah Jenkins, Operations & Compliance',
    lastVerified: '2026-11-09 10:20',
  },
  {
    auditId: 'SGA-2026-081',
    module: 'Labor Compliance & Worker Safety',
    scope: 'Lone-worker heartbeats, extreme heat index exposure, mandatory rest intervals',
    status: 'Compliant',
    resolutionDays: 'N/A',
    notes: 'Zero lone-worker check-in timeouts recorded in past 90 operational days. Automated fatigue pauses active.',
    auditor: 'Sarah Jenkins, Operations & Compliance',
    lastVerified: '2026-11-08 17:00',
  },
  {
    auditId: 'SGA-2026-081',
    module: 'Fleet & Autonomous Drone Telemetry',
    scope: 'Battery cycle degradation, geofence adherence, fail-safe parachute checks',
    status: 'Compliant',
    resolutionDays: 'N/A',
    notes: 'Drone Recon Units Alpha-1 & Alpha-2 calibrated with 100% boundary compliance along timber reserve boundary line.',
    auditor: 'Sarah Jenkins, Operations & Compliance',
    lastVerified: '2026-11-08 09:30',
  },
];

// Seed initial database if empty
export async function initializeDatabase() {
  const count = await db.auditFindings.count();
  if (count === 0) {
    await db.auditFindings.bulkAdd(DEFAULT_AUDIT_FINDINGS);
  }

  const breadcrumbsCount = await db.breadcrumbs.count();
  if (breadcrumbsCount === 0) {
    // Seed initial realistic breadcrumbs along Olympic Forest Trail
    const initialBreadcrumbs: Omit<BreadcrumbRecord, 'id'>[] = [
      {
        latitude: 47.8021,
        longitude: -123.6044,
        accuracy: 4.2,
        speed: 1.4,
        altitude: 480,
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
        synced: 1,
        rangerId: 'RNGR-07',
        rangerName: 'Ranger Davis',
        canopyDensity: 'Moderate',
        batteryLevel: 94,
        mode: 'simulated_patrol',
      },
      {
        latitude: 47.8045,
        longitude: -123.6012,
        accuracy: 5.1,
        speed: 1.3,
        altitude: 510,
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        synced: 1,
        rangerId: 'RNGR-07',
        rangerName: 'Ranger Davis',
        canopyDensity: 'Dense',
        batteryLevel: 89,
        mode: 'simulated_patrol',
      },
      {
        latitude: 47.8082,
        longitude: -123.5978,
        accuracy: 3.8,
        speed: 1.5,
        altitude: 545,
        timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
        synced: 0,
        rangerId: 'RNGR-07',
        rangerName: 'Ranger Davis',
        canopyDensity: 'Dense',
        batteryLevel: 82,
        mode: 'simulated_patrol',
      },
      {
        latitude: 47.8115,
        longitude: -123.5935,
        accuracy: 6.0,
        speed: 1.2,
        altitude: 590,
        timestamp: new Date().toISOString(),
        synced: 0,
        rangerId: 'RNGR-07',
        rangerName: 'Ranger Davis',
        canopyDensity: 'Dense',
        batteryLevel: 78,
        mode: 'simulated_patrol',
      },
    ];
    await db.breadcrumbs.bulkAdd(initialBreadcrumbs);
  }

  const alertCount = await db.dispatchAlerts.count();
  if (alertCount === 0) {
    await db.dispatchAlerts.bulkAdd([
      {
        alertId: 'ALT-9041',
        severity: 'critical',
        title: 'Thermal Spike / Smolder Detected (48.2°C)',
        location: 'Zone 4 - Cedar Ridge Sector B',
        coordinates: [47.8142, -123.5891],
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        status: 'Active',
        unitAssigned: 'Drone Recon Alpha-1',
      },
      {
        alertId: 'ALT-9038',
        severity: 'medium',
        title: 'Acoustic Signature: Chain Motor Frequency (185 Hz)',
        location: 'West Perimeter Buffer (KM 14.2)',
        coordinates: [47.7985, -123.6125],
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        status: 'Dispatched',
        unitAssigned: 'Ranger Unit 03 (E. Vance)',
      },
    ]);
  }
}
