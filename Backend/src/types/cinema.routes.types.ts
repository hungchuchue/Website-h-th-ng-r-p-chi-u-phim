import type { CinemaAuthService } from '../services/cinema.auth.service';
import type { CatalogService } from '../services/cinema.catalog.service';
import type { BookingService } from '../services/cinema.booking.service';
import type { PaymentService } from '../services/cinema.payment.service';
import type { OutboxRepository } from '../repositories/cinema.outbox.repository';
import type { CinemaAdminService, DashboardResult } from '../services/cinema.admin.service';
export interface CinemaPorts {
    auth: Pick<CinemaAuthService, 'register' | 'login' | 'authenticate' | 'me'>;
    catalog: Pick<
        CatalogService,
        | 'movies'
        | 'movie'
        | 'cinemas'
        | 'rooms'
        | 'showtimes'
        | 'showtime'
        | 'seats'
        | 'createMovie'
        | 'updateMovie'
        | 'createCinema'
        | 'createRoom'
        | 'createShowtime'
    >;
    bookings: Pick<
        BookingService,
        'hold' | 'history' | 'get' | 'cancel' | 'tickets' | 'ticket' | 'steps'
    >;
    payments: Pick<PaymentService, 'start' | 'status' | 'webhook'>;
    outbox: Pick<OutboxRepository, 'list'>;
    dashboard: () => Promise<DashboardResult>;
    admin: CinemaAdminService;
}
export interface CinemaRouterOptions {
    enabled?: () => boolean;
    environment?: string;
    ports?: Partial<CinemaPorts>;
}
