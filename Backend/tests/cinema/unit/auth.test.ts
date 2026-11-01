import { createCinemaAuthService } from '../../../src/services/cinema.auth.service';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';

import type { AccountRow, CinemaRole } from '../../../src/types/cinema.types';
process.env.NODE_ENV = 'test';
process.env.CINEMA_JWT_SECRET = 'cinema-unit-test-secret-with-more-than-32-bytes';
process.env.ADMIN_JWT_SECRET = 'legacy-unit-test-secret-with-more-than-32-bytes';
const rows = new Map<string, AccountRow>();
let nextId = 1;
const accounts = {
    find: async (email: string, role: CinemaRole) => rows.get(`${role}:${email}`),
    byId: async (id: number, role: CinemaRole) =>
        [...rows.entries()].find(([k, v]) => k.startsWith(role + ':') && v.id === id)?.[1],
    create: async (email: string, hash: string, name: string, role: CinemaRole = 'CUSTOMER') => {
        const row = {
            id: nextId++,
            email,
            mat_khau: hash,
            ho_ten: name,
            dang_hoat_dong: true,
        };
        rows.set(`${role}:${email}`, row);
        return row;
    },
};
const service = createCinemaAuthService(accounts);
test('Cinema registration stores Argon2id, excludes hashes and issues a scoped JWT', async () => {
    const result = await service.register({
        email: ' CUSTOMER@example.test ',
        password: ' Correct password with spaces ',
        displayName: 'Customer',
    });
    assert.match(rows.get('CUSTOMER:customer@example.test')!.mat_khau, /^\$argon2id\$/);
    assert(!JSON.stringify(result).includes('$argon2'));
    assert.deepEqual(await service.authenticate('Bearer ' + result.accessToken), {
        id: result.user.id,
        role: 'CUSTOMER',
    });
    const claims = jwt.verify(result.accessToken, process.env.CINEMA_JWT_SECRET!, {
        issuer: 'troond-cinema',
        audience: 'troond-cinema-api',
        algorithms: ['HS256'],
    }) as jwt.JwtPayload;
    assert.equal(claims.role, 'CUSTOMER');
    assert.equal(claims.sub, `CUSTOMER:${result.user.id}`);
    const valid = await service.login({
        email: 'customer@example.test',
        password: ' Correct password with spaces ',
    });
    assert.equal(valid.user.role, 'CUSTOMER');
    await assert.rejects(
        service.login({ email: 'customer@example.test', password: 'wrong' }),
        (e) => Boolean(e && typeof e === 'object' && 'statusCode' in e && e.statusCode === 401),
    );
    await assert.rejects(
        service.login({
            email: 'customer@example.test',
            password: 'Correct password with spaces',
        }),
    );
    const row = rows.get('CUSTOMER:customer@example.test')!;
    row.dang_hoat_dong = false;
    await assert.rejects(service.authenticate('Bearer ' + result.accessToken));
    row.dang_hoat_dong = true;
});
test('registration cannot select ADMIN and legacy or wrong-audience tokens are rejected', async () => {
    await assert.rejects(
        service.register({
            email: 'attacker@example.test',
            password: 'ExamplePassword123!',
            role: 'ADMIN',
        }),
    );
    const forged = jwt.sign(
        { role: 'ADMIN', userId: 1, type: 'access' },
        process.env.ADMIN_JWT_SECRET!,
        {
            subject: 'ADMIN:1',
            issuer: 'troond-cinema',
            audience: 'troond-cinema-api',
        },
    );
    await assert.rejects(service.authenticate('Bearer ' + forged));
    const wrongAudience = jwt.sign(
        { role: 'CUSTOMER', userId: 1, type: 'access' },
        process.env.CINEMA_JWT_SECRET!,
        { subject: 'CUSTOMER:1', issuer: 'troond-cinema', audience: 'another-app' },
    );
    await assert.rejects(service.authenticate('Bearer ' + wrongAudience));
});
