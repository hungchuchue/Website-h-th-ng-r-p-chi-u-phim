import { createCinemaBookingService } from '../../../src/services/cinema.booking.service';
import { createCinemaBookingRepository } from '../../../src/repositories/cinema.booking.repository';
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { once } from 'node:events';
import type { Server } from 'node:http';
import express from 'express';
import { AppError } from '../../../src/utils/logger';
import { createCinemaRouter } from '../../../src/routes/cinema.routes';

import { BookingRepository } from '../../../src/repositories/cinema.booking.repository';
import { cinemaOpenApi } from '../../../src/config/cinema.openapi';
import { cinemaContracts } from '../../../src/config/cinema.contracts';
import type { BookingRow, CinemaIdentity, TicketRow } from '../../../src/types/cinema.types';
process.env.NODE_ENV = 'test';
const fixture: BookingRow = {
    id: 101,
    id_khach_hang: 1,
    id_suat_chieu: 15,
    ma_don: 'DH-FIXTURE',
    tong_tien: 75000,
    trang_thai: 'CHO_THANH_TOAN',
    het_han_luc: new Date(Date.now() + 420000),
    tao_luc: new Date(),
    ly_do_that_bai: null,
};
const ticket: TicketRow = {
    id: 201,
    id_don_hang: 101,
    id_suat_chieu: 15,
    id_ghe: 1,
    ma_ve: 'VE-FIXTURE',
    qr_token: 'A'.repeat(64),
    gia_ve: 75000,
    trang_thai: 'HOP_LE',
    ten_phim: 'Example Movie',
    bat_dau_luc: new Date(),
    ten_phong: 'Room 1',
    ten_cum_rap: 'Cinema',
    ten_ghe: 'A1',
};
function createReadFixture(): BookingRepository {
    return {
        ...createCinemaBookingRepository(),
        async booking(id: number, identity: CinemaIdentity) {
            return id === 101 && (identity.role === 'ADMIN' || identity.id === 1)
                ? fixture
                : undefined;
        },
        async seats() {
            return [{ id_ghe: 1, ten_ghe: 'A1', gia_ve: 75000 }];
        },
        async payments() {
            return [];
        },
        async history() {
            return { items: [], total: 0 };
        },
        async historySeats() {
            return [];
        },
        async tickets() {
            return [ticket];
        },
        async ticket(id: number, identity: CinemaIdentity) {
            return id === 201 && (identity.role === 'ADMIN' || identity.id === 1)
                ? ticket
                : undefined;
        },
    };
}
const auth = {
    register: async () => {
        throw new Error('unused');
    },
    login: async () => {
        throw new Error('unused');
    },
    me: async () => {
        throw new Error('unused');
    },
    authenticate: async (header: string | undefined): Promise<CinemaIdentity> => {
        if (header === 'Bearer customer') return { id: 1, role: 'CUSTOMER' };
        if (header === 'Bearer other-customer') return { id: 2, role: 'CUSTOMER' };
        if (header === 'Bearer admin') return { id: 1, role: 'ADMIN' };
        throw new AppError(401, 'UNAUTHORIZED', 'Invalid fixture token');
    },
};
let server: Server, base: string, production: Server, productionBase: string;
before(async () => {
    const app = express();
    app.use(express.json());
    app.use(
        '/api/v1',
        createCinemaRouter({
            enabled: () => true,
            environment: 'test',
            ports: { auth, bookings: createCinemaBookingService(createReadFixture()) },
        }),
    );
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert(address && typeof address !== 'string');
    base = `http://127.0.0.1:${address.port}`;
    const prod = express();
    prod.use(express.json());
    prod.use(
        '/api/v1',
        createCinemaRouter({
            enabled: () => true,
            environment: 'production',
            ports: { auth },
        }),
    );
    production = prod.listen(0, '127.0.0.1');
    await once(production, 'listening');
    const addr = production.address();
    assert(addr && typeof addr !== 'string');
    productionBase = `http://127.0.0.1:${addr.port}`;
});
after(async () => {
    for (const s of [server, production]) {
        if (s) {
            s.closeAllConnections();
            await new Promise<void>((resolve, reject) =>
                s.close((e) => (e ? reject(e) : resolve())),
            );
        }
    }
});
const headers = (token: string) => ({ Authorization: `Bearer ${token}` });
test('CUSTOMER cannot access ADMIN operations and missing tokens are rejected', async () => {
    assert.equal(
        (
            await fetch(base + '/api/v1/admin/dashboard', {
                headers: headers('customer'),
            })
        ).status,
        403,
    );
    assert.equal((await fetch(base + '/api/v1/bookings/101')).status, 401);
});
test('booking and ticket ownership is enforced while administrators can inspect', async () => {
    assert.equal(
        (
            await fetch(base + '/api/v1/bookings/101', {
                headers: headers('other-customer'),
            })
        ).status,
        404,
    );
    assert.equal(
        (
            await fetch(base + '/api/v1/tickets/201', {
                headers: headers('other-customer'),
            })
        ).status,
        404,
    );
    const owned = await fetch(base + '/api/v1/bookings/101', {
        headers: headers('customer'),
    });
    assert.equal(owned.status, 200);
    assert.equal((await owned.json()).data.selectedSeats[0].seatName, 'A1');
    const admin = await fetch(base + '/api/v1/tickets/201', {
        headers: headers('admin'),
    });
    assert.equal(admin.status, 200);
    assert.equal((await admin.json()).data.qrToken.length, 64);
});
test('literal booking history route is registered before the numeric booking route', async () => {
    const response = await fetch(base + '/api/v1/bookings/my-history', {
        headers: headers('customer'),
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, []);
});
test('simulator webhook is not registered in production or listed in production Swagger', async () => {
    assert.equal(
        (
            await fetch(productionBase + '/api/v1/webhooks/payments/simulator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
            })
        ).status,
        404,
    );
    const doc = await (await fetch(productionBase + '/api/v1/cinema/openapi.json')).json();
    assert(!doc.paths['/webhooks/payments/{provider}']);
});
test('Swagger JSON/UI/assets load and every documented operation matches a real route contract', async () => {
    const spec = await fetch(base + '/api/v1/cinema/openapi.json');
    assert.equal(spec.status, 200);
    const doc = await spec.json();
    assert.equal(
        Object.values(doc.paths as Record<string, Record<string, unknown>>).reduce(
            (n, p) => n + Object.keys(p).length,
            0,
        ),
        cinemaContracts.length,
    );
    assert.equal((await fetch(base + '/api/v1/cinema/docs/')).status, 200);
    assert.equal((await fetch(base + '/api/v1/cinema/docs/swagger-ui-init.js')).status, 200);
    assert.equal(
        new Set(cinemaContracts.map((c) => c.method + ':' + c.path)).size,
        cinemaContracts.length,
    );
    const schemas = doc.components.schemas as Record<string, unknown>;
    function verify(value: unknown) {
        if (!value || typeof value !== 'object') return;
        for (const [key, item] of Object.entries(value)) {
            if (key === 'required' && Array.isArray(item))
                assert(item.length > 0, 'OpenAPI required arrays cannot be empty');
            if (key === '$ref') {
                assert.equal(typeof item, 'string');
                const name = String(item).replace('#/components/schemas/', '');
                assert(name in schemas, `Missing schema ${name}`);
            } else verify(item);
        }
    }
    verify(doc);
    assert.equal(doc.paths['/bookings/holds'].post.security[0].CinemaBearer.length, 0);
    assert(cinemaOpenApi('production').paths['/movies']);
});
