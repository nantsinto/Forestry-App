import { expect, test, type Page } from '@playwright/test';
import {
  canonicalPassport,
  custodyHash,
  decodePublicPassportToken,
  mutateLedger,
  readLedger,
  sha256Hex,
  type StoredPassport,
} from './helpers/ledger';

/**
 * Timber passport end-to-end coverage:
 *  1. the SHA-256 hash on a captured passport (and its `created` custody event),
 *  2. the on-device QR label and the offline buyer view it opens,
 *  3. an offline custody handover, plus tamper detection for both the passport
 *     payload and the chain link between handovers.
 *
 * Every test cleans up the records it created so the sandbox ledger is left as found.
 */

const HEX64 = /^[0-9a-f]{64}$/;

function passportCard(page: Page, passportId: string) {
  return page.locator('[data-testid="passport-list"] > div').filter({ hasText: passportId });
}

async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('passport-list')).toBeVisible();
}

async function readStoredPassport(page: Page, blockId: string): Promise<StoredPassport> {
  const { passports } = await readLedger(page);
  const passport = passports.find((p) => p.blockId === blockId);
  expect(passport, `passport stored for block ${blockId}`).toBeTruthy();
  return passport!;
}

/** Fills the capture modal with fixed values and returns the hashed record. */
async function capturePassport(page: Page, blockId: string): Promise<StoredPassport> {
  await page.getByTestId('new-passport-btn').click();
  await page.getByRole('combobox', { name: 'Grade', exact: true }).selectOption('A');
  await page.getByLabel('Diameter at breast height (cm)').fill('40');
  await page.getByLabel('Total height (m)').fill('22');
  await page.getByLabel('Block ID').fill(blockId);
  await page.getByLabel('Block name').fill(`E2E Block ${blockId}`);
  await page.getByLabel('Harvest permit').fill('E2E-PERM-01');
  await page.getByLabel('Harvest date').fill('2026-11-10');
  await page.getByLabel('Felling crew').fill('E2E Crew');
  await page.getByLabel('Operator').fill('E2E Operator');
  await page.getByLabel('Latitude').fill('-25.68124');
  await page.getByLabel('Longitude').fill('30.45127');
  await page.getByLabel('Accuracy in metres').fill('3.4');
  await page.getByTestId('create-passport-submit').click();

  await expect(passportCard(page, blockId)).toBeVisible();
  return readStoredPassport(page, blockId);
}

test('captures a passport and hashes its canonical payload with SHA-256', async ({ page }) => {
  await openApp(page);
  const stored = await capturePassport(page, 'E2E-HASH-01');

  // The stored hash is a real SHA-256 of the canonical payload, recomputed here
  // independently of the app's own verifyPassport().
  expect(stored.payloadHash).toMatch(HEX64);
  expect(sha256Hex(canonicalPassport(stored))).toBe(stored.payloadHash);

  // The first custody event seals the passport hash and hashes itself into the chain.
  const { events } = await readLedger(page);
  const created = events.filter((e) => e.passportId === stored.passportId).sort((a, b) => a.seq - b.seq)[0];
  expect(created, 'created custody event').toBeTruthy();
  expect(created.seq).toBe(1);
  expect(created.type).toBe('created');
  expect(created.previousHash).toBe(stored.payloadHash);
  expect(custodyHash(created, stored.payloadHash)).toBe(created.payloadHash);

  // The app's own verification agrees.
  await passportCard(page, stored.passportId).getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByTestId('verify-badge')).toContainText('Passport and custody chain verified');

  await mutateLedger(page, { action: 'removePassport', passportId: stored.passportId });
});

test('generates an on-device QR label that opens a verified buyer view', async ({ page }) => {
  await openApp(page);
  const { passports } = await readLedger(page);
  const passport = passports.find((p) => p.region === 'ZA')!;
  expect(passport, 'a seeded passport to label').toBeTruthy();
  await expect(passportCard(page, passport.passportId)).toBeVisible();

  await page.getByTestId(`label-${passport.passportId}`).click();

  // 1: the label is a locally rendered PNG, not a network image service.
  const qr = page.getByTestId('passport-qr');
  await expect(qr).toBeVisible();
  const src = await qr.getAttribute('src');
  expect(src).toMatch(/^data:image\/png;base64,iVBORw0KGgo/);
  const rendered = await qr.evaluate((img: HTMLImageElement) => ({
    width: img.naturalWidth,
    height: img.naturalHeight,
  }));
  expect(rendered.width).toBeGreaterThan(100);
  expect(rendered.height).toBeGreaterThan(100);

  // 2: the encoded payload carries this passport and its exact capture hash.
  const shareUrl = await page.getByRole('link', { name: 'Open buyer view' }).getAttribute('href');
  expect(shareUrl).toContain('#/p/');
  const payload = decodePublicPassportToken(shareUrl!.split('#/p/')[1]);
  expect(payload.i).toBe(passport.passportId);
  expect(payload.h).toBe(passport.payloadHash);
  expect(sha256Hex(canonicalPassport(passport))).toBe(payload.h);

  // 3: opening the label re-verifies it in the buyer's browser with no server.
  await page.goto(shareUrl!);
  await expect(page.getByTestId('public-passport-id')).toHaveText(passport.passportId);
  await expect(page.getByTestId('public-verify-badge')).toContainText('Verified offline');
  await expect(page.getByTestId('computed-hash')).toHaveText(passport.payloadHash);
});

