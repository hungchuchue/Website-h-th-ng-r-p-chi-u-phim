import { createCinemaAuthRepository } from '../../../src/repositories/cinema.auth.repository';
import { createCinemaCatalogRepository } from '../../../src/repositories/cinema.catalog.repository';
import { createCinemaBookingRepository } from '../../../src/repositories/cinema.booking.repository';
import { createCinemaOutboxRepository } from '../../../src/repositories/cinema.outbox.repository';
import { createCinemaAuthService } from '../../../src/services/cinema.auth.service';
import { createCinemaPaymentService } from '../../../src/services/cinema.payment.service';
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import type { Server } from 'node:http';
import express from 'express';
import sql from 'mssql';
import { loadEnvironment } from '../../../src/scripts/cinema.common';
import { getCinemaPool, closeCinemaPool } from '../../../src/config/cinema.database';
import { runMigrations, migrationStatus } from '../../../src/utils/cinema.migrations';

import { hashCinemaPassword } from '../../../src/services/cinema.auth.service';

import { SimulatorGateway, signCallback } from '../../../src/lib/cinema.simulator';
import { OutboxProcessor } from '../../../src/jobs/cinema.outbox.worker';
import { createCinemaRouter } from '../../../src/routes/cinema.routes';
import { holdHash } from '../../../src/utils/cinema.validation';
import { sqlErrorNumber } from '../../../src/middleware/cinema.errors.middleware';
import type {
    BookingRow,
    PaymentCallback,
    PaymentGateway,
    PaymentRow,
} from '../../../src/types/cinema.types';

loadEnvironment();
const testDatabase = process.env.CINEMA_TEST_DATABASE;
if (
    !testDatabase ||
    !/test/i.test(testDatabase) ||
    testDatabase === process.env.CINEMA_SQLSERVER_DATABASE ||
    !process.env.CINEMA_SQLSERVER_HOST ||
    !process.env.CINEMA_SQLSERVER_USER ||
    !process.env.CINEMA_SQLSERVER_PASSWORD
) {
    throw new Error(
        'SQL Server integration tests NOT RUN: configure CINEMA_SQLSERVER_HOST/USER/PASSWORD and a dedicated CINEMA_TEST_DATABASE containing "test", different from CINEMA_SQLSERVER_DATABASE. No database was created or modified.',
    );
}
Object.assign(process.env, {
    NODE_ENV: 'test',
    CINEMA_ENABLED: 'true',
    CINEMA_SQLSERVER_DATABASE: testDatabase,
    CINEMA_WORKERS_ENABLED: 'false',
    CINEMA_MIGRATION_TARGET: 'test',
    CINEMA_JWT_SECRET: randomBytes(32).toString('hex'),
    CINEMA_SIMULATOR_SECRET: randomBytes(32).toString('hex'),
});
const runId = randomUUID().replace(/-/g, '');
const accounts = createCinemaAuthRepository(),
    catalog = createCinemaCatalogRepository(),
    bookings = createCinemaBookingRepository(),
    outbox = createCinemaOutboxRepository(),
    auth = createCinemaAuthService();
const gateway = new SimulatorGateway(process.env.CINEMA_SIMULATOR_SECRET!, 'test');
const paymentService = createCinemaPaymentService(bookings, undefined, () => gateway);
let pool: sql.ConnectionPool,
    customerA: number,
    customerB: number,
    cinemaId: number,
    movieId: number,
    server: Server,
    base: string;
