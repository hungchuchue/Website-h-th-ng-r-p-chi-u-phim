import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { once } from 'node:events';
import type { Server } from 'node:http';
Object.assign(process.env, {
    NODE_ENV: 'test',
    CINEMA_ENABLED: 'false',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/unused_test',
    ADMIN_EMAIL: 'legacy@example.test',
    ADMIN_PASSWORD: 'not-used-by-these-read-only-tests',
    ADMIN_JWT_SECRET: 'legacy-test-secret-at-least-32-characters',
    PORT: '3002',
});
const { default: app } = require('../../../src/app') as typeof import('../../../src/app');
const { startCinemaRuntime, stopCinemaRuntime } =
    require('../../../src/jobs/cinema.runtime') as typeof import('../../../src/jobs/cinema.runtime');
let server: Server, base: string;
before(async () => {
    await startCinemaRuntime();
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert(address && typeof address !== 'string');
    base = `http://127.0.0.1:${address.port}`;
});
after(async () => {
    await stopCinemaRuntime();
    if (server) {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
            server.close((e) => (e ? reject(e) : resolve())),
        );
    }
});
test('disabled Cinema does not require SQL Server and preserves legacy health and Swagger', async () => {
    assert.equal((await fetch(base + '/health')).status, 200);
    assert.equal((await fetch(base + '/api-docs/')).status, 200);
    const legacyBefore = await (await fetch(base + '/api-docs/swagger-ui-init.js')).text();
    assert.equal((await fetch(base + '/api/v1/bookings/my-history')).status, 404);
    assert.equal((await fetch(base + '/api/v1/cinema/openapi.json')).status, 200);
    assert.equal((await fetch(base + '/api/v1/cinema/docs/')).status, 200);
    const legacyAfter = await (await fetch(base + '/api-docs/swagger-ui-init.js')).text();
    assert.equal(
        legacyAfter,
        legacyBefore,
        'Cinema docs must not overwrite the legacy Swagger initializer',
    );
});
test('CORS permits the approved idempotency and correlation headers', async () => {
    const r = await fetch(base + '/api/v1/bookings/holds', {
        method: 'OPTIONS',
        headers: {
            Origin: 'http://localhost:5173',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers':
                'authorization,content-type,idempotency-key,x-correlation-id',
        },
    });
    assert.equal(r.status, 204);
    const allowed = r.headers.get('access-control-allow-headers')!.toLowerCase();
    assert(allowed.includes('idempotency-key'));
    assert(allowed.includes('x-correlation-id'));
    assert(allowed.includes('x-device-id'));
});
