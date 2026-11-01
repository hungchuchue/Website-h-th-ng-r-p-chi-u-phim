import {
    cinemaOutboxRepository,
    type OutboxRepository,
} from '../repositories/cinema.outbox.repository';
import { cinemaBookingRepository } from '../repositories/cinema.booking.repository';
import type { DashboardDto, OutboxDto, PaginatedResult } from '../types/cinema.service.types';
import { sqlBigIntString } from '../utils/cinema.serialization';
import { pagination, choice } from '../utils/cinema.validation';
import type { CinemaQuery } from '../types/cinema.input.types';
export type DashboardResult = DashboardDto;

export interface CinemaAdminService {
    readonly outboxRepo: Pick<OutboxRepository, 'list'>;
    readonly dashboardPort: () => Promise<DashboardResult>;
    dashboard(): Promise<DashboardResult>;
    outbox(query: CinemaQuery): Promise<PaginatedResult<OutboxDto>>;
}

export function createCinemaAdminService(
    outboxRepo: Pick<OutboxRepository, 'list'> = cinemaOutboxRepository,
    dashboardPort: () => Promise<DashboardResult> = () => cinemaBookingRepository.dashboard(),
): CinemaAdminService {
    const service: CinemaAdminService = {
        outboxRepo,
        dashboardPort,

        dashboard(): Promise<DashboardResult> {
            return dashboardPort();
        },

        async outbox(query: CinemaQuery): Promise<PaginatedResult<OutboxDto>> {
            const p = pagination(query),
                status =
                    query.status === undefined
                        ? undefined
                        : choice(query.status, ['CHO', 'THAT_BAI', 'HOAN_TAT'], 'status');
            const result = await outboxRepo.list(p, status);
            return {
                items: result.items.map((e) => ({
                    id: sqlBigIntString(e.id),
                    eventKey: e.event_key,
                    bookingId: e.id_don_hang,
                    paymentId: e.id_thanh_toan,
                    type: e.loai_su_kien,
                    status: e.trang_thai,
                    attempts: e.so_lan_xu_ly,
                    procedureFailures: e.so_lan_thu,
                    retryAt: e.xu_ly_sau,
                    lockedUntil: e.locked_until,
                    requiresReview:
                        e.trang_thai !== 'HOAN_TAT' &&
                        e.so_lan_xu_ly >= 5 &&
                        (!e.locked_until || new Date(e.locked_until).getTime() <= Date.now()),
                    lastError: e.thong_diep_loi,
                })),
                pagination: { page: p.page, limit: p.limit, total: result.total },
            };
        },
    };

    return service;
}

export const cinemaAdminService = createCinemaAdminService();