let tokenA: string, tokenB: string, adminToken: string;
const password = 'IntegrationTestPassword123!';
before(async () => {
    pool = await getCinemaPool();
    await runMigrations(pool);
    await runMigrations(pool);
    const state = await migrationStatus(pool);
    assert.equal(state.drift, false);
    assert.equal(state.objects.tables.length, 14);
    assert.equal(state.objects.procedures.length, 8);
    assert(state.migrations.every((x) => x.status === 'applied'));
    const hash = await hashCinemaPassword(password);
    const a = await accounts.create(`${runId}.a@example.test`, hash, 'Integration Customer A'),
        b = await accounts.create(`${runId}.b@example.test`, hash, 'Integration Customer B');
    customerA = a.id;
    customerB = b.id;
    const admin = await accounts.create(
        `${runId}.admin@example.test`,
        hash,
        'Integration Administrator',
        'ADMIN',
    );
    tokenA = (await auth.login({ email: a.email, password })).accessToken;
    tokenB = (await auth.login({ email: b.email, password })).accessToken;
    adminToken = (await auth.login({ email: admin.email, password, accountType: 'ADMIN' }))
        .accessToken;
    cinemaId = (
        await catalog.createCinema(`TEST-${runId}`, 'Integration fixture address', 'Test City')
    ).id;
    movieId = (
        await catalog.createMovie({
            title: `TEST-${runId}`,
            description: 'Isolated integration fixture',
            genres: 'Test',
            director: 'Test',
            duration: 120,
            releaseDate: new Date().toISOString().slice(0, 10),
            posterUrl: 'https://example.test/poster.png',
            trailerUrl: null,
            status: 'DANG_CHIEU',
        })
    ).id;
    const app = express();
    app.use(express.json());
    app.use('/api/v1', createCinemaRouter({ enabled: () => true, environment: 'test' }));
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert(address && typeof address !== 'string');
    base = `http://127.0.0.1:${address.port}`;
});
after(async () => {
    if (server) {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
            server.close((e) => (e ? reject(e) : resolve())),
        );
    }
    await closeCinemaPool();
});
async function fixture() {
    const room = await catalog.createRoom(cinemaId, 'TEST-' + randomUUID(), [
        { row: 'A', number: 1, name: 'A1', type: 'THUONG', surcharge: 0 },
        { row: 'A', number: 2, name: 'A2', type: 'VIP', surcharge: 10000 },
    ]);
    const showtime = await catalog.createShowtime(
        movieId,
        room.id,
        new Date(Date.now() + 86400000),
        75000,
    );
    const seats = (await catalog.physicalSeats(cinemaId)).filter(
        (s) => s.id_phong_chieu === room.id,
    );
    return { room, showtime, seats };
}
async function hold(
    f: Awaited<ReturnType<typeof fixture>>,
    customer = customerA,
    seatIds = [f.seats[0]!.id],
    key = randomUUID(),
): Promise<BookingRow> {
    return bookings.hold(
        customer,
        f.showtime.id,
        seatIds,
        key,
        holdHash(f.showtime.id, seatIds),
        7,
    );
}
async function initiate(order: BookingRow) {
    return bookings.startPayment(order.id, order.id_khach_hang, randomUUID(), 'simulator');
}
async function callback(
    p: PaymentRow,
    status: PaymentCallback['status'],
    transactionId = 'SIM-' + randomUUID(),
    amount = p.so_tien,
) {
    const body: PaymentCallback = {
        bookingId: p.id_don_hang,
        paymentReference: p.ma_yeu_cau,
        transactionId,
        amount,
        currency: 'VND',
        status,
        timestamp: Math.floor(Date.now() / 1000),
    };
    return paymentService.webhook(
        'simulator',
        body,
        signCallback(body, process.env.CINEMA_SIMULATOR_SECRET!),
    );
}
async function state(id: number) {
    return (
        await pool.request().input('id', sql.Int, id).query<{
            trang_thai: string;
        }>('SELECT trang_thai FROM dbo.DON_HANG WHERE id=@id')
    ).recordset[0]!.trang_thai;
}
async function expireFixture(id: number) {
    await pool
        .request()
        .input('id', sql.Int, id)
        .query(
            "UPDATE dbo.DON_HANG SET het_han_luc=DATEADD(SECOND,-1,SYSUTCDATETIME()) WHERE id=@id; UPDATE dbo.GHE_SUAT_CHIEU SET het_han_luc=DATEADD(SECOND,-1,SYSUTCDATETIME()) WHERE id_don_hang=@id AND trang_thai='DANG_GIU'",
        );
}
function authHeader(token: string) {
    return { Authorization: 'Bearer ' + token };
}

