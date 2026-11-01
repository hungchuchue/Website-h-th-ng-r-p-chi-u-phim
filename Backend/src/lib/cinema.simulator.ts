import type { CinemaInput } from '../types/cinema.input.types';
import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { AppError } from '../utils/logger';
import { cinemaSettings } from '../config/cinema';
import type {
    PaymentCallback,
    PaymentGateway,
    PaymentRow,
    RefundResult,
} from '../types/cinema.types';
import * as v from '../utils/cinema.validation';
export function parseCallback(body: CinemaInput): PaymentCallback {
    const d = v.object(body, [
        'bookingId',
        'paymentReference',
        'transactionId',
        'amount',
        'currency',
        'status',
        'timestamp',
    ]);
    const timestamp = d.timestamp;
    if (typeof timestamp !== 'number' || !Number.isSafeInteger(timestamp) || timestamp < 1)
        return v.invalid('timestamp must be Unix seconds.');
    return {
        bookingId: v.positiveId(d.bookingId, 'bookingId'),
        paymentReference: v.text(d.paymentReference, 'paymentReference', 64),
        transactionId: v.text(d.transactionId, 'transactionId', 128),
        amount: v.money(d.amount, 'amount', 2000000000000),
        currency: v.choice(d.currency, ['VND'] as const, 'currency'),
        status: v.choice(d.status, ['SUCCESS', 'FAILED', 'UNKNOWN'] as const, 'status'),
        timestamp,
    };
}
export function canonicalCallback(p: PaymentCallback): string {
    return JSON.stringify([
        p.bookingId,
        p.paymentReference,
        p.transactionId,
        p.amount.toFixed(2),
        p.currency,
        p.status,
        p.timestamp,
    ]);
}
export function signCallback(p: PaymentCallback, secret: string): string {
    return createHmac('sha256', secret).update(canonicalCallback(p)).digest('hex');
}
export class SimulatorGateway implements PaymentGateway {
    readonly name = 'simulator';
    constructor(
        readonly secret: string,
        readonly environment: string,
        readonly now: () => number = Date.now,
    ) {
        if (!['development', 'test'].includes(environment) || Buffer.byteLength(secret) < 32)
            throw new AppError(
                503,
                'SIMULATOR_DISABLED',
                'Payment simulator is available only in development/test with a dedicated 32-byte secret.',
            );
    }
    createPayment(p: PaymentRow) {
        return {
            provider: this.name,
            paymentReference: p.ma_yeu_cau,
            simulationRequired: true,
            paymentUrl: null,
        };
    }
    verifyCallback(body: CinemaInput, signature: string | undefined): PaymentCallback {
        const p = parseCallback(body);
        if (
            !signature ||
            !/^[a-f0-9]{64}$/.test(signature) ||
            Math.abs(Math.floor(this.now() / 1000) - p.timestamp) > 300 ||
            !timingSafeEqual(
                Buffer.from(signature, 'hex'),
                Buffer.from(signCallback(p, this.secret), 'hex'),
            )
        )
            throw new AppError(
                401,
                'INVALID_WEBHOOK_SIGNATURE',
                'Invalid or expired payment callback signature.',
            );
        return p;
    }
    async refund(p: PaymentRow, eventKey: string): Promise<RefundResult> {
        if (p.provider !== this.name || p.trang_thai !== 'CHO_HOAN_TIEN')
            throw new AppError(409, 'INVALID_REFUND', 'Payment is not awaiting simulator refund.');
        // A deterministic provider receipt models idempotency across process restarts; this never sends real money.
        return {
            verified: true,
            reference: 'SIM-REFUND-' + createHash('sha256').update(eventKey).digest('hex'),
            amount: p.so_tien_gateway ?? p.so_tien,
            status: 'SUCCESS',
        };
    }
}
export function simulatorAvailable(): boolean {
    const c = cinemaSettings();
    return (
        ['development', 'test'].includes(c.environment) &&
        c.paymentProvider === 'simulator' &&
        Buffer.byteLength(c.simulatorSecret) >= 32
    );
}
export function paymentGateway(): PaymentGateway {
    const c = cinemaSettings();
    if (c.paymentProvider !== 'simulator')
        throw new AppError(
            503,
            'PAYMENT_NOT_CONFIGURED',
            'No real payment provider is configured.',
        );
    return new SimulatorGateway(c.simulatorSecret, c.environment);
}
