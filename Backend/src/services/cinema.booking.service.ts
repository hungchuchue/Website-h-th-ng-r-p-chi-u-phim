import {
    cinemaBookingRepository,
    type BookingRepository,
} from '../repositories/cinema.booking.repository';
import type {
    BookingDetailsDto,
    BookingHistoryDto,
    HoldResult,
    PaginatedResult,
    TransactionStepDto,
} from '../types/cinema.service.types';
import type { HoldBody } from '../types/cinema.input.types';
import { sqlBigIntString } from '../utils/cinema.serialization';
import type { PaymentDto } from '../types/cinema.payment.types';
import type { BookingDto, TicketDto } from '../types/cinema.booking.types';
import type { CinemaInput, CinemaQuery } from '../types/cinema.input.types';
import { cinemaSettings } from '../config/cinema';
import type {
    BookingRow,
    BookingSeat,
    CinemaIdentity,
    PaymentRow,
    TicketRow,
} from '../types/cinema.types';
import { found } from './cinema.catalog.service';
import * as v from '../utils/cinema.validation';
export const bookingStates = [
    'CHO_THANH_TOAN',
    'DA_THANH_TOAN',
    'HOAN_TAT',
    'THAT_BAI',
    'HET_HAN',
    'DA_HUY',
    'CHO_HOAN_TIEN',
    'DA_HOAN_TIEN',
] as const;
export function paymentDto(p: PaymentRow): PaymentDto {
    return {
        id: p.id,
        bookingId: p.id_don_hang,
        paymentReference: p.ma_yeu_cau,
        provider: p.provider,
        amount: p.so_tien,
        receivedAmount: p.so_tien_gateway,
        currency: p.don_vi_tien,
        status: p.trang_thai,
        transactionId: p.ma_giao_dich_cong,
        refundReference: p.ma_hoan_tien,
        createdAt: p.thoi_gian_tao,
        updatedAt: p.thoi_gian_cap_nhat,
    };
}
export function bookingDto(d: BookingRow, seats: BookingSeat[] = []): BookingDto {
    return {
        bookingId: d.id,
        bookingCode: d.ma_don,
        showtimeId: d.id_suat_chieu,
        selectedSeats: seats.map((s) => ({
            seatId: s.id_ghe,
            seatName: s.ten_ghe,
            price: s.gia_ve,
        })),
        totalAmount: d.tong_tien,
        currency: 'VND',
        status: d.trang_thai,
        expiresAt: d.het_han_luc,
        remainingSeconds:
            d.trang_thai === 'CHO_THANH_TOAN'
                ? Math.max(0, Math.ceil((new Date(d.het_han_luc).getTime() - Date.now()) / 1000))
                : 0,
        paymentStatus: d.last_payment_status,
        issuedTicketCount: d.ticket_count,
        createdAt: d.tao_luc,
        failureReason: d.ly_do_that_bai,
        movieTitle: d.ten_phim,
        startsAt: d.bat_dau_luc,
        roomName: d.ten_phong,
        cinemaName: d.ten_cum_rap,
    };
}
export function ticketDto(t: TicketRow): TicketDto {
    return {
        id: t.id,
        bookingId: t.id_don_hang,
        showtimeId: t.id_suat_chieu,
        seatId: t.id_ghe,
        ticketCode: t.ma_ve,
        qrToken: t.qr_token,
        price: t.gia_ve,
        currency: 'VND',
        status: t.trang_thai,
        movieTitle: t.ten_phim,
        startsAt: t.bat_dau_luc,
        roomName: t.ten_phong,
        cinemaName: t.ten_cum_rap,
        seatName: t.ten_ghe,
    };
}

