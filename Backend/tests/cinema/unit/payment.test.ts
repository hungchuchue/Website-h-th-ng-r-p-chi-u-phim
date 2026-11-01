import { createCinemaPaymentService } from '../../../src/services/cinema.payment.service';
import { createCinemaBookingRepository } from '../../../src/repositories/cinema.booking.repository';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SimulatorGateway, signCallback } from '../../../src/lib/cinema.simulator';

import { BookingRepository } from '../../../src/repositories/cinema.booking.repository';
import type { PaymentCallback, PaymentRow } from '../../../src/types/cinema.types';
const secret = 'simulator-unit-test-secret-more-than-32-bytes',
    now = 1793448000000;
const callback: PaymentCallback = {
    bookingId: 101,
    paymentReference: 'reference-1',
    transactionId: 'SIM-1',
    amount: 75000,
    currency: 'VND',
    status: 'SUCCESS',
    timestamp: Math.floor(now / 1000),
};
const gateway = new SimulatorGateway(secret, 'test', () => now);
const payment: PaymentRow = {
    id: 1,
    id_don_hang: 101,
    ma_yeu_cau: 'reference-1',
    provider: 'simulator',
    so_tien: 75000,
    so_tien_gateway: null,
    don_vi_tien: 'VND',
    trang_thai: 'CHO',
    ma_giao_dich_cong: null,
    ma_hoan_tien: null,
    thoi_gian_tao: new Date(now),
    thoi_gian_cap_nhat: new Date(now),
};
function createPaymentFixture(): BookingRepository & {
    lookups: number;
    transitions: number;
    unknowns: number;
} {
    return {
        ...createCinemaBookingRepository(),
        lookups: 0,
        transitions: 0,
        unknowns: 0,
        async paymentByReference() {
            this.lookups++;
            return payment;
        },
        async paymentResult() {
            this.transitions++;
            return [{ trang_thai: 'THANH_CONG' as const }];
        },
        async unknownPayment() {
            this.unknowns++;
        },
    };
}
test('simulator validates signatures, timestamps, values and is unavailable in production', () => {
    assert.deepEqual(gateway.verifyCallback(callback, signCallback(callback, secret)), callback);
    assert.throws(() =>
        gateway.verifyCallback({ ...callback, amount: 1 }, signCallback(callback, secret)),
    );
    assert.throws(() =>
        gateway.verifyCallback(
            { ...callback, timestamp: callback.timestamp - 301 },
            signCallback({ ...callback, timestamp: callback.timestamp - 301 }, secret),
        ),
    );
    assert.throws(() => new SimulatorGateway(secret, 'production'));
    assert.throws(() => new SimulatorGateway('short', 'test'));
});
test('invalid payment callbacks never reach the repository', async () => {
    const repo = createPaymentFixture(),
        service = createCinemaPaymentService(repo, undefined, () => gateway);
    await assert.rejects(service.webhook('simulator', callback, '0'.repeat(64)));
    assert.equal(repo.lookups, 0);
    assert.equal(repo.transitions, 0);
});
test('UNKNOWN does not invoke success/failure procedure and ticket failure does not undo verified payment', async () => {
    const repo = createPaymentFixture(),
        service = createCinemaPaymentService(
            repo,
            undefined,
            () => gateway,
            async () => {
                throw new Error('injected issuance outage');
            },
        );
    const unknown = { ...callback, status: 'UNKNOWN' as const };
    const pending = await service.webhook('simulator', unknown, signCallback(unknown, secret));
    assert.equal(pending.reconciliationRequired, true);
    assert.equal(repo.unknowns, 1);
    assert.equal(repo.transitions, 0);
    const success = await service.webhook('simulator', callback, signCallback(callback, secret));
    assert.equal(success.status, 'THANH_CONG');
    assert.equal(repo.transitions, 1);
});
test('refund simulation uses a stable receipt and the actual received amount', async () => {
    const row = {
        ...payment,
        trang_thai: 'CHO_HOAN_TIEN' as const,
        so_tien_gateway: 70000,
    };
    const first = await gateway.refund(row, 'REFUND:1'),
        second = await gateway.refund(row, 'REFUND:1');
    assert.deepEqual(first, second);
    assert.equal(first.amount, 70000);
    assert.equal(first.verified, true);
});
