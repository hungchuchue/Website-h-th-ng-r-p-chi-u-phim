import { createCinemaBookingRepository } from '../repositories/cinema.booking.repository';
import { createCinemaOutboxRepository } from '../repositories/cinema.outbox.repository';
import { OutboxRepository } from '../repositories/cinema.outbox.repository';
import { BookingRepository } from '../repositories/cinema.booking.repository';
import { paymentGateway, simulatorAvailable } from '../lib/cinema.simulator';
import type { PaymentGateway } from '../types/cinema.types';
export function backoffSeconds(attempt: number): number {
    return Math.min(300, 30 * 2 ** Math.max(0, attempt - 1));
}
export class OutboxProcessor {
    constructor(
        readonly outbox: Pick<
            OutboxRepository,
            'claim' | 'heartbeat' | 'retry'
        > = createCinemaOutboxRepository(),
        readonly bookings: Pick<
            BookingRepository,
            'issue' | 'payment' | 'confirmRefund'
        > = createCinemaBookingRepository(),
        readonly gateway: () => PaymentGateway = paymentGateway,
        readonly allowRefund: () => boolean = simulatorAvailable,
    ) {}
    async processOne(key?: string): Promise<boolean> {
        const event = await this.outbox.claim(key, this.allowRefund());
        if (!event) return false;
        if (!event.lock_token) throw new Error('Claim returned no fencing token');
        let heartbeat: Promise<void> | undefined,
            leaseLost = false;
        const timer = setInterval(() => {
            if (heartbeat) return;
            heartbeat = this.outbox
                .heartbeat(event)
                .then((owned) => {
                    if (!owned) leaseLost = true;
                })
                .catch(() => {
                    leaseLost = true;
                })
                .finally(() => {
                    heartbeat = undefined;
                });
        }, 20000);
        timer.unref();
        try {
            if (!(await this.outbox.heartbeat(event))) return true;
            if (event.loai_su_kien === 'PHAT_HANH_VE') await this.bookings.issue(event.id_don_hang);
            else {
                if (event.id_thanh_toan === null) throw new Error('Refund event has no payment');
                const payment = await this.bookings.payment(event.id_thanh_toan);
                if (!payment || payment.id_don_hang !== event.id_don_hang)
                    throw new Error('Refund payment identity mismatch');
                const provider = this.gateway();
                if (provider.name !== payment.provider) throw new Error('Refund provider mismatch');
                const result = await provider.refund(payment, event.event_key);
                if (
                    !result.verified ||
                    result.status !== 'SUCCESS' ||
                    result.amount !== (payment.so_tien_gateway ?? payment.so_tien)
                )
                    throw new Error('Refund outcome is unknown or does not match');
                if (leaseLost || !(await this.outbox.heartbeat(event))) return true;
                await this.bookings.confirmRefund(payment.id, result.reference, result.amount);
            }
        } catch {
            if (!leaseLost) await this.outbox.retry(event, backoffSeconds(event.so_lan_xu_ly));
            console.error('[Cinema] Outbox attempt deferred', {
                eventKey: event.event_key,
                attempt: event.so_lan_xu_ly,
                requiresReview: event.so_lan_xu_ly >= 5,
            });
        } finally {
            clearInterval(timer);
            if (heartbeat) await heartbeat;
        }
        return true;
    }
}
export const cinemaOutboxProcessor = new OutboxProcessor();