test('01 Customer A can hold A1 with a server-generated seven-minute expiry and price', async () => {
    const f = await fixture(),
        order = await hold(f);
    assert.equal(order.trang_thai, 'CHO_THANH_TOAN');
    assert.equal(order.tong_tien, 75000);
    const duration = new Date(order.het_han_luc).getTime() - new Date(order.tao_luc).getTime();
    assert(duration >= 419000 && duration <= 421000);
    assert.equal((await catalog.seats(f.showtime.id))[0]!.trang_thai, 'DANG_GIU');
});
test('02 Customer B cannot hold A1 while Customer A owns its live hold', async () => {
    const f = await fixture();
    await hold(f);
    await assert.rejects(hold(f, customerB), (e) => sqlErrorNumber(e) === 51002);
});
test('03 Fifty concurrent HTTP reservations produce exactly one 201 and forty-nine 409 responses', async () => {
    const f = await fixture();
    const results = await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
            fetch(base + '/api/v1/bookings/holds', {
                method: 'POST',
                headers: {
                    ...authHeader(i % 2 ? tokenA : tokenB),
                    'Content-Type': 'application/json',
                    'Idempotency-Key': randomUUID(),
                },
                body: JSON.stringify({
                    showtimeId: f.showtime.id,
                    seatIds: [f.seats[0]!.id],
                }),
            }),
        ),
    );
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(results.filter((r) => r.status === 409).length, 49);
});
test('04 Same identity/key/body replays one booking, changed body conflicts', async () => {
    const f = await fixture(),
        key = randomUUID(),
        a = await hold(f, customerA, [f.seats[0]!.id], key),
        b = await hold(f, customerA, [f.seats[0]!.id], key);
    assert.equal(a.id, b.id);
    assert.equal(b.replayed, true);
    await assert.rejects(
        hold(f, customerA, [f.seats[1]!.id], key),
        (e) => sqlErrorNumber(e) === 51002,
    );
});
test('05 Multi-seat holds are all-or-nothing', async () => {
    const f = await fixture();
    await hold(f, customerA);
    await assert.rejects(
        hold(
            f,
            customerB,
            f.seats.map((s) => s.id),
        ),
        (e) => sqlErrorNumber(e) === 51002,
    );
    assert.equal((await catalog.seats(f.showtime.id))[1]!.trang_thai, 'TRONG');
});
test('06 Expiry processing releases unpaid seats and allows a new owner', async () => {
    const f = await fixture(),
        order = await hold(f);
    await expireFixture(order.id);
    await bookings.expire();
    assert.equal(await state(order.id), 'HET_HAN');
    const b = await hold(f, customerB);
    assert.notEqual(order.id, b.id);
});
test('07 Verified definitive payment failure compensates the unpaid hold', async () => {
    const f = await fixture(),
        order = await hold(f),
        p = await initiate(order);
    await callback(p, 'FAILED');
    assert.equal(await state(order.id), 'THAT_BAI');
    assert.equal((await catalog.seats(f.showtime.id))[0]!.trang_thai, 'TRONG');
});
test('08 Verified success sells seats; expiry never releases a paid seat', async () => {
    const f = await fixture(),
        order = await hold(f),
        p = await initiate(order);
    await callback(p, 'SUCCESS');
    await bookings.expire();
    assert.equal(await state(order.id), 'DA_THANH_TOAN');
    assert.equal((await catalog.seats(f.showtime.id))[0]!.trang_thai, 'DA_BAN');
});
test('09 Repeated success callbacks and issuance retries create one ticket per seat', async () => {
    const f = await fixture(),
        order = await hold(f),
        p = await initiate(order),
        tx = 'SIM-' + randomUUID();
    await callback(p, 'SUCCESS', tx);
    const worker = new OutboxProcessor();
    await worker.processOne(`ISSUE:${order.id}`);
    await callback(p, 'SUCCESS', tx);
    await bookings.issue(order.id);
    const tickets = await bookings.tickets(order.id);
    assert.equal(tickets.length, 1);
    assert.match(tickets[0]!.qr_token, /^[A-F0-9]{64}$/);
    assert.equal(await state(order.id), 'HOAN_TAT');
});
test('10 Late success and FAILURE -> SUCCESS both enter refund without restoring seats', async () => {
    for (const failureFirst of [false, true]) {
        const f = await fixture(),
            order = await hold(f),
            p = await initiate(order);
        if (failureFirst) await callback(p, 'FAILED');
        else await expireFixture(order.id);
        await callback(p, 'SUCCESS');
        assert.equal(await state(order.id), 'CHO_HOAN_TIEN');
        assert.equal((await catalog.seats(f.showtime.id))[0]!.trang_thai, 'TRONG');
        assert.equal((await bookings.tickets(order.id)).length, 0);
        await new OutboxProcessor().processOne(`REFUND:${p.id}`);
        assert.equal((await bookings.payment(p.id))!.trang_thai, 'DA_HOAN_TIEN');
    }
});
test('11 Issuance outage preserves payment/sold seats and schedules a retry', async () => {
    const f = await fixture(),
        order = await hold(f),
        p = await initiate(order);
    await callback(p, 'SUCCESS');
    const failing = new OutboxProcessor(outbox, {
        issue: async () => {
            throw new Error('injected issuance outage');
        },
        payment: (id) => bookings.payment(id),
        confirmRefund: (id, ref, amount) => bookings.confirmRefund(id, ref, amount),
    });
    await failing.processOne(`ISSUE:${order.id}`);
    assert.equal(await state(order.id), 'DA_THANH_TOAN');
    assert.equal((await catalog.seats(f.showtime.id))[0]!.trang_thai, 'DA_BAN');
    const event = (await outbox.list({ page: 1, limit: 100, offset: 0 })).items.find(
        (e) => e.event_key === `ISSUE:${order.id}`,
    )!;
    assert.equal(event.trang_thai, 'THAT_BAI');
    assert.equal(event.so_lan_xu_ly, 1);
    await pool
        .request()
        .input('key', sql.VarChar(80), event.event_key)
        .query(
            'UPDATE dbo.OUTBOX_SU_KIEN SET xu_ly_sau=DATEADD(SECOND,-1,SYSUTCDATETIME()) WHERE event_key=@key',
        );
    await new OutboxProcessor().processOne(event.event_key);
    assert.equal(await state(order.id), 'HOAN_TAT');
});
test('12 CUSTOMER is forbidden from ADMIN endpoints', async () => {
    assert.equal(
        (
            await fetch(base + '/api/v1/admin/dashboard', {
                headers: authHeader(tokenA),
            })
        ).status,
        403,
    );
    assert.equal(
        (
            await fetch(base + '/api/v1/admin/dashboard', {
                headers: authHeader(adminToken),
            })
        ).status,
        200,
    );
});
test('13 A customer cannot read another customer booking or ticket', async () => {
    const f = await fixture(),
        order = await hold(f),
        p = await initiate(order);
    await callback(p, 'SUCCESS');
    await new OutboxProcessor().processOne(`ISSUE:${order.id}`);
    const ticket = (await bookings.tickets(order.id))[0]!;
    assert.equal(
        (
            await fetch(base + `/api/v1/bookings/${order.id}`, {
                headers: authHeader(tokenB),
            })
        ).status,
        404,
    );
    assert.equal(
        (
            await fetch(base + `/api/v1/tickets/${ticket.id}`, {
                headers: authHeader(tokenB),
            })
        ).status,
        404,
    );
});
test('14 Overlapping showtimes in one room are rejected', async () => {
    const f = await fixture();
    await assert.rejects(
        catalog.createShowtime(
            movieId,
            f.room.id,
            new Date(new Date(f.showtime.bat_dau_luc).getTime() + 60000),
            75000,
        ),
        (e) => sqlErrorNumber(e) === 51002,
    );
});
test('15 Forged and UNKNOWN callbacks do not incorrectly settle or fail payments', async () => {
    const f = await fixture(),
        order = await hold(f),
        p = await initiate(order);
    const body: PaymentCallback = {
        bookingId: order.id,
        paymentReference: p.ma_yeu_cau,
        transactionId: 'SIM-' + randomUUID(),
        amount: p.so_tien,
        currency: 'VND',
        status: 'SUCCESS',
        timestamp: Math.floor(Date.now() / 1000),
    };
    await assert.rejects(paymentService.webhook('simulator', body, '0'.repeat(64)));
    assert.equal((await bookings.payment(p.id))!.trang_thai, 'CHO');
    await callback(p, 'UNKNOWN');
    assert.equal((await bookings.payment(p.id))!.trang_thai, 'CHO');
    assert.equal(await state(order.id), 'CHO_THANH_TOAN');
});
test('16 Atomic claiming, lease recovery and stale-token fencing work across SQL connections', async () => {
    const f = await fixture(),
        order = await hold(f),
        p = await initiate(order);
    await callback(p, 'SUCCESS');
    const key = `ISSUE:${order.id}`;
    const claims = await Promise.all([
        outbox.claim(key),
        createCinemaOutboxRepository().claim(key),
    ]);
    assert.equal(claims.filter(Boolean).length, 1);
    const old = claims.find(Boolean)!;
    await pool
        .request()
        .input('key', sql.VarChar(80), key)
        .query(
            'UPDATE dbo.OUTBOX_SU_KIEN SET locked_until=DATEADD(SECOND,-1,SYSUTCDATETIME()) WHERE event_key=@key',
        );
    const fresh = await outbox.claim(key);
    assert(fresh);
    assert.notEqual(old.lock_token, fresh.lock_token);
    assert.equal(await outbox.retry(old, 30), false);
    assert.equal(await outbox.heartbeat(old), false);
    assert.equal(await outbox.heartbeat(fresh), true);
});
test('17 Waiting for booking locks cannot use a stale pre-lock expiry timestamp', async () => {
    const f = await fixture(),
        order = await hold(f),
        p = await initiate(order);
    const lock = new sql.Transaction(pool);
    await lock.begin();
    await lock
        .request()
        .input('id', sql.Int, order.id)
        .query(
            'UPDATE dbo.DON_HANG SET het_han_luc=DATEADD(SECOND,1,SYSUTCDATETIME()) WHERE id=@id; UPDATE dbo.GHE_SUAT_CHIEU SET het_han_luc=DATEADD(SECOND,1,SYSUTCDATETIME()) WHERE id_don_hang=@id',
        );
    const callbackPromise = callback(p, 'SUCCESS');
    await new Promise((r) => setTimeout(r, 1300));
    await lock.commit();
    await callbackPromise;
    assert.equal((await bookings.payment(p.id))!.trang_thai, 'CHO_HOAN_TIEN');
    assert.equal((await bookings.tickets(order.id)).length, 0);
});
test('18 Unknown refunds exhaust at five claims without falsely confirming a refund', async () => {
    const f = await fixture(),
        order = await hold(f),
        p = await initiate(order);
    await expireFixture(order.id);
    await callback(p, 'SUCCESS');
    const unknown: PaymentGateway = {
        name: 'simulator',
        createPayment: (row) => gateway.createPayment(row),
        verifyCallback: (body, signature) => gateway.verifyCallback(body, signature),
        refund: async () => ({
            verified: false,
            status: 'UNKNOWN',
            reference: '',
            amount: p.so_tien,
        }),
    };
    const processor = new OutboxProcessor(
            outbox,
            bookings,
            () => unknown,
            () => true,
        ),
        key = `REFUND:${p.id}`;
    for (let attempt = 0; attempt < 5; attempt++) {
        await pool
            .request()
            .input('key', sql.VarChar(80), key)
            .query(
                'UPDATE dbo.OUTBOX_SU_KIEN SET xu_ly_sau=DATEADD(SECOND,-1,SYSUTCDATETIME()) WHERE event_key=@key',
            );
        assert.equal(await processor.processOne(key), true);
    }
    assert.equal(await processor.processOne(key), false);
    assert.equal((await bookings.payment(p.id))!.trang_thai, 'CHO_HOAN_TIEN');
});
test('19 A contradictory failure after issued tickets preserves sold seats and tickets', async () => {
    const f = await fixture(),
        order = await hold(f),
        p = await initiate(order);
    await callback(p, 'SUCCESS');
    await bookings.issue(order.id);
    await callback(p, 'FAILED');
    assert.equal(await state(order.id), 'HOAN_TAT');
    assert.equal((await catalog.seats(f.showtime.id))[0]!.trang_thai, 'DA_BAN');
    assert.equal((await bookings.tickets(order.id)).length, 1);
    assert((await bookings.steps(order.id)).some((x) => x.thong_diep?.includes('Contradictory')));
});

