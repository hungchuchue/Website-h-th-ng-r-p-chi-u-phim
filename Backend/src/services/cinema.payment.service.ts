import {
    cinemaBookingRepository,
    type BookingRepository,
} from '../repositories/cinema.booking.repository';
import type { StartPaymentDto, PaymentCallbackDto } from '../types/cinema.service.types';
import type { PaymentDto } from '../types/cinema.payment.types';
import type { CinemaInput } from '../types/cinema.input.types';
import { AppError } from '../utils/logger';
import type { CinemaIdentity, PaymentGateway } from '../types/cinema.types';
import {
    createCinemaBookingService,
    paymentDto,
    type BookingService,
} from './cinema.booking.service';
import { found } from './cinema.catalog.service';
import { paymentGateway } from '../lib/cinema.simulator';
import * as v from '../utils/cinema.validation';

export interface PaymentService {
    readonly repo: BookingRepository;
    readonly bookings: BookingService;
    readonly gateway: () => PaymentGateway;
    readonly issueSoon: (key: string) => Promise<void>;
    start(
        id: number,
        identity: CinemaIdentity,
        body: CinemaInput,
        key: CinemaInput,
    ): Promise<StartPaymentDto>;
    status(id: number, identity: CinemaIdentity): Promise<PaymentDto[]>;
    webhook(
        provider: string,
        body: CinemaInput,
        signature: string | undefined,
    ): Promise<PaymentCallbackDto>;
}

export function createCinemaPaymentService(
    repo: BookingRepository = cinemaBookingRepository,
    bookings: BookingService = createCinemaBookingService(repo),
    gateway: () => PaymentGateway = paymentGateway,
    issueSoon: (key: string) => Promise<void> = async () => {},
): PaymentService {
    const gatewayFactory = gateway;
    const service: PaymentService = {
        repo,
        bookings,
        gateway,
        issueSoon,

        async start(
            id: number,
            identity: CinemaIdentity,
            body: CinemaInput,
            key: CinemaInput,
        ): Promise<StartPaymentDto> {
            const d = v.object(body ?? {}, ['provider']);
            const gateway = gatewayFactory();
            if (d.provider !== undefined && d.provider !== gateway.name)
                throw new AppError(400, 'UNSUPPORTED_PROVIDER', 'Unsupported payment provider.');
            const booking = await bookings.requireBooking(id, identity);
            const p = await repo.startPayment(id, identity.id, v.idempotencyKey(key), gateway.name);
            return {
                ...paymentDto(p),
                ...gateway.createPayment(p),
                expiresAt: booking.het_han_luc,
            };
        },

        async status(id: number, identity: CinemaIdentity): Promise<PaymentDto[]> {
            await bookings.requireBooking(id, identity);
            return (await repo.payments(id)).map(paymentDto);
        },

        async webhook(
            provider: string,
            body: CinemaInput,
            signature: string | undefined,
        ): Promise<PaymentCallbackDto> {
            const gateway = gatewayFactory();
            if (provider !== gateway.name)
                throw new AppError(
                    404,
                    'PROVIDER_NOT_FOUND',
                    'Payment provider is not configured.',
                );
            const callback = gateway.verifyCallback(body, signature); // Verification and validation happen BEFORE any database access.
            const p = found(await repo.paymentByReference(callback.paymentReference));
            if (
                p.provider !== provider ||
                p.id_don_hang !== callback.bookingId ||
                p.don_vi_tien !== callback.currency
            )
                throw new AppError(
                    400,
                    'PAYMENT_MISMATCH',
                    'Payment identity or currency does not match.',
                );
            if (callback.status === 'UNKNOWN') {
                await repo.unknownPayment(p.id_don_hang);
                return {
                    paymentReference: p.ma_yeu_cau,
                    status: p.trang_thai,
                    reconciliationRequired: true,
                };
            }
            const result = await repo.paymentResult(
                callback.paymentReference,
                callback.status === 'SUCCESS',
                callback.transactionId,
                callback.amount,
                provider,
            );
            if (result[0]?.trang_thai === 'THANH_CONG') {
                try {
                    await issueSoon(`ISSUE:${p.id_don_hang}`);
                } catch {
                    console.error(
                        '[Cinema] Immediate ticket attempt deferred to outbox; payment remains committed',
                    );
                }
            }
            return {
                paymentReference: p.ma_yeu_cau,
                status: result[0]?.trang_thai ?? p.trang_thai,
            };
        },
    };

    return service;
}

export const cinemaPaymentService = createCinemaPaymentService();
