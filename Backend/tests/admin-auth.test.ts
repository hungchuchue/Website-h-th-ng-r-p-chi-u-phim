import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import jwt from 'jsonwebtoken';

const password = ' Test password with spaces ';
const salt = 'admin-auth-test-salt';
const digest = pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('base64url');
const secret = 'test-jwt-secret-for-admin-auth-only-32-chars';

// Test credentials stay inside this worker; no database connection is opened.
Object.assign(process.env, {
  NODE_ENV: 'development',
  PORT: '3002',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/backend_test',
  ADMIN_EMAIL: 'Admin@Example.test',
  ADMIN_PASSWORD: `pbkdf2_sha256$1000$${salt}$${digest}`,
  ADMIN_JWT_SECRET: secret,
  ADMIN_JWT_EXPIRES_IN: '15m',
});

const { default: app } = require('../src/app') as typeof import('../src/app');
let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (!server) return;
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

async function login(body: unknown) {
  return fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('health responds successfully', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ok');
});

test('correct PBKDF2 password returns a signed admin JWT', async () => {
  const response = await login({ email: ' ADMIN@example.test ', password });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.code, 200);
  assert.equal(body.data.tokenType, 'Bearer');
  assert.equal(body.data.expiresIn, '15m');
  const claims = jwt.verify(body.data.accessToken, secret);
  assert.equal(typeof claims, 'object');
  assert.equal((claims as jwt.JwtPayload).sub, 'admin@example.test');
  assert.equal((claims as jwt.JwtPayload).role, 'admin');
});

test('wrong password with the correct admin email returns 401', async () => {
  const response = await login({ email: 'admin@example.test', password: 'incorrect-password' });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { code: 401, message: 'Invalid admin credentials.', data: null });
});

test('password whitespace is preserved', async () => {
  const response = await login({ email: 'admin@example.test', password: password.trim() });
  assert.equal(response.status, 401);
});

test('unknown admin returns 401', async () => {
  const response = await login({ email: 'unknown@example.test', password });
  assert.equal(response.status, 401);
});

test('missing and invalid login fields return 400', async () => {
  for (const body of [{}, { email: 'admin@example.test' }, { email: 123, password },
    { email: 'admin@example.test', password: false }, { email: ' ', password }, []]) {
    const response = await login(body);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 400);
  }
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, { method: 'POST' });
  assert.equal(response.status, 400);
});

test('malformed JSON returns 400', async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 400);
});

test('Swagger loads and uses the configured development port', async () => {
  const page = await fetch(`${baseUrl}/api-docs/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Swagger UI/);
  const init = await fetch(`${baseUrl}/api-docs/swagger-ui-init.js`);
  assert.equal(init.status, 200);
  const script = await init.text();
  assert.match(script, /http:\/\/localhost:3002\/api\/v1/);
  assert.match(script, /\/auth\/login/);
});
