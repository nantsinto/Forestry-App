import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';

/**
 * Test-side access to the app's browser-local ledger (IndexedDB `SilvaeGuardTelemetry`).
 *
 * The hash helpers below deliberately re-implement the canonical payload format from
 * `src/services/passport.ts` so the tests check the hashes against an independent
 * implementation instead of trusting the app to verify itself. If the canonical
 * format changes, these helpers must change with it.
 */

export interface StoredPassport {
  passportId: string;
  speciesCode: string;
  grade: string;
  volumeM3: number;
  blockId: string;
  blockName: string;
  latitude: number;
  longitude: number;
  harvestedAt: string;
  permitNo: string;
  operator: string;
  crew: string;
  region: string;
  previousHash: string;
  payloadHash: string;
  status: string;
}

export interface StoredEvent {
  passportId: string;
  seq: number;
  type: string;
  actor: string;
  location: string;
  note: string;
  timestamp: string;
  previousHash: string;
  payloadHash: string;
}

export type LedgerOp =
  | { action: 'patchPassport'; passportId: string; patch: Record<string, unknown> }
  | { action: 'patchEvent'; passportId: string; seq: number; patch: Record<string, unknown> }
  | { action: 'removePassport'; passportId: string };

export const GENESIS_HASH = '0'.repeat(64);

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Same field order and number formatting as `canonicalPassport()` in the app. */
export function canonicalPassport(p: StoredPassport): string {
  return [
    p.passportId,
    p.speciesCode,
    p.grade,
    p.volumeM3.toFixed(3),
    p.blockId,
    p.latitude.toFixed(5),
    p.longitude.toFixed(5),
    p.harvestedAt.slice(0, 10),
    p.permitNo,
    p.operator,
    p.crew,
    p.region,
  ].join('|');
}

/** Same event pre-image as `appendEvent()`/`verifyPassport()` in the app. */
export function custodyHash(event: StoredEvent, previousHash: string): string {
  return sha256Hex(
    [event.passportId, event.seq, event.type, event.actor, event.location, event.timestamp, previousHash].join('|')
  );
}

/** Decodes the `#/p/<token>` payload a printed QR label carries. */
export function decodePublicPassportToken(token: string): Record<string, unknown> {
  const padded = token.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function readLedger(page: Page): Promise<{ passports: StoredPassport[]; events: StoredEvent[] }> {
  return page.evaluate(async () => {
    const openRequest = indexedDB.open('SilvaeGuardTelemetry');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () => reject(openRequest.error);
    });
    const readAll = (storeName: string) =>
      new Promise<unknown[]>((resolve, reject) => {
        const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const [passports, events] = await Promise.all([readAll('passports'), readAll('passportEvents')]);
    db.close();
    return { passports, events };
  }) as Promise<{ passports: StoredPassport[]; events: StoredEvent[] }>;
}

/**
 * Tamper with, or clean up, the ledger the way a hostile client or a wiped device
 * would — a direct storage write, never the app's own verified write path.
 */
export async function mutateLedger(page: Page, op: LedgerOp): Promise<void> {
  await page.evaluate(async (operation) => {
    const openRequest = indexedDB.open('SilvaeGuardTelemetry');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () => reject(openRequest.error);
    });

    const stores =
      operation.action === 'removePassport'
        ? ['passports', 'passportEvents']
        : operation.action === 'patchPassport'
          ? ['passports']
          : ['passportEvents'];

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(stores, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);

      for (const storeName of stores) {
        const request = tx.objectStore(storeName).openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          const row = cursor.value as { passportId: string; seq?: number };
          if (row.passportId === operation.passportId) {
            if (operation.action === 'removePassport') {
              cursor.delete();
            } else if (operation.action === 'patchPassport') {
              cursor.update({ ...cursor.value, ...operation.patch });
            } else if (operation.action === 'patchEvent' && row.seq === operation.seq) {
              cursor.update({ ...cursor.value, ...operation.patch });
            }
          }
          cursor.continue();
        };
      }
    });

    db.close();
  }, op);
}