test('appends custody offline, keeps the chain verifiable and detects tampering', async ({ page, context }) => {
  await openApp(page);
  const stored = await capturePassport(page, 'E2E-CHAIN-01');

  // 1: append a handover with the device offline — no network round trip involved.
  await context.setOffline(true);
  await passportCard(page, stored.passportId).getByRole('button', { name: 'Custody' }).click();
  await page.getByRole('combobox', { name: 'Handover type' }).selectOption('loaded');
  await page.getByLabel('Custodian / actor').fill('E2E Haulage');
  await page.getByLabel('Location').fill('E2E loading bay');
  await page.getByLabel('Note').fill('Seal E2E-0042');
  await page.getByTestId('append-custody-submit').click();
  await expect(passportCard(page, stored.passportId)).toContainText('2 custody events');

  // 2: the chain links and event hashes check out against an independent recompute.
  const ledger = await readLedger(page);
  const chain = ledger.events.filter((e) => e.passportId === stored.passportId).sort((a, b) => a.seq - b.seq);
  expect(chain).toHaveLength(2);
  expect(chain[1].type).toBe('loaded');
  expect(chain[1].actor).toBe('E2E Haulage');
  let previous = stored.payloadHash;
  for (const event of chain) {
    expect(event.previousHash).toBe(previous);
    expect(custodyHash(event, previous)).toBe(event.payloadHash);
    previous = event.payloadHash;
  }

  // 3: the app verifies the whole chain while still offline.
  await passportCard(page, stored.passportId).getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByTestId('verify-badge')).toContainText('Passport and custody chain verified');
  await page.getByRole('button', { name: 'Close' }).click();

  await context.setOffline(false);
  await page.reload();
  await expect(passportCard(page, stored.passportId)).toBeVisible();

  // 4: altering a captured field breaks the passport hash.
  await mutateLedger(page, {
    action: 'patchPassport',
    passportId: stored.passportId,
    patch: { volumeM3: stored.volumeM3 + 1 },
  });
  await page.reload();
  await passportCard(page, stored.passportId).getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByTestId('verify-badge')).toContainText('Verification failed');
  await page.getByRole('button', { name: 'Close' }).click();

  const tampered = await readLedger(page);
  const tamperedPassport = tampered.passports.find((p) => p.passportId === stored.passportId)!;
  expect(sha256Hex(canonicalPassport(tamperedPassport))).not.toBe(tamperedPassport.payloadHash);

  // 5: restoring the passport but editing a handover breaks the chain link instead.
  await mutateLedger(page, {
    action: 'patchPassport',
    passportId: stored.passportId,
    patch: { volumeM3: stored.volumeM3 },
  });
  await mutateLedger(page, {
    action: 'patchEvent',
    passportId: stored.passportId,
    seq: 2,
    patch: { actor: 'Tampered Actor' },
  });
  await page.reload();
  await passportCard(page, stored.passportId).getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByTestId('verify-badge')).toContainText('Verification failed');
  await page.getByRole('button', { name: 'Close' }).click();

  const restored = await readLedger(page);
  const restoredPassport = restored.passports.find((p) => p.passportId === stored.passportId)!;
  const restoredChain = restored.events
    .filter((e) => e.passportId === stored.passportId)
    .sort((a, b) => a.seq - b.seq);
  expect(sha256Hex(canonicalPassport(restoredPassport))).toBe(restoredPassport.payloadHash);
  expect(restoredChain[1].previousHash).toBe(restoredChain[0].payloadHash);
  expect(custodyHash(restoredChain[1], restoredChain[0].payloadHash)).not.toBe(restoredChain[1].payloadHash);

  // 6: clean up the record this test created.
  await mutateLedger(page, { action: 'removePassport', passportId: stored.passportId });
  await page.reload();
  await expect(passportCard(page, stored.passportId)).toHaveCount(0);
});
