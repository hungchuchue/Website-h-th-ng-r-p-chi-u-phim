import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OutboxProcessor, backoffSeconds } from '../../../src/jobs/cinema.outbox.worker';
import type { OutboxEvent, PaymentGateway } from '../../../src/types/cinema.types';
const event: OutboxEvent = {
    id: '1',
    event_key: 'ISSUE:101',
    id_don_hang: 101,
    id_thanh_toan: null,
    loai_su_kien: 'PHAT_HANH_VE',
    trang_thai: 'CHO',
    so_lan_thu: 40,
    so_lan_xu_ly: 2,
    xu_ly_sau: new Date(),
    lock_token: '00000000-0000-4000-8000-000000000001',
    locked_until: new Date(Date.now() + 60000),
    thong_diep_loi: null,
};
test('worker backoff is bounded and uses processing attempts, not the procedure failure counter', async () => {
    let retry = 0,
        delay = 0;
    const processor = new OutboxProcessor(
        {
            claim: async () => event,
            heartbeat: async () => true,
            retry: async (_e, seconds) => {
                retry++;
                delay = seconds;
                return true;
            },
        },
        {
            issue: async () => {
                throw new Error('injected failure');
            },
            payment: async () => undefined,
            confirmRefund: async () => {},
        },
        () => {
            throw new Error('unused');
        },
        () => false,
    );
    assert.equal(await processor.processOne(), true);
    assert.equal(retry, 1);
    assert.equal(delay, 60);
    assert.deepEqual([1, 2, 3, 4, 5, 6].map(backoffSeconds), [30, 60, 120, 240, 300, 300]);
});
test('a worker that loses its fencing lease does not perform business side effects', async () => {
    let issued = 0,
        retried = 0;
    const processor = new OutboxProcessor(
        {
            claim: async () => event,
            heartbeat: async () => false,
            retry: async () => {
                retried++;
                return true;
            },
        },
        {
            issue: async () => {
                issued++;
            },
            payment: async () => undefined,
            confirmRefund: async () => {},
        },
        () => {
            throw new Error('unused');
        },
    );
    await processor.processOne();
    assert.equal(issued, 0);
    assert.equal(retried, 0);
});
test('an unknown refund result is retried without confirming money was returned', async () => {
    let confirmed = 0,
        retried = 0;
    const refundEvent = {
        ...event,
        loai_su_kien: 'HOAN_TIEN' as const,
        event_key: 'REFUND:1',
        id_thanh_toan: 1,
    };
    const gateway: PaymentGateway = {
        name: 'simulator',
        createPayment: () => {
            throw new Error('unused');
        },
        verifyCallback: () => {
            throw new Error('unused');
        },
        refund: async () => ({
            verified: false,
            status: 'UNKNOWN',
            reference: '',
            amount: 75000,
        }),
    };
    const processor = new OutboxProcessor(
        {
            claim: async () => refundEvent,
            heartbeat: async () => true,
            retry: async () => {
                retried++;
                return true;
            },
        },
        {
            issue: async () => {},
            payment: async () => ({
                id: 1,
                id_don_hang: 101,
                ma_yeu_cau: 'ref-1',
                provider: 'simulator',
                so_tien: 75000,
                so_tien_gateway: 75000,
                don_vi_tien: 'VND',
                trang_thai: 'CHO_HOAN_TIEN' as const,
                ma_giao_dich_cong: 'SIM-1',
                ma_hoan_tien: null,
                thoi_gian_tao: new Date(),
                thoi_gian_cap_nhat: new Date(),
            }),
            confirmRefund: async () => {
                confirmed++;
            },
        },
        () => gateway,
        () => true,
    );
    await processor.processOne();
    assert.equal(confirmed, 0);
    assert.equal(retried, 1);
});
