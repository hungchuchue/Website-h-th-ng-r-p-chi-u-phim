import type { AuthDto, AccountDto } from './cinema.auth.types';
import type {
    BookingDto,
    TicketDto,
    BookingState,
    TransactionAction,
    TransactionStatus,
} from './cinema.booking.types';
import type {
    MovieDto,
    ShowtimeDto,
    PhysicalSeat,
    SeatType,
    SeatStatus,
} from './cinema.catalog.types';
import type { PaymentDto, PaymentStatus } from './cinema.payment.types';
import type { OutboxStatus, OutboxType } from './cinema.jobs.types';
import type { PaginationData } from './cinema.request.types';

export interface PaginatedResult<T> {
    items: T[];
    pagination: PaginationData;
}

export interface CinemaDto {
    id: number;
    name: string;
    address: string;
    city: string;
    active: boolean;
}

export type CreatedCinemaDto = Omit<CinemaDto, 'active'>;

export interface PhysicalSeatDto {
    id: number;
    row: string;
    number: number;
    name: string;
    type: SeatType;
    surcharge: number;
}

export interface RoomDto {
    id: number;
    cinemaId: number;
    name: string;
    active: boolean;
    seats: PhysicalSeatDto[];
}

export interface CreatedRoomDto {
    id: number;
    cinemaId: number;
    name: string;
    seats: PhysicalSeat[];
}

export interface SeatDto {
    seatId: number;
    seatName: string;
    row: string;
    number: number;
    type: SeatType;
    price: number;
    status: SeatStatus;
    expiresAt: Date | null;
}

export interface SeatMapDto {
    showtime: ShowtimeDto;
    serverTime: string;
    seats: SeatDto[];
}

export interface BookingDetailsDto extends BookingDto {
    payments: PaymentDto[];
}

export interface BookingHistoryDto extends BookingDto {
    customerId?: number;
}

export interface HoldResult {
    data: BookingDetailsDto;
    replayed: boolean;
}

export interface TransactionStepDto {
    id: string;
    step: string;
    action: TransactionAction;
    status: TransactionStatus;
    message: string | null;
    createdAt: Date;
}

export interface StartPaymentDto extends PaymentDto {
    simulationRequired: boolean;
    paymentUrl: string | null;
    expiresAt: Date;
}

export interface PaymentCallbackDto {
    paymentReference: string;
    status: PaymentStatus;
    reconciliationRequired?: boolean;
}

export interface OutboxDto {
    id: string;
    eventKey: string;
    bookingId: number;
    paymentId: number | null;
    type: OutboxType;
    status: OutboxStatus;
    attempts: number;
    procedureFailures: number;
    retryAt: Date;
    lockedUntil: Date | null;
    requiresReview: boolean;
    lastError: string | null;
}

export interface DashboardDto {
    bookingsByStatus: { status: BookingState; count: number }[];
    revenue: number;
    currency: string;
    issuedTickets: number;
    failedOutboxEvents: number;
}

export type CinemaEndpointDto =
    | AuthDto
    | AccountDto
    | MovieDto
    | MovieDto[]
    | CinemaDto[]
    | CreatedCinemaDto
    | RoomDto[]
    | CreatedRoomDto
    | ShowtimeDto
    | ShowtimeDto[]
    | SeatMapDto
    | BookingDetailsDto
    | BookingHistoryDto[]
    | StartPaymentDto
    | PaymentDto[]
    | PaymentCallbackDto
    | TicketDto
    | TicketDto[]
    | TransactionStepDto[]
    | DashboardDto
    | OutboxDto[];