export interface BookingService {
    readonly repo: BookingRepository;
    requireBooking(id: number, identity: CinemaIdentity): Promise<BookingRow>;
    get(id: number, identity: CinemaIdentity): Promise<BookingDetailsDto>;
    hold(body: CinemaInput, key: CinemaInput, identity: CinemaIdentity): Promise<HoldResult>;
    cancel(id: number, identity: CinemaIdentity): Promise<BookingDetailsDto>;
    history(
        identity: CinemaIdentity,
        query: CinemaQuery,
        admin?: boolean,
    ): Promise<PaginatedResult<BookingHistoryDto>>;
    tickets(id: number, identity: CinemaIdentity): Promise<TicketDto[]>;
    ticket(id: number, identity: CinemaIdentity): Promise<TicketDto>;
    steps(id: number, identity: CinemaIdentity): Promise<TransactionStepDto[]>;
}

export function createCinemaBookingService(
    repo: BookingRepository = cinemaBookingRepository,
): BookingService {
    const service: BookingService = {
        repo,

        async requireBooking(id: number, identity: CinemaIdentity): Promise<BookingRow> {
            return found(await repo.booking(id, identity));
        },

        async get(id: number, identity: CinemaIdentity): Promise<BookingDetailsDto> {
            const row = await service.requireBooking(id, identity);
            const [seats, payments] = await Promise.all([repo.seats(id), repo.payments(id)]);
            return { ...bookingDto(row, seats), payments: payments.map(paymentDto) };
        },

        async hold(
            body: CinemaInput,
            key: CinemaInput,
            identity: CinemaIdentity,
        ): Promise<HoldResult> {
            const d = v.object(body, ['showtimeId', 'seatIds']);
            const showtimeId = v.positiveId(d.showtimeId, 'showtimeId'),
                seats = v.seatIds(d.seatIds),
                idempotencyKey = v.idempotencyKey(key);
            const request: HoldBody = { showtimeId, seatIds: seats };
            const row = await repo.hold(
                identity.id,
                request.showtimeId,
                request.seatIds,
                idempotencyKey,
                v.holdHash(request.showtimeId, request.seatIds),
                cinemaSettings().holdMinutes,
            );
            return {
                data: await service.get(row.id, identity),
                replayed: row.replayed === true,
            };
        },

        async cancel(id: number, identity: CinemaIdentity): Promise<BookingDetailsDto> {
            await service.requireBooking(id, identity);
            await repo.cancel(id, identity.id);
            return service.get(id, identity);
        },

        async history(
            identity: CinemaIdentity,
            query: CinemaQuery,
            admin = false,
        ): Promise<PaginatedResult<BookingHistoryDto>> {
            const page = v.pagination(query),
                status =
                    query.status === undefined
                        ? undefined
                        : v.choice(query.status, bookingStates, 'status');
            const result = await repo.history(identity, page, status, admin);
            const seats = await repo.historySeats(result.items.map((x) => x.id));
            return {
                items: result.items.map((row) => ({
                    ...bookingDto(
                        row,
                        seats.filter((s) => s.id_don_hang === row.id),
                    ),
                    ...(admin ? { customerId: row.id_khach_hang } : {}),
                })),
                pagination: { page: page.page, limit: page.limit, total: result.total },
            };
        },

        async tickets(id: number, identity: CinemaIdentity): Promise<TicketDto[]> {
            await service.requireBooking(id, identity);
            return (await repo.tickets(id)).map(ticketDto);
        },

        async ticket(id: number, identity: CinemaIdentity): Promise<TicketDto> {
            return ticketDto(found(await repo.ticket(id, identity)));
        },

        async steps(id: number, identity: CinemaIdentity): Promise<TransactionStepDto[]> {
            await service.requireBooking(id, identity);
            return (await repo.steps(id)).map((s) => ({
                id: sqlBigIntString(s.id),
                step: s.ten_buoc,
                action: s.hanh_dong,
                status: s.trang_thai,
                message: s.thong_diep,
                createdAt: s.tao_luc,
            }));
        },
    };

    return service;
}

export const cinemaBookingService = createCinemaBookingService();
