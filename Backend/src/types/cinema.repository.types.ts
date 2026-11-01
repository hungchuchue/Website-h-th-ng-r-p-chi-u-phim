import type { CinemaStore } from './cinema.sql.types';
import type { AccountRow, CinemaRole } from './cinema.auth.types';
import type {
    CinemaRow,
    MovieRow,
    RoomRow,
    SeatRow,
    ShowtimeRow,
    ShowtimeRecord,
    MovieInput,
    PhysicalSeat,
    SeatType,
} from './cinema.catalog.types';
import type {
    BookingRow,
    BookingSeat,
    BookingState,
    TransactionStepRow,
    TicketRow,
} from './cinema.booking.types';
import type { PaymentRow, PaymentStatus } from './cinema.payment.types';
import type { OutboxEvent } from './cinema.jobs.types';
import type { CinemaIdentity } from './cinema.auth.types';
import type { Page } from './cinema.database.types';
export interface RepositoryPage<T> {
    items: T[];
    total: number;
}
export interface PhysicalSeatRow {
    id: number;
    id_phong_chieu: number;
    hang_ghe: string;
    so_ghe: number;
    ten_ghe: string;
    loai_ghe: SeatType;
    phu_thu: number;
}
export interface HistorySeatRow extends BookingSeat {
    id_don_hang: number;
}
export interface PaymentResultRow {
    trang_thai: PaymentStatus;
}
export interface BookingStatusCount {
    status: BookingState;
    count: number;
}
export interface BookingDashboard {
    bookingsByStatus: BookingStatusCount[];
    revenue: number;
    currency: 'VND';
    issuedTickets: number;
    failedOutboxEvents: number;
}

export interface AccountsRepository {
    readonly db: CinemaStore;
    find(email: string, role: CinemaRole): Promise<AccountRow | undefined>;
    byId(id: number, role: CinemaRole): Promise<AccountRow | undefined>;
    create(email: string, hash: string, name: string, role?: CinemaRole): Promise<AccountRow>;
}

export interface CatalogRepository {
    readonly db: CinemaStore;
    movies(page: Page, status: string, search: string): Promise<RepositoryPage<MovieRow>>;
    movie(id: number): Promise<MovieRow | undefined>;
    createMovie(data: MovieInput): Promise<MovieRow>;
    updateMovie(id: number, data: Partial<MovieInput>): Promise<MovieRow | undefined>;
    cinemas(): Promise<CinemaRow[]>;
    cinema(id: number): Promise<CinemaRow | undefined>;
    createCinema(name: string, address: string, city: string): Promise<CinemaRow>;
    rooms(cinemaId: number): Promise<RoomRow[]>;
    physicalSeats(cinemaId: number): Promise<PhysicalSeatRow[]>;
    createRoom(cinemaId: number, name: string, seats: PhysicalSeat[]): Promise<RoomRow>;
    showtimes(
        filters: {
            movieId?: number;
            cinemaId?: number;
            date?: string;
        },
        page: Page,
    ): Promise<RepositoryPage<ShowtimeRow>>;
    showtime(id: number): Promise<ShowtimeRow | undefined>;
    createShowtime(
        movieId: number,
        roomId: number,
        startsAt: Date,
        price: number,
    ): Promise<ShowtimeRecord>;
    seats(showtimeId: number): Promise<SeatRow[]>;
}

export interface BookingRepository {
    readonly db: CinemaStore;
    hold(
        customerId: number,
        showtimeId: number,
        seats: number[],
        key: string,
        hash: string,
        minutes: number,
    ): Promise<BookingRow>;
    booking(id: number, identity: CinemaIdentity): Promise<BookingRow | undefined>;
    seats(id: number): Promise<BookingSeat[]>;
    history(
        identity: CinemaIdentity,
        page: Page,
        status: string | undefined,
        admin?: boolean,
    ): Promise<RepositoryPage<BookingRow>>;
    historySeats(ids: number[]): Promise<HistorySeatRow[]>;
    cancel(id: number, customerId: number): Promise<void>;
    startPayment(
        id: number,
        customerId: number,
        key: string,
        provider: string,
    ): Promise<PaymentRow>;
    paymentByReference(reference: string): Promise<PaymentRow | undefined>;
    payment(id: number): Promise<PaymentRow | undefined>;
    payments(id: number): Promise<PaymentRow[]>;
    paymentResult(
        reference: string,
        success: boolean,
        transaction: string,
        amount: number,
        provider: string,
    ): Promise<PaymentResultRow[]>;
    unknownPayment(id: number): Promise<void>;
    issue(id: number): Promise<void>;
    expire(): Promise<void>;
    confirmRefund(id: number, reference: string, amount: number): Promise<void>;
    tickets(id: number): Promise<TicketRow[]>;
    ticket(id: number, identity: CinemaIdentity): Promise<TicketRow | undefined>;
    steps(id: number): Promise<TransactionStepRow[]>;
    dashboard(): Promise<BookingDashboard>;
}

export interface OutboxRepository {
    readonly db: CinemaStore;
    claim(eventKey?: string, allowRefund?: boolean): Promise<OutboxEvent | undefined>;
    heartbeat(event: OutboxEvent): Promise<boolean>;
    retry(event: OutboxEvent, delaySeconds: number): Promise<boolean>;
    list(page: Page, status?: string): Promise<RepositoryPage<OutboxEvent>>;
}
