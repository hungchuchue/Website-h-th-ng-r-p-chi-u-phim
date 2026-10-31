import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { after, mock, test } from 'node:test';
import { getAdMobKeys, verifyAdMobCallback } from '../src/lib/admob';
import { hashPassword, verifyPassword } from '../src/utils/validation';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const base64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const fetchMock = mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
  keys: [{ keyId: 1, pem }, { keyId: 2, base64 }],
}), { status: 200, headers: { 'Content-Type': 'application/json' } }));

after(() => mock.restoreAll());

test('legacy password hashes remain supported', async () => {
  const hash = hashPassword('legacy-password');
  assert.equal(await verifyPassword('legacy-password', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
  assert.equal(await verifyPassword('legacy-password', 'invalid-hash'), false);
});

const message = 'ad_network=test&reward_amount=1&transaction_id=test-transaction';
const signature = sign('sha256', Buffer.from(message), privateKey).toString('base64url');
const query = `${message}&signature=${signature}&key_id=1`;

test('AdMob verifies a valid PEM public key', async () => {
  assert.equal(await verifyAdMobCallback(query, signature, '1'), true);
});

test('AdMob verifies a base64 DER public key', async () => {
  assert.equal(await verifyAdMobCallback(query, signature, '2'), true);
});

test('AdMob rejects tampered data, unknown keys and missing signatures', async () => {
  assert.equal(await verifyAdMobCallback(query.replace('reward_amount=1', 'reward_amount=2'), signature, '1'), false);
  assert.equal(await verifyAdMobCallback(query, signature, '999'), false);
  assert.equal(await verifyAdMobCallback(message, signature, '1'), false);
});

test('AdMob reuses cached verification keys', async () => {
  assert.equal(await getAdMobKeys(), await getAdMobKeys());
  assert.equal(fetchMock.mock.calls.length, 1);
});