test('20 Cancellation preserves ownership and a later verified payment is refunded', async () => {
    const f = await fixture(),
        order = await hold(f),
        p = await initiate(order);
    await assert.rejects(bookings.cancel(order.id, customerB), (e) => sqlErrorNumber(e) === 51001);
    await bookings.cancel(order.id, customerA);
    await bookings.cancel(order.id, customerA);
    assert.equal(await state(order.id), 'DA_HUY');
    assert.equal((await catalog.seats(f.showtime.id))[0]!.trang_thai, 'TRONG');
    await callback(p, 'SUCCESS');
    assert.equal(await state(order.id), 'CHO_HOAN_TIEN');
    assert.equal((await bookings.tickets(order.id)).length, 0);
});
test('21 A verified mismatched success refunds the actual received amount', async () => {
    const f = await fixture(),
        order = await hold(f),
        p = await initiate(order);
    await callback(p, 'SUCCESS', 'SIM-' + randomUUID(), p.so_tien - 1);
    const pending = (await bookings.payment(p.id))!;
    assert.equal(pending.trang_thai, 'CHO_HOAN_TIEN');
    assert.equal(pending.so_tien_gateway, p.so_tien - 1);
    await new OutboxProcessor().processOne(`REFUND:${p.id}`);
    assert.equal((await bookings.payment(p.id))!.trang_thai, 'DA_HOAN_TIEN');
    assert.equal((await bookings.tickets(order.id)).length, 0);
});
